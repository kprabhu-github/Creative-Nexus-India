// ---------------------------------------------------------------------------
// GET /api/dashboard — Aggregated dashboard metrics
// ---------------------------------------------------------------------------
// Returns real-time metrics from Supabase across all modules:
// sig_runs, sig_agent_runs, sig_deliverables, gtm_leads,
// hr_employees, fin_expenses, fin_invoices, core_action_notifications,
// core_agency_config.
//
// Tables that don't exist yet return safe fallback values.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";

// ---------------------------------------------------------------------------
// Safe query helper — returns null instead of throwing if the table
// doesn't exist (PostgREST error code 42P01 = undefined_table).
// ---------------------------------------------------------------------------

interface QueryResult<T> {
  data: T | null;
  error: { code?: string; message: string } | null;
}

async function safeQuery<T>(
  queryFn: () => PromiseLike<QueryResult<T>>,
  fallback: T,
): Promise<T> {
  try {
    const { data, error } = await queryFn();
    if (error) {
      // 42P01 = relation does not exist (table not yet migrated)
      // PGRST204 = no rows returned
      if (error.code === "42P01" || error.code === "PGRST204") {
        return fallback;
      }
      console.warn("Dashboard query warning:", error.message);
      return fallback;
    }
    return data ?? fallback;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardMetrics {
  totalWorkflowRuns: number;
  completedRuns: number;
  runningRuns: number;
  failedRuns: number;
  totalLeads: number;
  qualifiedLeads: number;
  totalEmployees: number;
  activeEmployees: number;
  pendingExpenses: number;
  pendingExpenseValue: number;
  pendingInvoices: number;
  totalInvoiceValue: number;
}

interface RecentRun {
  id: string;
  workflow_code: string;
  status: string;
  progress: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface Notification {
  id: string;
  title: string;
  message: string | null;
  category: string;
  priority: string;
  source_module: string | null;
  source_url: string | null;
  actions: Array<{ label: string; url?: string }>;
  is_read: boolean;
  created_at: string;
}

interface ApiServiceStatus {
  name: string;
  key: string;
  status: "connected" | "disconnected" | "unknown";
}

interface QuickStats {
  agentsActive: number;
  avgQualityScore: number;
  apiStatus: ApiServiceStatus[];
}

interface DashboardResponse {
  metrics: DashboardMetrics;
  recentRuns: RecentRun[];
  recentNotifications: Notification[];
  quickStats: QuickStats;
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const supabase = createAdminClient();

    // Run all queries in parallel for speed
    const [
      allRuns,
      recentRuns,
      leadsAll,
      leadsQual,
      empsAll,
      empsActive,
      expensesPending,
      invoicesPending,
      invoicesAll,
      recentNotifications,
      agentsToday,
      deliverableStatuses,
      agencyConfig,
    ] = await Promise.all([
      // 1. All workflow runs (for status aggregation)
      safeQuery(
        () =>
          supabase
            .from("sig_runs")
            .select("status")
            .eq("org_id", ORG_ID),
        [] as Array<{ status: string }>,
      ),

      // 2. Last 5 workflow runs (for recent list)
      safeQuery(
        () =>
          supabase
            .from("sig_runs")
            .select("id, workflow_code, status, progress, created_at, started_at, completed_at")
            .eq("org_id", ORG_ID)
            .order("created_at", { ascending: false })
            .limit(5),
        [] as RecentRun[],
      ),

      // 3. All leads (count by array length)
      safeQuery(
        () =>
          supabase
            .from("gtm_leads")
            .select("id")
            .eq("org_id", ORG_ID),
        [] as Array<{ id: string }>,
      ),

      // 4. Qualified leads
      safeQuery(
        () =>
          supabase
            .from("gtm_leads")
            .select("id")
            .eq("org_id", ORG_ID)
            .eq("status", "qualified"),
        [] as Array<{ id: string }>,
      ),

      // 5. All employees
      safeQuery(
        () =>
          supabase
            .from("hr_employees")
            .select("id")
            .eq("org_id", ORG_ID),
        [] as Array<{ id: string }>,
      ),

      // 6. Active employees
      safeQuery(
        () =>
          supabase
            .from("hr_employees")
            .select("id")
            .eq("org_id", ORG_ID)
            .eq("status", "active"),
        [] as Array<{ id: string }>,
      ),

      // 7. Pending expenses
      safeQuery(
        () =>
          supabase
            .from("fin_expenses")
            .select("amount")
            .eq("org_id", ORG_ID)
            .eq("status", "pending"),
        [] as Array<{ amount: number }>,
      ),

      // 8. Pending invoices
      safeQuery(
        () =>
          supabase
            .from("fin_invoices")
            .select("total")
            .eq("org_id", ORG_ID)
            .in("status", ["pending", "sent"]),
        [] as Array<{ total: number }>,
      ),

      // 9. All invoices (for total revenue)
      safeQuery(
        () =>
          supabase
            .from("fin_invoices")
            .select("total")
            .eq("org_id", ORG_ID),
        [] as Array<{ total: number }>,
      ),

      // 10. Recent notifications
      safeQuery(
        () =>
          supabase
            .from("core_action_notifications")
            .select("id, title, message, category, priority, source_module, source_url, actions, is_read, created_at")
            .eq("org_id", ORG_ID)
            .eq("is_dismissed", false)
            .order("created_at", { ascending: false })
            .limit(5),
        [] as Notification[],
      ),

      // 11. Agents active today
      safeQuery(
        () =>
          supabase
            .from("sig_agent_runs")
            .select("agent_id")
            .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        [] as Array<{ agent_id: string }>,
      ),

      // 12. Deliverable statuses (quality score approximation)
      safeQuery(
        () =>
          supabase
            .from("sig_deliverables")
            .select("status")
            .eq("org_id", ORG_ID),
        [] as Array<{ status: string }>,
      ),

      // 13. Agency config (API status flags)
      safeQuery(
        () =>
          supabase
            .from("core_agency_config")
            .select("*")
            .eq("org_id", ORG_ID)
            .single(),
        null as Record<string, unknown> | null,
      ),
    ]);

    // ---------------------------------------------------------------
    // Aggregate metrics
    // ---------------------------------------------------------------

    const runStatuses = allRuns as Array<{ status: string }>;
    const totalWorkflowRuns = runStatuses.length;
    const completedRuns = runStatuses.filter((r) => r.status === "completed").length;
    const runningRuns = runStatuses.filter((r) => r.status === "running").length;
    const failedRuns = runStatuses.filter((r) => r.status === "failed").length;

    const pendingExpensesList = expensesPending as Array<{ amount: number }>;
    const pendingInvoicesList = invoicesPending as Array<{ total: number }>;
    const allInvoices = invoicesAll as Array<{ total: number }>;

    const pendingExpenseValue = pendingExpensesList.reduce(
      (sum, e) => sum + (Number(e.amount) || 0),
      0,
    );

    const totalInvoiceValue = allInvoices.reduce(
      (sum, i) => sum + (Number(i.total) || 0),
      0,
    );

    // ---------------------------------------------------------------
    // Quick stats
    // ---------------------------------------------------------------

    const agentCodes = agentsToday as Array<{ agent_id: string }>;
    const uniqueAgents = new Set(agentCodes.map((a) => a.agent_id));

    // Quality score approximation: count approved vs total deliverables
    const deliverables = deliverableStatuses as Array<{ status: string }>;
    const approvedCount = deliverables.filter(
      (d) => d.status === "approved" || d.status === "published",
    ).length;
    const avgQualityScore =
      deliverables.length > 0
        ? Math.round((approvedCount / deliverables.length) * 100)
        : 0;

    // API status from agency config
    const config = agencyConfig as Record<string, unknown> | null;
    const apiStatusConfig = (config?.api_status ?? {}) as Record<
      string,
      string
    >;

    const API_SERVICES = [
      { name: "Supabase", key: "supabase" },
      { name: "Anthropic", key: "anthropic" },
      { name: "Apify", key: "apify" },
      { name: "NVIDIA", key: "nvidia" },
      { name: "OpenAI", key: "openai" },
      { name: "Razorpay", key: "razorpay" },
      { name: "Ahrefs", key: "ahrefs" },
      { name: "Semrush", key: "semrush" },
    ];

    const apiStatus: ApiServiceStatus[] = API_SERVICES.map((svc) => ({
      name: svc.name,
      key: svc.key,
      status: (apiStatusConfig[svc.key] as ApiServiceStatus["status"]) ?? "unknown",
    }));

    // ---------------------------------------------------------------
    // Compose response
    // ---------------------------------------------------------------

    const response: DashboardResponse = {
      metrics: {
        totalWorkflowRuns,
        completedRuns,
        runningRuns,
        failedRuns,
        totalLeads: (leadsAll as Array<{ id: string }>).length,
        qualifiedLeads: (leadsQual as Array<{ id: string }>).length,
        totalEmployees: (empsAll as Array<{ id: string }>).length,
        activeEmployees: (empsActive as Array<{ id: string }>).length,
        pendingExpenses: pendingExpensesList.length,
        pendingExpenseValue,
        pendingInvoices: pendingInvoicesList.length,
        totalInvoiceValue,
      },
      recentRuns: recentRuns as RecentRun[],
      recentNotifications: recentNotifications as Notification[],
      quickStats: {
        agentsActive: uniqueAgents.size,
        avgQualityScore,
        apiStatus,
      },
    };

    return NextResponse.json({ data: response });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("GET /api/dashboard error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

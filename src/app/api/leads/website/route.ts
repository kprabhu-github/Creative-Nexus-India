// ---------------------------------------------------------------------------
// GET /api/leads/website — Fetch leads from WordPress/WooCommerce
// ---------------------------------------------------------------------------
// Aggregates leads from multiple WooCommerce/WordPress sources:
//   1. WooCommerce Orders
//   2. WooCommerce Customers
//   3. Contact Form 7 entries
//   4. WordPress Comments
//
// Auth: WooCommerce endpoints use consumer_key/secret as query params.
//       WordPress REST endpoints use Basic auth.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LeadSource =
  | "woocommerce_order"
  | "woocommerce_customer"
  | "contact_form"
  | "comment";

type LeadStatus = "new" | "contacted" | "qualified" | "converted";

interface Lead {
  id: string;
  source: LeadSource;
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  value: number;
  status: LeadStatus;
  date: string;
  meta: Record<string, unknown>;
}

interface SourceCounts {
  orders: number;
  customers: number;
  forms: number;
  comments: number;
}

interface LeadsResponse {
  leads: Lead[];
  total: number;
  sources: SourceCounts;
}

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

function getWooConfig() {
  const url = process.env.WOOCOMMERCE_URL;
  const ck = process.env.WOOCOMMERCE_CONSUMER_KEY;
  const cs = process.env.WOOCOMMERCE_CONSUMER_SECRET;

  if (!url || !ck || !cs) {
    return null;
  }

  return { url: url.replace(/\/+$/, ""), ck, cs };
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

/** Fetch from WooCommerce REST API (auth via query params) */
async function wcFetch<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<{ data: T | null; error: string | null }> {
  const config = getWooConfig();
  if (!config) {
    return { data: null, error: "WooCommerce credentials not configured" };
  }

  const url = new URL(`${config.url}/wp-json/wc/v3${path}`);
  url.searchParams.set("consumer_key", config.ck);
  url.searchParams.set("consumer_secret", config.cs);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  try {
    const res = await fetch(url.toString(), {
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 0 },
    });

    if (res.status === 401 || res.status === 403) {
      return {
        data: null,
        error: `WooCommerce authentication failed (${res.status}). Check consumer_key and consumer_secret.`,
      };
    }

    if (res.status === 404) {
      return { data: null, error: null }; // Endpoint not available — skip
    }

    if (!res.ok) {
      return { data: null, error: `WooCommerce returned ${res.status}` };
    }

    const json = (await res.json()) as T;
    return { data: json, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    return { data: null, error: `WooCommerce fetch failed: ${msg}` };
  }
}

/** Fetch from WordPress REST API (auth via Basic auth) */
async function wpFetch<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<{ data: T | null; error: string | null }> {
  const config = getWooConfig();
  if (!config) {
    return { data: null, error: "WordPress credentials not configured" };
  }

  const url = new URL(`${config.url}/wp-json${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const basicAuth = Buffer.from(`${config.ck}:${config.cs}`).toString(
    "base64",
  );

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${basicAuth}`,
      },
      next: { revalidate: 0 },
    });

    if (res.status === 401 || res.status === 403) {
      return { data: null, error: null }; // WP endpoints may not accept these creds
    }

    if (res.status === 404) {
      return { data: null, error: null }; // Plugin not installed — skip
    }

    if (!res.ok) {
      return { data: null, error: `WordPress returned ${res.status}` };
    }

    const json = (await res.json()) as T;
    return { data: json, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    return { data: null, error: `WordPress fetch failed: ${msg}` };
  }
}

// ---------------------------------------------------------------------------
// Source: WooCommerce Orders
// ---------------------------------------------------------------------------

interface WcOrder {
  id: number;
  status: string;
  date_created: string;
  total: string;
  billing: {
    first_name: string;
    last_name: string;
    company: string;
    email: string;
    phone: string;
  };
  line_items: Array<{ name: string }>;
}

function mapOrderStatus(wcStatus: string): LeadStatus {
  switch (wcStatus) {
    case "completed":
      return "converted";
    case "processing":
    case "on-hold":
      return "qualified";
    case "pending":
      return "new";
    default:
      return "contacted";
  }
}

async function fetchOrders(
  perPage: string,
): Promise<{ leads: Lead[]; error: string | null }> {
  const { data, error } = await wcFetch<WcOrder[]>("/orders", {
    per_page: perPage,
    orderby: "date",
    order: "desc",
  });

  if (error) return { leads: [], error };
  if (!data) return { leads: [], error: null };

  const leads: Lead[] = data.map((order) => ({
    id: `wc_order_${order.id}`,
    source: "woocommerce_order",
    name: `${order.billing.first_name} ${order.billing.last_name}`.trim(),
    email: order.billing.email || "",
    phone: order.billing.phone || "",
    company: order.billing.company || "",
    message: order.line_items.map((li) => li.name).join(", "),
    value: parseFloat(order.total) || 0,
    status: mapOrderStatus(order.status),
    date: order.date_created,
    meta: {
      wc_status: order.status,
      order_id: order.id,
    },
  }));

  return { leads, error: null };
}

// ---------------------------------------------------------------------------
// Source: WooCommerce Customers
// ---------------------------------------------------------------------------

interface WcCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  date_created: string;
  billing: {
    phone: string;
    company: string;
  };
  orders_count: number;
  total_spent: string;
}

async function fetchCustomers(
  perPage: string,
): Promise<{ leads: Lead[]; error: string | null }> {
  const { data, error } = await wcFetch<WcCustomer[]>("/customers", {
    per_page: perPage,
    orderby: "registered_date",
    order: "desc",
  });

  if (error) return { leads: [], error };
  if (!data) return { leads: [], error: null };

  const leads: Lead[] = data.map((cust) => ({
    id: `wc_customer_${cust.id}`,
    source: "woocommerce_customer",
    name: `${cust.first_name} ${cust.last_name}`.trim(),
    email: cust.email || "",
    phone: cust.billing?.phone || "",
    company: cust.billing?.company || "",
    message: "",
    value: parseFloat(cust.total_spent) || 0,
    status:
      cust.orders_count > 0
        ? "converted"
        : "new",
    date: cust.date_created,
    meta: {
      orders_count: cust.orders_count,
      total_spent: cust.total_spent,
    },
  }));

  return { leads, error: null };
}

// ---------------------------------------------------------------------------
// Source: Contact Form 7
// ---------------------------------------------------------------------------

interface Cf7Form {
  id: number;
  title: { rendered: string };
}

interface Cf7Message {
  id: number;
  date: string;
  fields: Record<string, string>;
  meta: Record<string, unknown>;
}

async function fetchContactForms(
  perPage: string,
): Promise<{ leads: Lead[]; error: string | null }> {
  // Step 1: List forms
  const { data: forms, error: formsError } = await wpFetch<Cf7Form[]>(
    "/contact-form-7/v1/contact-forms",
  );

  if (formsError || !forms || forms.length === 0) {
    return { leads: [], error: null }; // CF7 not installed or no forms — skip gracefully
  }

  // Step 2: Try fetching messages (Flamingo plugin stores CF7 submissions)
  const allLeads: Lead[] = [];

  for (const form of forms.slice(0, 3)) {
    // Try Flamingo Inbound endpoint
    const { data: messages } = await wpFetch<Cf7Message[]>(
      `/flamingo/v1/inbound`,
      { per_page: perPage, search: String(form.id) },
    );

    if (messages && Array.isArray(messages)) {
      for (const msg of messages) {
        allLeads.push({
          id: `cf7_entry_${msg.id}`,
          source: "contact_form",
          name: msg.fields?.["your-name"] || msg.fields?.name || "",
          email: msg.fields?.["your-email"] || msg.fields?.email || "",
          phone: msg.fields?.["your-phone"] || msg.fields?.phone || msg.fields?.tel || "",
          company: msg.fields?.["your-company"] || msg.fields?.company || "",
          message: msg.fields?.["your-message"] || msg.fields?.message || "",
          value: 0,
          status: "new",
          date: msg.date || new Date().toISOString(),
          meta: {
            form_id: form.id,
            form_title: form.title?.rendered,
            fields: msg.fields,
          },
        });
      }
    }
  }

  return { leads: allLeads, error: null };
}

// ---------------------------------------------------------------------------
// Source: WordPress Comments
// ---------------------------------------------------------------------------

interface WpComment {
  id: number;
  author_name: string;
  author_email: string;
  content: { rendered: string };
  date: string;
  status: string;
}

async function fetchComments(): Promise<{
  leads: Lead[];
  error: string | null;
}> {
  const { data, error } = await wpFetch<WpComment[]>("/wp/v2/comments", {
    per_page: "10",
    orderby: "date",
    order: "desc",
  });

  if (error) return { leads: [], error };
  if (!data) return { leads: [], error: null };

  const leads: Lead[] = data.map((comment) => {
    // Strip HTML tags from rendered content
    const plainText = comment.content.rendered
      .replace(/<[^>]*>/g, "")
      .trim();

    return {
      id: `wp_comment_${comment.id}`,
      source: "comment" as LeadSource,
      name: comment.author_name || "",
      email: comment.author_email || "",
      phone: "",
      company: "",
      message: plainText,
      value: 0,
      status: "new" as LeadStatus,
      date: comment.date,
      meta: {
        comment_status: comment.status,
      },
    };
  });

  return { leads, error: null };
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const source = searchParams.get("source") || "all";
  const perPage = searchParams.get("per_page") || "20";

  // Validate WooCommerce config
  const config = getWooConfig();
  if (!config) {
    return NextResponse.json(
      {
        error:
          "WooCommerce API credentials not configured. Set WOOCOMMERCE_URL, WOOCOMMERCE_CONSUMER_KEY, and WOOCOMMERCE_CONSUMER_SECRET in .env.local",
      },
      { status: 500 },
    );
  }

  const errors: string[] = [];
  let allLeads: Lead[] = [];
  const sources: SourceCounts = {
    orders: 0,
    customers: 0,
    forms: 0,
    comments: 0,
  };

  // Fetch sources in parallel based on filter
  const shouldFetch = (s: string) => source === "all" || source === s;

  const [ordersResult, customersResult, formsResult, commentsResult] =
    await Promise.all([
      shouldFetch("orders")
        ? fetchOrders(perPage)
        : Promise.resolve({ leads: [] as Lead[], error: null }),
      shouldFetch("customers")
        ? fetchCustomers(perPage)
        : Promise.resolve({ leads: [] as Lead[], error: null }),
      shouldFetch("forms")
        ? fetchContactForms(perPage)
        : Promise.resolve({ leads: [] as Lead[], error: null }),
      shouldFetch("comments")
        ? fetchComments()
        : Promise.resolve({ leads: [] as Lead[], error: null }),
    ]);

  // Aggregate
  if (ordersResult.error) errors.push(ordersResult.error);
  sources.orders = ordersResult.leads.length;
  allLeads = allLeads.concat(ordersResult.leads);

  if (customersResult.error) errors.push(customersResult.error);
  sources.customers = customersResult.leads.length;
  allLeads = allLeads.concat(customersResult.leads);

  if (formsResult.error) errors.push(formsResult.error);
  sources.forms = formsResult.leads.length;
  allLeads = allLeads.concat(formsResult.leads);

  if (commentsResult.error) errors.push(commentsResult.error);
  sources.comments = commentsResult.leads.length;
  allLeads = allLeads.concat(commentsResult.leads);

  // Sort by date descending
  allLeads.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  // If ALL sources returned auth errors, return a clear error
  if (allLeads.length === 0 && errors.length > 0) {
    const isAuthError = errors.some(
      (e) => e.includes("authentication") || e.includes("401") || e.includes("403"),
    );

    if (isAuthError) {
      return NextResponse.json(
        {
          error:
            "WooCommerce authentication failed. Verify your consumer_key and consumer_secret have Read permissions, and that the site URL is correct.",
          details: errors,
        },
        { status: 401 },
      );
    }
  }

  const response: LeadsResponse = {
    leads: allLeads,
    total: allLeads.length,
    sources,
  };

  return NextResponse.json({
    data: response,
    ...(errors.length > 0 ? { warnings: errors } : {}),
  });
}

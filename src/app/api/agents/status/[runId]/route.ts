// ---------------------------------------------------------------------------
// GET /api/agents/status/[runId] — Workflow run status
// ---------------------------------------------------------------------------
// Returns the current status of a workflow run including all agent runs,
// progress percentage, and output data (when available).
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteParams {
  params: { runId: string };
}

export async function GET(
  _request: Request,
  { params }: RouteParams,
) {
  try {
    const { runId } = params;

    // Validate UUID format
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(runId)) {
      return NextResponse.json(
        { error: "Invalid run ID format" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    // Fetch the run record
    const { data: run, error: runError } = await supabase
      .from("sig_runs")
      .select("*")
      .eq("id", runId)
      .single();

    if (runError || !run) {
      return NextResponse.json(
        { error: "Run not found" },
        { status: 404 },
      );
    }

    // Fetch all agent runs for this workflow run, ordered by creation time
    const { data: agentRuns, error: agentRunsError } = await supabase
      .from("sig_agent_runs")
      .select("*")
      .eq("run_id", runId)
      .order("created_at", { ascending: true });

    if (agentRunsError) {
      console.error("Failed to fetch agent runs:", agentRunsError.message);
    }

    // Compute summary stats
    const agents = agentRuns ?? [];
    const completed = agents.filter((a) => a.status === "completed").length;
    const failed = agents.filter((a) => a.status === "failed").length;
    const running = agents.filter((a) => a.status === "running").length;
    const totalTokensIn = agents.reduce(
      (sum, a) => sum + ((a.tokens_in as number) || 0),
      0,
    );
    const totalTokensOut = agents.reduce(
      (sum, a) => sum + ((a.tokens_out as number) || 0),
      0,
    );
    const totalDurationMs = agents.reduce(
      (sum, a) => sum + ((a.duration_ms as number) || 0),
      0,
    );

    return NextResponse.json({
      data: {
        run,
        agentRuns: agents,
        summary: {
          totalAgents: agents.length,
          completed,
          failed,
          running,
          pending: agents.length - completed - failed - running,
          totalTokensIn,
          totalTokensOut,
          totalDurationMs,
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("GET /api/agents/status/[runId] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

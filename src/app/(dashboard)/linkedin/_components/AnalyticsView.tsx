"use client";

// Analytics tab content for /linkedin. Lazy-loaded — only fetched when
// the user switches to the Analytics tab.

import { useMemo } from "react";
import { C, type Prospect, type Campaign } from "../_shared";

export default function AnalyticsView({
  prospects,
  campaigns,
}: {
  prospects: Prospect[];
  campaigns: Campaign[];
}) {
  const total = prospects.length;
  const inSeq = prospects.filter((p) => p.status === "in_sequence").length;
  const replied = prospects.filter((p) => p.replyReceived).length;
  const meetings = prospects.filter((p) => p.status === "meeting").length;
  const replyRate = total ? Math.round((replied / total) * 100) : 0;
  const meetingRate = total ? Math.round((meetings / total) * 100) : 0;

  const byIndustry = useMemo(() => {
    const m = new Map<string, number>();
    prospects.forEach((p) => m.set(p.industry, (m.get(p.industry) ?? 0) + 1));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [prospects]);

  return (
    <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>
      {[
        ["Total Prospects", total, ""],
        ["In Sequence", inSeq, ""],
        ["Replied", replied, `${replyRate}%`],
        ["Meetings", meetings, `${meetingRate}%`],
      ].map(([l, v, pct]) => (
        <div key={l as string} style={{ background: "white", borderRadius: 12, padding: "16px 18px", border: "1px solid #E5E7EB" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 6 }}>{l as string}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.navy }}>{v as number}</div>
          {pct && <div style={{ fontSize: 11, color: C.coral, fontWeight: 700, marginTop: 2 }}>{pct as string}</div>}
        </div>
      ))}

      <div style={{ gridColumn: "span 2", background: "white", borderRadius: 12, padding: "16px 18px", border: "1px solid #E5E7EB" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 10 }}>Prospects by Industry</div>
        {byIndustry.map(([ind, n]) => (
          <div key={ind} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: "#374151", width: 110 }}>{ind}</span>
            <div style={{ flex: 1, height: 6, background: "#F3F4F6", borderRadius: 3 }}>
              <div style={{ width: `${(n / total) * 100}%`, height: "100%", background: C.coral, borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.navy, width: 26, textAlign: "right" }}>{n}</span>
          </div>
        ))}
      </div>

      <div style={{ gridColumn: "span 2", background: "white", borderRadius: 12, padding: "16px 18px", border: "1px solid #E5E7EB" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 10 }}>Active Campaigns</div>
        {campaigns.map((c) => (
          <div key={c.id} style={{ padding: "10px 0", borderBottom: "1px solid #F3F4F6" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>{c.name}</span>
              <span style={{ fontSize: 10, color: c.status === "active" ? C.green : C.gray, fontWeight: 700 }}>{c.status.toUpperCase()}</span>
            </div>
            <div style={{ fontSize: 10, color: "#6B7280" }}>
              {c.prospects} prospects · {c.inSequence} in sequence · {c.replied} replied · {c.meetings} meetings
            </div>
          </div>
        ))}
        {campaigns.length === 0 && <div style={{ fontSize: 11, color: C.gray }}>No campaigns yet.</div>}
      </div>
    </div>
  );
}

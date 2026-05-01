"use client";

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// Types redeclared locally — page.tsx doesn't export ScanResults (default-exported page).
interface ScanReportPlatform { key: string; mentions: number; score: number }
interface ScanReportCitedDomain { domain: string; mentionCount: number; avgAuthority: number; score: number }
interface ScanReportInsight { priority: "critical" | "high" | "medium" | "low"; title: string; action: string }
interface ScanReportPrompt { prompt: string; score: number; lastChecked: string }

export interface ScanReportData {
  brandName: string;
  domain: string | null;
  visibilityScore: number;
  citationCount: number;
  shareOfVoice: number;
  recommendationRate: number;
  citationAuthority: number;
  platformBreakdown: ScanReportPlatform[];
  citedDomains: ScanReportCitedDomain[];
  insights: ScanReportInsight[];
  prompts: ScanReportPrompt[];
  scannedAt: string;
}

const NAVY = "#0A1628";
const CORAL = "#FF6B5A";
const MUTED = "#5C6B7E";
const BORDER = "#E2E8EE";
const BG_SOFT = "#F0F4F8";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, color: NAVY, fontFamily: "Helvetica" },
  brandBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: BORDER },
  brandName: { fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY },
  brandDomain: { fontSize: 9, color: MUTED },
  reportTitle: { fontSize: 22, fontFamily: "Helvetica-Bold", marginTop: 18, marginBottom: 4, color: NAVY },
  reportDate: { fontSize: 9, color: MUTED, marginBottom: 18 },
  scoreBlock: { alignItems: "center", paddingVertical: 18, marginBottom: 16, borderRadius: 6, backgroundColor: BG_SOFT },
  scoreLabel: { fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 },
  scoreValue: { fontSize: 56, fontFamily: "Helvetica-Bold", color: CORAL, lineHeight: 1 },
  scoreOutOf: { fontSize: 11, color: MUTED, marginTop: 2 },
  pillsRow: { flexDirection: "row", gap: 6, marginBottom: 18 },
  pill: { flex: 1, padding: 8, borderRadius: 4, borderWidth: 1, borderColor: BORDER },
  pillLabel: { fontSize: 7, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 },
  pillValue: { fontSize: 14, fontFamily: "Helvetica-Bold", color: NAVY },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 6, marginTop: 10 },
  table: { borderWidth: 1, borderColor: BORDER, borderRadius: 4, marginBottom: 10 },
  tHeadRow: { flexDirection: "row", backgroundColor: BG_SOFT, paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: BORDER },
  tRow: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  tRowLast: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 8 },
  th: { fontSize: 8, fontFamily: "Helvetica-Bold", color: MUTED, textTransform: "uppercase" },
  td: { fontSize: 9, color: NAVY },
  tdMuted: { fontSize: 9, color: MUTED },
  insightRow: { flexDirection: "row", gap: 6, paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  insightRowLast: { flexDirection: "row", gap: 6, paddingVertical: 6, paddingHorizontal: 8 },
  priorityChip: { fontSize: 7, fontFamily: "Helvetica-Bold", paddingVertical: 2, paddingHorizontal: 5, borderRadius: 3, color: "#FFFFFF", textTransform: "uppercase" },
  insightBody: { flex: 1 },
  insightTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 2 },
  insightAction: { fontSize: 8, color: MUTED, lineHeight: 1.4 },
  footer: { position: "absolute", bottom: 18, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: MUTED, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: BORDER },
});

const priorityColor = (p: ScanReportInsight["priority"]): string =>
  p === "critical" ? "#D90A2C" : p === "high" ? CORAL : p === "medium" ? "#D97706" : MUTED;

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const cellW = (n: number): { width: string } => ({ width: `${n}%` });

export const ScanReportPDF = ({ data }: { data: ScanReportData }) => {
  const generatedOn = formatDate(data.scannedAt || new Date().toISOString());
  const topInsights = data.insights.slice(0, 5);
  const topPrompts = data.prompts.slice(0, 8);
  const topDomains = data.citedDomains.slice(0, 8);

  return (
    <Document title={`SearchLens Report — ${data.brandName}`} author="Creative Nexus SearchLens">
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.brandBar} fixed>
          <Text style={styles.brandName}>Creative Nexus · SearchLens</Text>
          <Text style={styles.brandDomain}>{data.domain ?? data.brandName}</Text>
        </View>

        <Text style={styles.reportTitle}>AI Visibility Report</Text>
        <Text style={styles.reportDate}>{data.brandName} · Generated {generatedOn}</Text>

        <View style={styles.scoreBlock}>
          <Text style={styles.scoreLabel}>Visibility Score</Text>
          <Text style={styles.scoreValue}>{data.visibilityScore}</Text>
          <Text style={styles.scoreOutOf}>out of 100</Text>
        </View>

        <View style={styles.pillsRow}>
          <View style={styles.pill}><Text style={styles.pillLabel}>Citations</Text><Text style={styles.pillValue}>{data.citationCount}</Text></View>
          <View style={styles.pill}><Text style={styles.pillLabel}>Share of Voice</Text><Text style={styles.pillValue}>{data.shareOfVoice}%</Text></View>
          <View style={styles.pill}><Text style={styles.pillLabel}>Recommendation</Text><Text style={styles.pillValue}>{data.recommendationRate}%</Text></View>
          <View style={styles.pill}><Text style={styles.pillLabel}>Citation Authority</Text><Text style={styles.pillValue}>{data.citationAuthority}</Text></View>
        </View>

        <Text style={styles.sectionTitle}>Platform Breakdown</Text>
        <View style={styles.table}>
          <View style={styles.tHeadRow}>
            <Text style={[styles.th, cellW(50)]}>Platform</Text>
            <Text style={[styles.th, cellW(25)]}>Mentions</Text>
            <Text style={[styles.th, cellW(25)]}>Score</Text>
          </View>
          {data.platformBreakdown.map((p, i) => (
            <View key={p.key} style={i === data.platformBreakdown.length - 1 ? styles.tRowLast : styles.tRow}>
              <Text style={[styles.td, cellW(50)]}>{p.key}</Text>
              <Text style={[styles.td, cellW(25)]}>{p.mentions}</Text>
              <Text style={[styles.td, cellW(25)]}>{p.score}</Text>
            </View>
          ))}
        </View>

        {topDomains.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Top Cited Sources</Text>
            <View style={styles.table}>
              <View style={styles.tHeadRow}>
                <Text style={[styles.th, cellW(50)]}>Domain</Text>
                <Text style={[styles.th, cellW(20)]}>Mentions</Text>
                <Text style={[styles.th, cellW(15)]}>Authority</Text>
                <Text style={[styles.th, cellW(15)]}>Score</Text>
              </View>
              {topDomains.map((d, i) => (
                <View key={d.domain} style={i === topDomains.length - 1 ? styles.tRowLast : styles.tRow}>
                  <Text style={[styles.td, cellW(50)]}>{d.domain}</Text>
                  <Text style={[styles.td, cellW(20)]}>{d.mentionCount}</Text>
                  <Text style={[styles.td, cellW(15)]}>{d.avgAuthority}</Text>
                  <Text style={[styles.td, cellW(15)]}>{d.score}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {topInsights.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Top Insights</Text>
            <View style={styles.table}>
              {topInsights.map((ins, i) => (
                <View key={`${ins.title}-${i}`} style={i === topInsights.length - 1 ? styles.insightRowLast : styles.insightRow}>
                  <Text style={[styles.priorityChip, { backgroundColor: priorityColor(ins.priority) }]}>{ins.priority}</Text>
                  <View style={styles.insightBody}>
                    <Text style={styles.insightTitle}>{ins.title}</Text>
                    <Text style={styles.insightAction}>{ins.action}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {topPrompts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Tracked Prompts</Text>
            <View style={styles.table}>
              <View style={styles.tHeadRow}>
                <Text style={[styles.th, cellW(60)]}>Prompt</Text>
                <Text style={[styles.th, cellW(15)]}>Score</Text>
                <Text style={[styles.th, cellW(25)]}>Last Checked</Text>
              </View>
              {topPrompts.map((p, i) => (
                <View key={`${p.prompt}-${i}`} style={i === topPrompts.length - 1 ? styles.tRowLast : styles.tRow}>
                  <Text style={[styles.td, cellW(60)]}>{p.prompt}</Text>
                  <Text style={[styles.td, cellW(15)]}>{p.score}</Text>
                  <Text style={[styles.tdMuted, cellW(25)]}>{p.lastChecked}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={styles.footer} fixed>
          <Text>Creative Nexus SearchLens · {generatedOn}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};

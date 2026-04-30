"use client";

// Import-prospects modal for /linkedin. Lazy-loaded — only fetched when
// the user clicks "Import CSV / URLs" on the Queue tab.

import { useRef, useState } from "react";
import { C } from "../_shared";

export default function ImportModal({
  campaignName,
  onClose,
  onImport,
  importing,
}: {
  campaignName: string;
  onClose: () => void;
  onImport: (type: "csv" | "urls", data: string) => void;
  importing: boolean;
}) {
  const [mode, setMode] = useState<"csv" | "urls">("csv");
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setText(content);
    setMode("csv");
  }

  const csvExample = `name,headline,company,industry,location,email,linkedin_url
Ankit Bhatia,VP Marketing @ Zomato,Zomato,E-Commerce,Gurugram,a.bhatia@zomato.com,https://linkedin.com/in/ankit-bhatia`;
  const urlExample = `https://linkedin.com/in/ankit-bhatia
https://linkedin.com/in/ritu-shenoy
https://linkedin.com/in/karan-malhotra`;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "white", borderRadius: 16, padding: "20px 22px", width: 540, maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>Import Prospects</div>
            <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>Adding to &ldquo;{campaignName}&rdquo;</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.gray }}>×</button>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <button onClick={() => setMode("csv")} style={{ flex: 1, padding: "7px", borderRadius: 8, border: "1px solid", borderColor: mode === "csv" ? C.coral : "#E5E7EB", background: mode === "csv" ? "#FFF1ED" : "white", color: mode === "csv" ? C.coral : "#374151", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>📄 CSV</button>
          <button onClick={() => setMode("urls")} style={{ flex: 1, padding: "7px", borderRadius: 8, border: "1px solid", borderColor: mode === "urls" ? C.coral : "#E5E7EB", background: mode === "urls" ? "#FFF1ED" : "white", color: mode === "urls" ? C.coral : "#374151", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>🔗 URL List</button>
        </div>

        {mode === "csv" && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", marginBottom: 4 }}>Upload file</div>
            <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" onChange={handleFile} style={{ marginBottom: 10, fontSize: 12 }} />
            <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", marginBottom: 4 }}>Or paste CSV</div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={csvExample}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 12, fontFamily: "monospace", outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.5 }}
            />
            <div style={{ fontSize: 10, color: C.gray, marginTop: 4 }}>
              Accepted columns: name, headline, company, industry, location, email, linkedin_url (any order, any case).
              Supports Apollo.io and Sales Navigator exports.
            </div>
          </>
        )}

        {mode === "urls" && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", marginBottom: 4 }}>Paste LinkedIn URLs (one per line)</div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={urlExample}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 12, fontFamily: "monospace", outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }}
            />
            <div style={{ fontSize: 10, color: C.gray, marginTop: 4 }}>
              Creates a row per URL with name derived from the slug. Headline, company, etc. will be blank
              — enrich by running a profile scrape per-prospect later.
            </div>
          </>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={onClose} disabled={importing} style={{ flex: 1, padding: "10px", borderRadius: 9, border: "1px solid #E5E7EB", background: "transparent", color: "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button onClick={() => onImport(mode, text)} disabled={!text.trim() || importing} style={{ flex: 1, padding: "10px", borderRadius: 9, border: "none", background: text.trim() && !importing ? C.coral : "#F3F4F6", color: text.trim() && !importing ? "white" : C.gray, fontSize: 12, fontWeight: 700, cursor: text.trim() && !importing ? "pointer" : "default", fontFamily: "inherit" }}>
            {importing ? "Importing…" : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GET + PUT /api/company — Organisation + agency config combined
// ---------------------------------------------------------------------------
// GET:  Returns company profile from core_organisations + core_agency_config.
// PUT:  Updates company fields in core_organisations.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";

// ---------------------------------------------------------------------------
// Static company data — returned as defaults when DB rows don't exist yet
// ---------------------------------------------------------------------------

const COMPANY_DEFAULTS = {
  org_id: ORG_ID,
  name: "Creative Nexus India",
  legal_name: "M/s. Creative Nexus India",
  website: "creativenexus.in",
  brand_color: "#D90A2C",
  about:
    "Creative Nexus India is an AI-native digital marketing and creative agency that combines cutting-edge artificial intelligence with bold creative strategy. We help brands across India and globally build powerful digital presence through data-driven SEO, AI-powered content, performance marketing, and immersive design experiences. Founded with a mission to redefine how agencies operate, we leverage 36 AI agents and 13 automated workflows to deliver results that traditional agencies simply cannot match.",

  // Legal & Tax
  gstin: "07AANFC9845Q1ZF",
  pan: "AANFC9845Q",
  lut_no: "AD070719000441B",

  // Banking
  bank_account_name: "M/s. Creative Nexus India",
  bank_name: "ICICI Bank Ltd.",
  bank_account_no: "033105005146",
  bank_ifsc: "ICIC0000331",
  bank_swift: "ICICINBBNRI",
  bank_micr: "110229046",
  bank_branch: "Ashok Vihar Branch",
  bank_branch_address: "B-2/16, Kheman House, Ashok Vihar-II, New Delhi - 110052",

  // Offices
  offices: [
    {
      label: "Head Office",
      city: "Gurugram",
      state: "Haryana",
      address: "Tower B, Sohna Road, Sector 49, Gurugram, Haryana 122018",
    },
    {
      label: "Design Studio",
      city: "Bengaluru",
      state: "Karnataka",
      address: "HSR Layout, Sector 2, Bengaluru, Karnataka 560102",
    },
    {
      label: "Registered Office",
      city: "Delhi",
      state: "Delhi",
      address: "B-2/16, Ashok Vihar Phase-II, New Delhi 110052",
    },
  ],

  // Contact
  phones: ["+91 9999212010", "+91 9019321894"],
  emails: ["info@creativenexus.in", "prabhu@creativenexus.in", "rishabh@creativenexus.in"],

  // Social
  social: {
    instagram: { handle: "@creativenexusindia", url: "https://instagram.com/creativenexusindia" },
    facebook: { handle: "@creativenexusinc", url: "https://facebook.com/creativenexusinc" },
    twitter: { handle: "@creativenexusin", url: "https://x.com/creativenexusin" },
    linkedin_company: {
      handle: "Creative Nexus India",
      url: "https://linkedin.com/company/13328448",
    },
    linkedin_personal: {
      handle: "K. Prabhu",
      url: "https://linkedin.com/in/k-prabhu-2062ba14",
    },
    youtube: {
      handle: "Creative Nexus",
      url: "https://youtube.com/@creativenexusindia",
    },
    pinterest: {
      handle: "@CreativeNexusindia",
      url: "https://pinterest.com/CreativeNexusindia",
    },
  },

  // Founder
  founder: {
    name: "K. Prabhu",
    title: "Founder & CEO",
    email: "prabhu@creativenexus.in",
    phone: "+91 9999212010",
    linkedin: "https://linkedin.com/in/k-prabhu-2062ba14",
  },
};

// ---------------------------------------------------------------------------
// GET /api/company
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const supabase = createAdminClient();

    // Attempt to fetch from core_organisations
    const { data: orgData, error: orgError } = await supabase
      .from("core_organisations")
      .select("*")
      .eq("id", ORG_ID)
      .single();

    // Attempt to fetch from core_agency_config
    const { data: configData, error: configError } = await supabase
      .from("core_agency_config")
      .select("*")
      .eq("org_id", ORG_ID)
      .single();

    // If both fail (tables don't exist yet or no rows), return defaults
    if (orgError && configError) {
      return NextResponse.json({ data: COMPANY_DEFAULTS, source: "defaults" });
    }

    // Merge DB data with defaults (DB values take precedence)
    const merged = {
      ...COMPANY_DEFAULTS,
      ...(orgData ?? {}),
      ...(configData ?? {}),
    };

    return NextResponse.json({ data: merged, source: "database" });
  } catch (err) {
    // If Supabase is not available, return defaults
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("GET /api/company error:", message);
    return NextResponse.json({ data: COMPANY_DEFAULTS, source: "defaults" });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/company
// ---------------------------------------------------------------------------

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    // Remove protected fields
    delete body.id;
    delete body.org_id;
    delete body.created_at;

    const supabase = createAdminClient();

    // Check if org row exists
    const { data: existing, error: fetchError } = await supabase
      .from("core_organisations")
      .select("id")
      .eq("id", ORG_ID)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("PUT /api/company fetch error:", fetchError.message);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    let result;

    if (existing) {
      const { data, error } = await supabase
        .from("core_organisations")
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq("id", ORG_ID)
        .select("*")
        .single();

      if (error) {
        console.error("PUT /api/company update error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      result = data;
    } else {
      const { data, error } = await supabase
        .from("core_organisations")
        .insert({ id: ORG_ID, ...body })
        .select("*")
        .single();

      if (error) {
        console.error("PUT /api/company insert error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      result = data;
    }

    return NextResponse.json({ data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("PUT /api/company error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

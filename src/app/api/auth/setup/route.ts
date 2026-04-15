import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// This is a one-time setup route to create the founder account
// Delete after first use
export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { email, password } = await request.json();

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  // Create core_users entry linked to auth user
  const { error: profileError } = await supabase.from("core_users").insert({
    id: authData.user.id,
    org_id: "a0000000-0000-0000-0000-000000000001",
    role: "super_admin",
    display_name: "K. Prabhu",
    email,
  });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  // Link employee record to auth user
  await supabase
    .from("hr_employees")
    .update({ user_id: authData.user.id })
    .eq("id", "e0000000-0000-0000-0000-000000000001");

  return NextResponse.json({
    data: { userId: authData.user.id, email, role: "super_admin" },
    message: "Account created. You can now log in.",
  });
}

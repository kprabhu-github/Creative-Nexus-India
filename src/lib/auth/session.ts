import { createClient } from "../supabase/server";

export async function getSession() {
  const supabase = createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { user: null };
  }

  const { data: coreUser, error: coreError } = await supabase
    .from("core_users")
    .select("role, org_id, display_name, avatar_url")
    .eq("id", user.id)
    .single();

  if (coreError || !coreUser) {
    // If not found in core_users, return just the auth user info
    return { 
      user: {
        id: user.id,
        email: user.email,
        role: "employee", // fallback
        org_id: null,
      } 
    };
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      ...coreUser,
    },
  };
}

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf-8")
  .split("\n")
  .filter((l) => l && !l.startsWith("#") && l.includes("="))
  .reduce((acc, l) => {
    const [k, ...v] = l.split("=");
    acc[k.trim()] = v.join("=").trim();
    return acc;
  }, {});

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2];
const password = process.argv[3];
const role = process.argv[4] || "manager";

if (!email || !password) {
  console.error("usage: node create-dev-user.mjs <email> <password> [role]");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const { data, error } = await sb.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { role, created_by: "admin-script" },
});

if (error) {
  console.error("FAILED:", error.message);
  process.exit(1);
}

console.log("OK user created:");
console.log("  id:    ", data.user.id);
console.log("  email: ", data.user.email);
console.log("  role:  ", role);

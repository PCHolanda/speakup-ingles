import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: users } = await admin.auth.admin.listUsers();
  console.log("=== LIST USERS DETAILS ===");
  console.log(JSON.stringify(users, null, 2));
}

main().catch(console.error);

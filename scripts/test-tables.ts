import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const admin = createClient(url, serviceKey);

  console.log("--- Querying profiles ---");
  const { data: profiles, error: pErr } = await admin.from("profiles").select("*");
  console.log("Profiles:", profiles, "Error:", pErr);

  console.log("\n--- Querying turmas ---");
  const { data: turmas, error: tErr } = await admin.from("turmas").select("*");
  console.log("Turmas:", turmas, "Error:", tErr);
}

main().catch(console.error);

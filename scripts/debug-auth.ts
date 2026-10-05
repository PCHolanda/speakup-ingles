import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function main() {
  console.log("Supabase URL:", url);
  console.log("Has Service Key:", !!serviceKey);
  console.log("Has Anon Key:", !!anonKey);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const client = createClient(url, anonKey);

  console.log("\n--- Verificando usuários existentes no Auth ---");
  const { data: users, error: listError } = await admin.auth.admin.listUsers();
  if (listError) {
    console.error("Erro ao listar usuários:", listError);
  } else {
    console.log("Total usuários encontrados:", users.users.length);
    for (const u of users.users) {
      console.log(`- ID: ${u.id}, Email: ${u.email}`);
    }
  }

  console.log("\n--- Testando signInWithPassword (professor@demo.com) ---");
  const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
    email: "professor@demo.com",
    password: "password123",
  });

  if (signInError) {
    console.error("Erro no signIn:", signInError);
  } else {
    console.log("Login OK! User ID:", signInData.user?.id);
  }
}

main().catch(console.error);

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("Tentando criar Professor via Admin API...");
  const { data: profUser, error: profErr } = await admin.auth.admin.createUser({
    email: "professor@demo.com",
    password: "password123",
    email_confirm: true,
    user_metadata: { nome: "Professor Demo" },
  });

  if (profErr) {
    console.error("Erro ao criar professor via API:", profErr);
  } else {
    console.log("Professor criado com sucesso via API! ID:", profUser.user.id);
  }
}

main().catch(console.error);

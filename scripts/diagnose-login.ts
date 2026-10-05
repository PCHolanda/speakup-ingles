import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function testLogins() {
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  console.log("=== 1. VERIFICANDO PERFIS NO BANCO ===");
  const { data: profiles } = await admin.from("profiles").select("*");
  console.log("Perfis cadastrados:", profiles);

  console.log("\n=== 2. TESTANDO LOGIN DO PROFESSOR (professor@demo.com) ===");
  const client1 = createClient(url, anonKey);
  const { data: d1, error: e1 } = await client1.auth.signInWithPassword({
    email: "professor@demo.com",
    password: "password123",
  });

  if (e1) {
    console.error("Erro no login professor:", e1);
  } else {
    console.log("Sucesso no login professor! User ID:", d1.user?.id);
    // Testar busca de perfil como o usuário logado (com RLS)
    const { data: p1, error: pe1 } = await client1
      .from("profiles")
      .select("papel")
      .eq("id", d1.user.id)
      .single();
    console.log("Resultado perfil do professor:", p1, "Erro:", pe1);
  }

  console.log("\n=== 3. TESTANDO LOGIN DO ADMIN (admin@speakup.com) ===");
  const client2 = createClient(url, anonKey);
  const { data: d2, error: e2 } = await client2.auth.signInWithPassword({
    email: "admin@speakup.com",
    password: "admin123",
  });

  if (e2) {
    console.error("Erro no login admin:", e2);
  } else {
    console.log("Sucesso no login admin! User ID:", d2.user?.id);
    const { data: p2, error: pe2 } = await client2
      .from("profiles")
      .select("papel")
      .eq("id", d2.user.id)
      .single();
    console.log("Resultado perfil do admin:", p2, "Erro:", pe2);
  }
}

testLogins().catch(console.error);

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("--- Inspecionando colunas de auth.identities e auth.users via RPC ou query ---");
  // Tentando chamar a função criar_professor diretamente para capturar a mensagem exata de erro!
  const { data, error } = await admin.rpc("criar_professor", {
    p_nome: "Maria Eduarda",
    p_email: "maria@escola.com",
    p_senha: "senha123",
  });

  if (error) {
    console.error("ERRO CAPTURADO EM criar_professor:", error);
  } else {
    console.log("SUCESSO:", data);
  }
}

main().catch(console.error);

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function fixUsers() {
  console.log("=== LIMPANDO USUÁRIO ADMIN CORROMPIDO VIA SQL ===");
  // 1. Deletar do profiles e turmas se houver
  await admin.from("profiles").delete().eq("id", "c410ae67-4fd0-4d5b-925e-45235a95a984");
  await admin.from("profiles").delete().eq("id", "2f860c0f-fc77-4a41-8b08-f709bd6ac771"); // Maria Eduarda

  // Deletar da auth
  try {
    await admin.auth.admin.deleteUser("c410ae67-4fd0-4d5b-925e-45235a95a984");
    console.log("Usuário c410ae67 excluído do auth");
  } catch (e) {
    console.log("Aviso ao excluir c410ae67:", e);
  }

  try {
    await admin.auth.admin.deleteUser("2f860c0f-fc77-4a41-8b08-f709bd6ac771");
    console.log("Usuário Maria Eduarda excluído do auth");
  } catch (e) {
    console.log("Aviso ao excluir Maria Eduarda:", e);
  }

  // 2. Criar Admin Oficial via Admin API
  console.log("\n=== CRIANDO ADMIN OFICIAL VIA SUPABASE API ===");
  const { data: newAdmin, error: adminErr } = await admin.auth.admin.createUser({
    email: "admin@speakup.com",
    password: "admin123",
    email_confirm: true,
    user_metadata: { nome: "Administrador Geral" },
  });

  if (adminErr) {
    console.error("Erro ao recriar admin:", adminErr);
  } else {
    console.log("✅ Admin criado via API com ID:", newAdmin.user.id);
    await admin.from("profiles").upsert({
      id: newAdmin.user.id,
      papel: "teacher",
      nome: "Administrador Geral",
    });
    console.log("✅ Perfil do Admin salvo!");
  }

  // 3. Criar Professora Maria Eduarda via Admin API
  console.log("\n=== CRIANDO PROFESSORA MARIA EDUARDA VIA SUPABASE API ===");
  const { data: newProf, error: profErr } = await admin.auth.admin.createUser({
    email: "maria@escola.com",
    password: "senha123",
    email_confirm: true,
    user_metadata: { nome: "Maria Eduarda" },
  });

  if (profErr) {
    console.error("Erro ao recriar Maria Eduarda:", profErr);
  } else {
    console.log("✅ Maria Eduarda criada via API com ID:", newProf.user.id);
    await admin.from("profiles").upsert({
      id: newProf.user.id,
      papel: "teacher",
      nome: "Maria Eduarda",
    });
    // Atualizar turma TURMB2 para apontar para o novo ID
    await admin.from("turmas").update({ professor_id: newProf.user.id }).eq("codigo", "TURMB2");
    console.log("✅ Turma TURMB2 atualizada com o novo professor_id!");
  }
}

fixUsers().catch(console.error);

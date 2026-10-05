import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seedAll() {
  console.log("=== POPULANDO SISTEMA COM USUÁRIOS OFICIAIS ===");

  // 1. Criar Administrador
  console.log("\n1. Criando Administrador (admin@speakup.com)...");
  const { data: aData, error: aErr } = await admin.auth.admin.createUser({
    email: "admin@speakup.com",
    password: "admin123",
    email_confirm: true,
    user_metadata: { nome: "Administrador Geral" },
  });
  if (aErr) console.error("Erro no admin:", aErr.message);
  else {
    await admin.from("profiles").upsert({ id: aData.user.id, papel: "teacher", nome: "Administrador Geral" });
    console.log("✅ Admin criado! ID:", aData.user.id);
  }

  // 2. Criar Professor Demo
  console.log("\n2. Criando Professor Demo (professor@demo.com)...");
  const { data: pData, error: pErr } = await admin.auth.admin.createUser({
    email: "professor@demo.com",
    password: "password123",
    email_confirm: true,
    user_metadata: { nome: "Professor Demo" },
  });
  let profDemoId = pData?.user?.id;
  if (pErr) console.error("Erro no professor demo:", pErr.message);
  else {
    await admin.from("profiles").upsert({ id: profDemoId, papel: "teacher", nome: "Professor Demo" });
    console.log("✅ Professor Demo criado! ID:", profDemoId);
  }

  // 3. Criar Professora Maria Eduarda
  console.log("\n3. Criando Professora Maria Eduarda (maria@escola.com)...");
  const { data: mData, error: mErr } = await admin.auth.admin.createUser({
    email: "maria@escola.com",
    password: "senha123",
    email_confirm: true,
    user_metadata: { nome: "Maria Eduarda" },
  });
  let mariaId = mData?.user?.id;
  if (mErr) console.error("Erro na Maria Eduarda:", mErr.message);
  else {
    await admin.from("profiles").upsert({ id: mariaId, papel: "teacher", nome: "Maria Eduarda" });
    console.log("✅ Maria Eduarda criada! ID:", mariaId);
  }

  // 4. Criar Turmas
  console.log("\n4. Criando Turmas DEMO01 e TURMB2...");
  const { data: t1 } = await admin
    .from("turmas")
    .upsert({ nome: "Turma A1 - Iniciante", codigo: "DEMO01", professor_id: profDemoId })
    .select().single();

  const { data: t2 } = await admin
    .from("turmas")
    .upsert({ nome: "Turma B - Vespertino", codigo: "TURMB2", professor_id: mariaId })
    .select().single();

  console.log("✅ Turmas salvas:", t1?.codigo, t2?.codigo);

  // 5. Criar Alunos
  const alunosParaCriar = [
    { nome: "Lucas Silva", pin: "123456", turma_id: t1?.id },
    { nome: "Pedro Henrique", pin: "112233", turma_id: t2?.id },
    { nome: "Ana Clara", pin: "445566", turma_id: t2?.id },
    { nome: "Gabriel Souza", pin: "778899", turma_id: t2?.id },
  ];

  console.log("\n5. Criando Alunos com PINs...");
  for (const a of alunosParaCriar) {
    if (!a.turma_id) continue;
    const tempEmail = `aluno-temp-${Date.now()}-${Math.random()}@speakup.local`;
    const { data: uData, error: uErr } = await admin.auth.admin.createUser({
      email: tempEmail,
      password: a.pin,
      email_confirm: true,
      user_metadata: { nome: a.nome },
    });

    if (uErr) {
      console.error(`Erro ao criar ${a.nome}:`, uErr.message);
      continue;
    }

    const alunoId = uData.user.id;
    const syntheticEmail = `aluno-${alunoId}@speakup.local`;
    await admin.auth.admin.updateUserById(alunoId, { email: syntheticEmail });
    await admin.from("profiles").upsert({ id: alunoId, papel: "student", nome: a.nome });
    await admin.from("turma_alunos").upsert({ turma_id: a.turma_id, aluno_id: alunoId });

    console.log(`✅ Aluno ${a.nome} (PIN: ${a.pin}) criado com sucesso!`);
  }

  console.log("\n🎉 CONCLUÍDO! Todos os usuários oficiais foram criados perfeitamente!");
}

seedAll().catch(console.error);

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("=== CRIANDO USUÁRIOS OFICIAIS NO SUPABASE VIA API ===");

  // 1. Criar Professor
  console.log("\n1. Criando Professor (professor@demo.com)...");
  const { data: profData, error: profErr } = await admin.auth.admin.createUser({
    email: "professor@demo.com",
    password: "password123",
    email_confirm: true,
    user_metadata: { nome: "Professor Demo" },
  });

  if (profErr) {
    console.error("❌ Erro ao criar professor:", profErr.message);
    return;
  }

  const profId = profData.user.id;
  console.log("✅ Professor criado no Auth com ID:", profId);

  // Perfil do Professor
  const { error: profProfErr } = await admin.from("profiles").upsert({
    id: profId,
    papel: "teacher",
    nome: "Professor Demo",
  });
  if (profProfErr) console.error("Erro no perfil do professor:", profProfErr);
  else console.log("✅ Perfil do professor salvo!");

  // 2. Criar Turma DEMO01 vinculada ao professor
  console.log("\n2. Criando Turma DEMO01...");
  const { data: turmaData, error: turmaErr } = await admin
    .from("turmas")
    .upsert({
      professor_id: profId,
      nome: "Turma A1 - Iniciante",
      codigo: "DEMO01",
    })
    .select()
    .single();

  if (turmaErr) {
    console.error("Erro ao criar turma:", turmaErr);
    return;
  }
  const turmaId = turmaData.id;
  console.log("✅ Turma DEMO01 criada com ID:", turmaId);

  // 3. Criar Aluno Lucas Silva
  console.log("\n3. Criando Aluno Lucas Silva (PIN: 123456)...");
  const { data: alunoData, error: alunoErr } = await admin.auth.admin.createUser({
    email: "aluno-temp@speakup.local",
    password: "123456",
    email_confirm: true,
    user_metadata: { nome: "Lucas Silva" },
  });

  if (alunoErr) {
    console.error("❌ Erro ao criar aluno:", alunoErr.message);
    return;
  }

  const alunoId = alunoData.user.id;
  const realSyntheticEmail = `aluno-${alunoId}@speakup.local`;

  // Atualizar email sintético com o UUID real gerado
  await admin.auth.admin.updateUserById(alunoId, { email: realSyntheticEmail });
  console.log(`✅ Aluno criado no Auth com ID: ${alunoId} (${realSyntheticEmail})`);

  // Perfil do Aluno
  await admin.from("profiles").upsert({
    id: alunoId,
    papel: "student",
    nome: "Lucas Silva",
  });
  console.log("✅ Perfil do aluno salvo!");

  // Matrícula na turma
  await admin.from("turma_alunos").upsert({
    turma_id: turmaId,
    aluno_id: alunoId,
  });
  console.log("✅ Aluno matriculado na turma DEMO01!");

  console.log("\n🎉 SUCESSO! Todos os usuários foram criados corretamente!");
}

main().catch(console.error);

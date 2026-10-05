import { createAdminClient } from "../lib/supabase/admin";

async function testDados() {
  const admin = createAdminClient();

  console.log("Step 1: Profiles");
  const { data: profProfiles, error: profError } = await admin
    .from("profiles")
    .select("id, nome, papel, created_at")
    .eq("papel", "teacher")
    .order("created_at", { ascending: false });

  if (profError) {
    console.error("profError:", profError);
    return;
  }
  console.log("profProfiles:", profProfiles?.length);

  console.log("Step 2: Auth Users");
  let authUsers = null;
  try {
    const res = await admin.auth.admin.listUsers({ perPage: 1000 });
    authUsers = res.data;
  } catch (err) {
    console.warn("listUsers falhou mas continua sem quebrar");
  }
  console.log("authUsers:", authUsers?.users?.length);

  console.log("Step 3: Turmas");
  const { data: turmasData, error: turmasError } = await admin
    .from("turmas")
    .select(`
      id,
      nome,
      codigo,
      created_at,
      professor_id,
      professor:profiles!turmas_professor_id_fkey(id, nome)
    `)
    .order("created_at", { ascending: false });

  if (turmasError) {
    console.error("turmasError:", turmasError);
    return;
  }
  console.log("turmasData:", turmasData?.length);

  console.log("Step 4: Matriculas");
  const { data: matriculas, error: matError } = await admin
    .from("turma_alunos")
    .select(`
      turma:turmas(id, nome, codigo),
      aluno:profiles!turma_alunos_aluno_id_fkey(id, nome, created_at)
    `);

  if (matError) {
    console.error("matError:", matError);
    return;
  }
  console.log("matriculas:", matriculas?.length);

  console.log("ALL STEPS SUCCEEDED!");
}

testDados().catch(console.error);

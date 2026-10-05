import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const admin = createAdminClient();

    // 1. Buscar Professores e Admins
    const { data: profProfiles, error: profError } = await admin
      .from("profiles")
      .select("id, nome, papel, created_at")
      .eq("papel", "teacher")
      .order("created_at", { ascending: false });

    if (profError) throw profError;

    // Buscar emails do auth.users (tolerante a falhas)
    let userEmailMap = new Map<string, string>();
    try {
      const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
      if (authUsers?.users) {
        userEmailMap = new Map(authUsers.users.map((u) => [u.id, u.email || ""]));
      }
    } catch (e) {
      console.warn("Aviso ao buscar emails do Auth:", e);
    }

    const professores = (profProfiles || []).map((p) => ({
      id: p.id,
      nome: p.nome,
      papel: p.papel,
      email: userEmailMap.get(p.id) || "Email cadastrado",
      created_at: p.created_at,
    }));

    // 2. Buscar Turmas com dados do Professor e contagem de Alunos
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

    if (turmasError) throw turmasError;

    // Contar alunos por turma
    const { data: vinculosAlunos } = await admin.from("turma_alunos").select("turma_id, aluno_id");
    const countAlunosPorTurma = new Map<string, number>();
    vinculosAlunos?.forEach((v) => {
      countAlunosPorTurma.set(v.turma_id, (countAlunosPorTurma.get(v.turma_id) || 0) + 1);
    });

    const turmas = (turmasData || []).map((t) => {
      const prof = Array.isArray(t.professor) ? t.professor[0] : t.professor;
      return {
        id: t.id,
        nome: t.nome,
        codigo: t.codigo,
        professor_id: t.professor_id,
        professor_nome: prof?.nome || "Sem professor vinculado",
        total_alunos: countAlunosPorTurma.get(t.id) || 0,
        created_at: t.created_at,
      };
    });

    // 3. Buscar Alunos matriculados
    const { data: matriculas, error: matError } = await admin
      .from("turma_alunos")
      .select(`
        turma:turmas(id, nome, codigo),
        aluno:profiles!turma_alunos_aluno_id_fkey(id, nome, created_at)
      `);

    if (matError) throw matError;

    const alunos = (matriculas || []).map((m) => {
      const t = Array.isArray(m.turma) ? m.turma[0] : m.turma;
      const a = Array.isArray(m.aluno) ? m.aluno[0] : m.aluno;
      return {
        id: a?.id,
        nome: a?.nome || "Aluno",
        turma_id: t?.id,
        turma_nome: t?.nome || "Sem turma",
        turma_codigo: t?.codigo || "N/A",
        created_at: a?.created_at,
      };
    }).sort((a, b) => a.nome.localeCompare(b.nome));

    return NextResponse.json({
      professores,
      turmas,
      alunos,
    });
  } catch (error: unknown) {
    console.error("Erro ao carregar dados administrativos:", error);
    return NextResponse.json(
      { error: "Falha ao carregar dados do painel administrativo." },
      { status: 500 }
    );
  }
}

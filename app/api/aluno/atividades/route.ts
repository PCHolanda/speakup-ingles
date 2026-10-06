import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const admin = createAdminClient();

    // 1. Buscar perfil do aluno
    const { data: profile } = await admin
      .from("profiles")
      .select("id, nome, papel")
      .eq("id", user.id)
      .single();

    // 2. Buscar turma do aluno
    const { data: vinculo } = await admin
      .from("turma_alunos")
      .select("turma_id")
      .eq("aluno_id", user.id)
      .maybeSingle();

    let turmaInfo = null;
    if (vinculo) {
      const { data: turma } = await admin
        .from("turmas")
        .select("id, nome, codigo")
        .eq("id", vinculo.turma_id)
        .single();
      turmaInfo = turma;
    }

    // 3. Buscar atividades publicadas (atividades padrão e da turma)
    const { data: atividades } = await admin
      .from("atividades")
      .select("id, titulo, nivel, publicada, created_at")
      .eq("publicada", true)
      .order("created_at", { ascending: true });

    // 4. Buscar total de perguntas de cada atividade
    const atividadesComDetalhes = await Promise.all(
      (atividades || []).map(async (ativ) => {
        const { count } = await admin
          .from("perguntas")
          .select("*", { count: "exact", head: true })
          .eq("atividade_id", ativ.id);

        // Verificar se aluno já concluiu sessão nesta atividade
        const { data: sessao } = await admin
          .from("sessoes")
          .select("id, concluida_em")
          .eq("aluno_id", user.id)
          .eq("atividade_id", ativ.id)
          .maybeSingle();

        return {
          ...ativ,
          total_perguntas: count || 0,
          concluida: !!sessao?.concluida_em,
          sessao_id: sessao?.id || null,
        };
      })
    );

    return NextResponse.json({
      aluno: profile || { id: user.id, nome: user.user_metadata?.nome || "Aluno" },
      turma: turmaInfo,
      atividades: atividadesComDetalhes,
    });
  } catch (error: unknown) {
    console.error("Erro ao buscar atividades do aluno:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor ao carregar atividades." },
      { status: 500 }
    );
  }
}

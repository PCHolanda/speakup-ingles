import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const admin = createAdminClient();

    // 1. Buscar atividade
    const { data: atividade, error: ativError } = await admin
      .from("atividades")
      .select("id, titulo, nivel, publicada")
      .eq("id", id)
      .single();

    if (ativError || !atividade) {
      return NextResponse.json({ error: "Atividade não encontrada" }, { status: 404 });
    }

    // 2. Buscar perguntas da atividade
    const { data: perguntas, error: pergError } = await admin
      .from("perguntas")
      .select("id, secao, ordem, tipo, enunciado, instrucao_pt, dicas, imagem_path")
      .eq("atividade_id", id)
      .order("ordem", { ascending: true });

    if (pergError) {
      return NextResponse.json({ error: "Erro ao buscar perguntas" }, { status: 500 });
    }

    // 3. Registrar ou buscar sessão
    let sessaoId = null;
    const { data: turmaVinculo } = await admin
      .from("turma_alunos")
      .select("turma_id")
      .eq("aluno_id", user.id)
      .maybeSingle();

    if (turmaVinculo?.turma_id) {
      const { data: sessaoExistente } = await admin
        .from("sessoes")
        .select("id")
        .eq("aluno_id", user.id)
        .eq("atividade_id", id)
        .maybeSingle();

      if (sessaoExistente) {
        sessaoId = sessaoExistente.id;
      } else {
        const { data: novaSessao } = await admin
          .from("sessoes")
          .insert({
            aluno_id: user.id,
            turma_id: turmaVinculo.turma_id,
            atividade_id: id,
          })
          .select("id")
          .single();
        sessaoId = novaSessao?.id;
      }
    }

    return NextResponse.json({
      atividade,
      sessaoId,
      perguntas: perguntas || [],
    });
  } catch (error: unknown) {
    console.error("Erro ao carregar detalhes da atividade:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor ao carregar atividade." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  gerarAvaliacaoGeralFinalIA,
  type ItemResumoQuestao,
} from "@/lib/pronuncia/avaliacao-geral";

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: atividadeId } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const sessaoId: string | null = body.sessaoId || null;
    const tituloAtividade = String(body.tituloAtividade || "Avaliação Oral");
    const nivelAtividade = String(body.nivelAtividade || "A1");
    const totalPerguntas = Number(body.totalPerguntas) || 10;
    const itens: ItemResumoQuestao[] = Array.isArray(body.itens) ? body.itens : [];

    const admin = createAdminClient();
    let turmaId: string | null = null;

    if (sessaoId) {
      const { data: sessao } = await admin
        .from("sessoes")
        .select("turma_id")
        .eq("id", sessaoId)
        .maybeSingle();
      turmaId = sessao?.turma_id || null;
    }

    const avaliacaoGeral = await gerarAvaliacaoGeralFinalIA({
      alunoId: user.id,
      turmaId,
      tituloAtividade,
      nivelAtividade,
      totalPerguntas,
      itens,
    });

    // Marcar sessão como concluída e salvar avaliação geral
    if (sessaoId) {
      const agora = new Date().toISOString();
      const { error: errComColuna } = await admin
        .from("sessoes")
        .update({
          concluida_em: agora,
          avaliacao_geral: avaliacaoGeral,
        })
        .eq("id", sessaoId);

      if (errComColuna) {
        // Fallback caso a coluna avaliacao_geral ainda não tenha sido criada no banco
        await admin
          .from("sessoes")
          .update({ concluida_em: agora })
          .eq("id", sessaoId);
      }
    } else {
      // Caso sessaoId não tenha vindo no body, buscar sessão do aluno nesta atividade
      const { data: sessaoAluno } = await admin
        .from("sessoes")
        .select("id")
        .eq("aluno_id", user.id)
        .eq("atividade_id", atividadeId)
        .maybeSingle();

      if (sessaoAluno?.id) {
        await admin
          .from("sessoes")
          .update({ concluida_em: new Date().toISOString() })
          .eq("id", sessaoAluno.id);
      }
    }

    return NextResponse.json({ avaliacaoGeral });
  } catch (error: any) {
    console.error("Erro ao gerar avaliação geral final:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao gerar avaliação geral final." },
      { status: 500 }
    );
  }
}

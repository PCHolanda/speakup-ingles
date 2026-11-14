import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const INSTRUCOES_FRASE_COMPLETA: Record<string, { instrucao_pt: string; dicas: string[] }> = {
  "b0000000-0000-0000-0000-000000000001": {
    instrucao_pt: 'Responda em inglês com uma frase completa dizendo o seu nome (ex.: "My name is...").',
    dicas: ["Responda com frase completa. You can say: My name is…"],
  },
  "b0000000-0000-0000-0000-000000000002": {
    instrucao_pt: 'Responda em inglês com uma frase completa dizendo a sua idade (ex.: "I am ... years old").',
    dicas: ["Responda com frase completa. You can say: I am … years old."],
  },
  "b0000000-0000-0000-0000-000000000003": {
    instrucao_pt: 'Responda em inglês com uma frase completa dizendo de onde você é, país ou cidade (ex.: "I am from...").',
    dicas: ["Responda com frase completa. You can say: I'm from…"],
  },
  "b0000000-0000-0000-0000-000000000004": {
    instrucao_pt: 'Responda em inglês com uma frase completa dizendo se você tem irmãos ou irmãs (ex.: "Yes, I have..." ou "No, I don\'t").',
    dicas: ["Responda com frase completa. You can say: Yes, I have… or No, I don't."],
  },
  "b0000000-0000-0000-0000-000000000005": {
    instrucao_pt: 'Responda em inglês com uma frase completa dizendo o horário em que você costuma acordar (ex.: "I wake up at...").',
    dicas: ["Responda com frase completa. You can say: I wake up at…"],
  },
  "b0000000-0000-0000-0000-000000000006": {
    instrucao_pt: 'Responda em inglês com uma frase completa contando uma ou mais coisas que você faz pela manhã (ex.: "In the morning, I...").',
    dicas: ["Responda com frase completa. You can say: In the morning, I…", "Think about breakfast, school, teeth…"],
  },
  "b0000000-0000-0000-0000-000000000007": {
    instrucao_pt: 'Olhe a imagem e responda em inglês com uma frase completa dizendo que animal é este (ex.: "It is a...").',
    dicas: ["Responda com frase completa. You can say: It is a…"],
  },
  "b0000000-0000-0000-0000-000000000008": {
    instrucao_pt: 'Olhe a imagem e responda em inglês com uma frase completa dizendo a cor do gato (ex.: "The cat is...").',
    dicas: ["Responda com frase completa. You can say: The cat is…"],
  },
  "b0000000-0000-0000-0000-000000000009": {
    instrucao_pt: 'Olhe a imagem e responda em inglês com uma frase completa dizendo onde o gato está em relação à caixa (ex.: "The cat is on/in the box").',
    dicas: ["Responda com frase completa. You can say: The cat is on/in…"],
  },
  "b0000000-0000-0000-0000-000000000010": {
    instrucao_pt: 'Responda em inglês com frases completas explicando o que muda entre o lado esquerdo e o lado direito (ex.: "On the left, X is..., but on the right, it is...").',
    dicas: ["Responda com frase completa (ex.: On the left, the cat is…, but on the right, it is…). Look at the cat, the box, and the sky."],
  },
};

function normalizarPerguntaFraseCompleta<
  T extends { id: string; instrucao_pt: string | null; dicas: string[] | null }
>(p: T): T {
  const padrao = INSTRUCOES_FRASE_COMPLETA[p.id];
  if (padrao) {
    return {
      ...p,
      instrucao_pt: padrao.instrucao_pt,
      dicas: padrao.dicas,
    };
  }

  let instrucao = (p.instrucao_pt || "").trim();
  if (!instrucao) {
    instrucao = "Responda em inglês usando uma frase completa.";
  } else if (!/frases?\s+completas?/i.test(instrucao)) {
    const semPonto = instrucao.replace(/\.+$/, "");
    instrucao = `${semPonto} (responda usando uma frase completa em inglês).`;
  }

  const dicasNormalizadas = (p.dicas || []).map((d) =>
    /frases?\s+completas?/i.test(d) ? d : `Responda com frase completa. ${d}`
  );

  return {
    ...p,
    instrucao_pt: instrucao,
    dicas: dicasNormalizadas.length > 0 ? dicasNormalizadas : p.dicas,
  };
}

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
      perguntas: (perguntas || []).map(normalizarPerguntaFraseCompleta),
    });
  } catch (error: unknown) {
    console.error("Erro ao carregar detalhes da atividade:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor ao carregar atividade." },
      { status: 500 }
    );
  }
}

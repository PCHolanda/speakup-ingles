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

function resolverStorageUrl(rawPath?: string | null): string | null {
  if (!rawPath) return null;
  const limpo = rawPath.trim();
  if (!limpo) return null;
  if (limpo.startsWith("http://") || limpo.startsWith("https://") || limpo.startsWith("/")) {
    return limpo;
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl && (limpo.startsWith("modelos-professor/") || limpo.startsWith("imagens-questoes/"))) {
    return `${supabaseUrl}/storage/v1/object/public/atividades/${limpo}`;
  }
  return `/seed/${limpo}`;
}

function normalizarPerguntaParaAluno(p: any) {
  const gab = p.gabarito && typeof p.gabarito === "object" ? p.gabarito : {};
  const padrao = INSTRUCOES_FRASE_COMPLETA[p.id];

  let instrucao = (p.instrucao_pt || "").trim();
  if (padrao && !/frases?\s+completas?\s+dizendo|frases?\s+completas?\s+explicando|frases?\s+completas?\s+contando/i.test(instrucao)) {
    instrucao = padrao.instrucao_pt;
  } else if (!instrucao) {
    instrucao = "Responda em inglês usando uma frase completa.";
  } else if (!/frases?\s+completas?/i.test(instrucao)) {
    const semPonto = instrucao.replace(/\.+$/, "");
    instrucao = `${semPonto} (responda usando uma frase completa em inglês).`;
  }

  let dicas = Array.isArray(p.dicas) ? p.dicas : [];
  if (padrao && !dicas.some((d: string) => /frases?\s+completas?/i.test(d))) {
    dicas = padrao.dicas;
  } else {
    dicas = dicas.map((d: string) =>
      /frases?\s+completas?/i.test(d) ? d : `Responda com frase completa. ${d}`
    );
  }

  const tempoRaw = Number(p.tempo_gravacao_s ?? gab.tempo_gravacao_s ?? (p.tipo === "comparacao" ? 20 : 10));
  const tempoGravacaoS: 5 | 10 | 20 = tempoRaw === 5 ? 5 : tempoRaw === 20 ? 20 : 10;

  const audioProfPath: string | null =
    p.audio_modelo_professor_path ?? gab.audio_modelo_professor_path ?? null;

  const temImagem =
    gab.tem_imagem !== undefined
      ? Boolean(gab.tem_imagem && p.imagem_path)
      : Boolean(p.imagem_path && p.tipo !== "oral");

  return {
    id: p.id,
    secao: p.secao,
    ordem: p.ordem,
    tipo: temImagem ? p.tipo : "oral",
    tem_imagem: temImagem,
    enunciado: p.enunciado,
    instrucao_pt: instrucao,
    dicas,
    imagem_path: temImagem ? p.imagem_path : null,
    respostas_esperadas: Array.isArray(p.respostas_esperadas) ? p.respostas_esperadas : [],
    tempo_gravacao_s: tempoGravacaoS,
    audio_modelo_professor_url: audioProfPath ? resolverStorageUrl(audioProfPath) : null,
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

    // 2. Buscar perguntas da atividade (incluindo gabarito e colunas extras)
    const { data: perguntas, error: pergError } = await admin
      .from("perguntas")
      .select("*")
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
      perguntas: (perguntas || []).map(normalizarPerguntaParaAluno),
    });
  } catch (error: unknown) {
    console.error("Erro ao carregar detalhes da atividade:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor ao carregar atividade." },
      { status: 500 }
    );
  }
}

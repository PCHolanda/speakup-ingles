import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decodificarWav } from "@/lib/audio/wav";
import { avaliarQualidade } from "@/lib/audio/qualidade";
import { analisarPronuncia, ConfigIAAusenteError } from "@/lib/pronuncia/analisar";

export const maxDuration = 60;

const MAX_BYTES = 2 * 1024 * 1024; // ~60s de WAV 16 kHz mono; o limite de 15s é checado pela qualidade

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const camposSchema = z.object({
  sessao_id: z.string().trim().regex(uuidRegex, "Sessão inválida"),
  pergunta_id: z.string().trim().regex(uuidRegex, "Pergunta inválida"),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const form = await request.formData();
    const sessaoIdRaw = form.get("sessao_id");
    const perguntaIdRaw = form.get("pergunta_id");
    const audioRaw = form.get("audio");

    const campos = camposSchema.safeParse({
      sessao_id: typeof sessaoIdRaw === "string" ? sessaoIdRaw.trim() : sessaoIdRaw,
      pergunta_id: typeof perguntaIdRaw === "string" ? perguntaIdRaw.trim() : perguntaIdRaw,
    });
    if (!campos.success) {
      console.warn("[analisar] Falha na validação dos campos:", {
        sessaoIdRaw,
        perguntaIdRaw,
        erros: campos.error.issues,
      });
      return NextResponse.json(
        { error: `Dados da requisição inválidos: ${campos.error.issues[0]?.message}` },
        { status: 400 }
      );
    }
    const { sessao_id, pergunta_id } = campos.data;

    if (!audioRaw || typeof audioRaw === "string") {
      console.warn("[analisar] Áudio ausente ou inválido:", typeof audioRaw);
      return NextResponse.json({ error: "Arquivo de áudio não foi enviado." }, { status: 400 });
    }

    const audio = audioRaw as Blob;
    const tamanho = typeof audio.size === "number" ? audio.size : 0;
    if (tamanho === 0) {
      console.warn("[analisar] Áudio com tamanho 0");
      return NextResponse.json({ error: "O arquivo de áudio enviado está vazio." }, { status: 400 });
    }
    if (tamanho > MAX_BYTES) {
      return NextResponse.json({ error: "Áudio grande demais." }, { status: 413 });
    }

    const admin = createAdminClient();

    // A sessão precisa ser do próprio aluno, e a pergunta, da atividade da sessão
    const { data: sessao } = await admin
      .from("sessoes")
      .select("id, aluno_id, atividade_id")
      .eq("id", sessao_id)
      .maybeSingle();
    if (!sessao || sessao.aluno_id !== user.id) {
      return NextResponse.json({ error: "Sessão não encontrada." }, { status: 403 });
    }

    const { data: pergunta } = await admin
      .from("perguntas")
      .select("id, atividade_id, enunciado, instrucao_pt, respostas_esperadas, texto_referencia, foco_avaliacao, tipo, imagem_path, gabarito")
      .eq("id", pergunta_id)
      .maybeSingle();
    if (!pergunta || pergunta.atividade_id !== sessao.atividade_id) {
      return NextResponse.json({ error: "Pergunta não encontrada." }, { status: 404 });
    }

    // Controle de qualidade no servidor (não confiar só no navegador)
    const bytes = new Uint8Array(await audio.arrayBuffer());
    let qualidade;
    try {
      const { amostras, sampleRate } = decodificarWav(bytes);
      qualidade = avaliarQualidade(amostras, sampleRate);
    } catch {
      return NextResponse.json({ error: "Formato de áudio inválido (esperado WAV)." }, { status: 415 });
    }
    if (!qualidade.ok) {
      return NextResponse.json(
        { error: qualidade.mensagem, motivo: qualidade.motivo, qualidade: qualidade.metricas },
        { status: 422 }
      );
    }

    // Análise com IA
    const analise = await analisarPronuncia(bytes, {
      enunciado: pergunta.enunciado,
      instrucao_pt: pergunta.instrucao_pt,
      respostas_esperadas: pergunta.respostas_esperadas,
      texto_referencia: pergunta.texto_referencia,
      foco_avaliacao: pergunta.foco_avaliacao,
      tipo: pergunta.tipo,
      imagem_path: pergunta.imagem_path,
    });

    // Salvar áudio + análise para o professor (falha aqui não impede o feedback ao aluno)
    let salvo = false;
    try {
      const { data: anteriores } = await admin
        .from("respostas")
        .select("id, tentativa")
        .eq("sessao_id", sessao_id)
        .eq("pergunta_id", pergunta_id)
        .order("tentativa", { ascending: true });

      const tentativa = Math.min((anteriores?.length ?? 0) + 1, 2);
      const audioPath = `${user.id}/${sessao_id}/${pergunta_id}-t${tentativa}-${Date.now()}.wav`;

      const { error: upErr } = await admin.storage
        .from("respostas")
        .upload(audioPath, bytes, { contentType: "audio/wav", upsert: false });
      if (upErr) throw upErr;

      const linha = {
        sessao_id,
        pergunta_id,
        tentativa,
        audio_path: audioPath,
        transcricao: analise.transcricao,
        metricas: {
          qualidade: qualidade.metricas,
          modelo: process.env.GEMINI_MODEL || "gemini-flash-latest",
          ...(analise.analise_detalhada ? { analise_detalhada: analise.analise_detalhada } : {}),
        },
        nota_pronuncia: analise.nota_pronuncia,
        nota_vocabulario: analise.nota_vocabulario,
        nota_fluencia: analise.nota_fluencia,
        nota_estrutura: analise.nota_estrutura,
        resultado: analise.resultado,
        feedback: {
          ponto_forte: analise.ponto_forte,
          ponto_melhorar: analise.ponto_melhorar,
          palavras: analise.palavras,
          frase_modelo: analise.frase_modelo,
          respondeu_pergunta: analise.respondeu_pergunta,
          ...(analise.analise_detalhada ? { analise_detalhada: analise.analise_detalhada } : {}),
        },
        revisado: false,
      };

      // A tabela aceita no máximo 2 tentativas: a partir da 3ª, sobrescreve a 2ª
      const existente = anteriores?.find((r) => r.tentativa === tentativa);
      const { error: dbErr } = existente
        ? await admin.from("respostas").update(linha).eq("id", existente.id)
        : await admin.from("respostas").insert(linha);
      if (dbErr) throw dbErr;
      salvo = true;
    } catch (e) {
      console.error("Falha ao salvar resposta analisada:", e);
    }

    return NextResponse.json({ analise, salvo });
  } catch (error: unknown) {
    if (error instanceof ConfigIAAusenteError) {
      return NextResponse.json(
        { error: "A análise de pronúncia ainda não está configurada. Avise seu professor." },
        { status: 503 }
      );
    }
    console.error("Erro ao analisar pronúncia:", error);
    return NextResponse.json(
      { error: "Não conseguimos analisar agora. Tente de novo em instantes." },
      { status: 500 }
    );
  }
}

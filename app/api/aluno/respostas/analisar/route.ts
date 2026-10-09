import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decodificarWav } from "@/lib/audio/wav";
import { avaliarQualidade } from "@/lib/audio/qualidade";
import { analisarPronuncia, ConfigIAAusenteError } from "@/lib/pronuncia/analisar";

export const maxDuration = 60;

const MAX_BYTES = 2 * 1024 * 1024; // ~60s de WAV 16 kHz mono; o limite de 15s é checado pela qualidade

const camposSchema = z.object({
  sessao_id: z.string().uuid("Sessão inválida"),
  pergunta_id: z.string().uuid("Pergunta inválida"),
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
    const campos = camposSchema.safeParse({
      sessao_id: form.get("sessao_id"),
      pergunta_id: form.get("pergunta_id"),
    });
    if (!campos.success) {
      return NextResponse.json({ error: campos.error.issues[0]?.message }, { status: 400 });
    }
    const { sessao_id, pergunta_id } = campos.data;

    const audio = form.get("audio");
    if (!(audio instanceof Blob) || audio.size === 0) {
      return NextResponse.json({ error: "Áudio não enviado." }, { status: 400 });
    }
    if (audio.size > MAX_BYTES) {
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
      .select("id, atividade_id, enunciado, instrucao_pt, respostas_esperadas, texto_referencia, foco_avaliacao")
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
    const analise = await analisarPronuncia(bytes, pergunta);

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
        metricas: { qualidade: qualidade.metricas, modelo: process.env.GEMINI_MODEL || "gemini-flash-latest" },
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

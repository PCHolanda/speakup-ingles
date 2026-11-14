import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function garantirBucketAtividades(admin: ReturnType<typeof createAdminClient>) {
  try {
    const { data: buckets } = await admin.storage.listBuckets();
    const existe = buckets?.some((b) => b.name === "atividades");
    if (!existe) {
      await admin.storage.createBucket("atividades", { public: true });
    }
  } catch {
    // Ignorar se já existir
  }
}

async function extrairPayload(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const parseArray = (val: FormDataEntryValue | null): string[] => {
      if (!val) return [];
      const str = String(val).trim();
      if (!str) return [];
      try {
        const parsed = JSON.parse(str);
        if (Array.isArray(parsed)) return parsed.map((s) => String(s).trim()).filter(Boolean);
      } catch {
        // Fallback: split por linha ou ponto-e-vírgula
      }
      return str
        .split(/\r?\n|;/)
        .map((s) => s.trim())
        .filter(Boolean);
    };

    const imagemFile = form.get("imagem_file");
    const audioProfessorFile = form.get("audio_professor_file");

    return {
      id: form.get("id") ? String(form.get("id")).trim() : undefined,
      atividade_id: form.get("atividade_id") ? String(form.get("atividade_id")).trim() : undefined,
      secao: form.get("secao") ? String(form.get("secao")).trim() : undefined,
      ordem: form.get("ordem") ? Number(form.get("ordem")) : undefined,
      tem_imagem: form.get("tem_imagem") !== null ? String(form.get("tem_imagem")) === "true" : undefined,
      tipo: form.get("tipo") ? (String(form.get("tipo")).trim() as "oral" | "imagem" | "comparacao") : undefined,
      enunciado: form.get("enunciado") ? String(form.get("enunciado")).trim() : undefined,
      instrucao_pt: form.get("instrucao_pt") !== null ? String(form.get("instrucao_pt")).trim() : undefined,
      imagem_path: form.get("imagem_path") !== null ? String(form.get("imagem_path")).trim() : undefined,
      respostas_esperadas: form.get("respostas_esperadas") !== null ? parseArray(form.get("respostas_esperadas")) : undefined,
      foco_avaliacao: form.get("foco_avaliacao") !== null ? parseArray(form.get("foco_avaliacao")) : undefined,
      dicas: form.get("dicas") !== null ? parseArray(form.get("dicas")) : undefined,
      tempo_gravacao_s: form.get("tempo_gravacao_s") ? Number(form.get("tempo_gravacao_s")) : undefined,
      remover_audio_professor: form.get("remover_audio_professor") === "true",
      imagemFile: imagemFile instanceof File && imagemFile.size > 0 ? imagemFile : null,
      audioProfessorFile: audioProfessorFile instanceof File && audioProfessorFile.size > 0 ? audioProfessorFile : null,
    };
  }

  const json = await request.json();
  return {
    id: json.id ? String(json.id).trim() : undefined,
    atividade_id: json.atividade_id ? String(json.atividade_id).trim() : undefined,
    secao: json.secao ? String(json.secao).trim() : undefined,
    ordem: json.ordem !== undefined ? Number(json.ordem) : undefined,
    tem_imagem: json.tem_imagem !== undefined ? Boolean(json.tem_imagem) : undefined,
    tipo: json.tipo as "oral" | "imagem" | "comparacao" | undefined,
    enunciado: json.enunciado ? String(json.enunciado).trim() : undefined,
    instrucao_pt: json.instrucao_pt !== undefined ? String(json.instrucao_pt).trim() : undefined,
    imagem_path: json.imagem_path !== undefined ? (json.imagem_path ? String(json.imagem_path).trim() : null) : undefined,
    respostas_esperadas: Array.isArray(json.respostas_esperadas)
      ? json.respostas_esperadas.map((s: any) => String(s).trim()).filter(Boolean)
      : undefined,
    foco_avaliacao: Array.isArray(json.foco_avaliacao)
      ? json.foco_avaliacao.map((s: any) => String(s).trim()).filter(Boolean)
      : undefined,
    dicas: Array.isArray(json.dicas)
      ? json.dicas.map((s: any) => String(s).trim()).filter(Boolean)
      : undefined,
    tempo_gravacao_s: json.tempo_gravacao_s !== undefined ? Number(json.tempo_gravacao_s) : undefined,
    remover_audio_professor: Boolean(json.remover_audio_professor),
    imagemFile: null as File | null,
    audioProfessorFile: null as File | null,
  };
}

function garantirFraseCompletaNaInstrucao(instrucaoRaw?: string): string {
  const txt = (instrucaoRaw || "").trim();
  if (!txt) {
    return "Responda em inglês usando uma frase completa.";
  }
  if (/frases?\s+completas?/i.test(txt)) {
    return txt;
  }
  const semPonto = txt.replace(/\.+$/, "");
  return `${semPonto} (responda usando uma frase completa em inglês).`;
}

export async function POST(request: NextRequest) {
  try {
    const payload = await extrairPayload(request);
    if (!payload.atividade_id || !payload.enunciado) {
      return NextResponse.json(
        { error: "A avaliação (atividade_id) e o enunciado da pergunta são obrigatórios." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    await garantirBucketAtividades(admin);

    // Determinar ordem caso não informada
    let ordem = payload.ordem;
    if (!ordem || ordem < 1) {
      const { data: existentes } = await admin
        .from("perguntas")
        .select("ordem")
        .eq("atividade_id", payload.atividade_id)
        .order("ordem", { ascending: false })
        .limit(1);
      ordem = (existentes?.[0]?.ordem || 0) + 1;
    }

    // Upload de imagem (se for questão com imagem)
    const temImagem = payload.tem_imagem ?? (payload.tipo === "imagem" || payload.tipo === "comparacao");
    let imagemPathFinal: string | null = temImagem ? (payload.imagem_path || null) : null;

    if (temImagem && payload.imagemFile) {
      const ext = (payload.imagemFile.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
      const storagePath = `imagens-questoes/${payload.atividade_id}-${Date.now()}.${ext}`;
      const buffer = Buffer.from(await payload.imagemFile.arrayBuffer());
      const { error: upImgErr } = await admin.storage.from("atividades").upload(storagePath, buffer, {
        contentType: payload.imagemFile.type || "image/png",
        upsert: true,
      });
      if (upImgErr) {
        throw new Error(`Falha ao enviar imagem da questão: ${upImgErr.message}`);
      }
      imagemPathFinal = storagePath;
    }

    // Upload de áudio modelo do professor (se gravado/enviado)
    let audioProfessorPath: string | null = null;
    if (payload.audioProfessorFile) {
      const storageAudioPath = `modelos-professor/${payload.atividade_id}-${Date.now()}.wav`;
      const bufferAudio = Buffer.from(await payload.audioProfessorFile.arrayBuffer());
      const { error: upAudioErr } = await admin.storage.from("atividades").upload(storageAudioPath, bufferAudio, {
        contentType: payload.audioProfessorFile.type || "audio/wav",
        upsert: true,
      });
      if (upAudioErr) {
        throw new Error(`Falha ao salvar áudio do professor: ${upAudioErr.message}`);
      }
      audioProfessorPath = storageAudioPath;
    }

    const tipoFinal: "oral" | "imagem" | "comparacao" = !temImagem
      ? "oral"
      : payload.tipo === "comparacao"
        ? "comparacao"
        : "imagem";

    const tempoGravacaoS: 5 | 10 | 20 =
      payload.tempo_gravacao_s === 5 ? 5 : payload.tempo_gravacao_s === 20 ? 20 : 10;

    const respostasEsperadas =
      payload.respostas_esperadas && payload.respostas_esperadas.length > 0
        ? payload.respostas_esperadas
        : ["My answer is..."];

    const dicas =
      payload.dicas && payload.dicas.length > 0
        ? payload.dicas
        : [`Responda com frase completa. You can say: ${respostasEsperadas[0]}`];

    const focoAvaliacao =
      payload.foco_avaliacao && payload.foco_avaliacao.length > 0
        ? payload.foco_avaliacao
        : ["frase completa", "pronúncia clara"];

    const gabaritoMeta: Record<string, any> = {
      tempo_gravacao_s: tempoGravacaoS,
      audio_modelo_professor_path: audioProfessorPath,
      tem_imagem: temImagem,
    };

    const baseInsert: Record<string, any> = {
      atividade_id: payload.atividade_id,
      secao: payload.secao || "Geral",
      ordem,
      tipo: tipoFinal,
      enunciado: payload.enunciado,
      instrucao_pt: garantirFraseCompletaNaInstrucao(payload.instrucao_pt),
      imagem_path: imagemPathFinal,
      respostas_esperadas: respostasEsperadas,
      texto_referencia: respostasEsperadas[0] || payload.enunciado,
      foco_avaliacao: focoAvaliacao,
      dicas,
      gabarito: gabaritoMeta,
    };

    // Tenta inserir também nas colunas novas da migration 008; se ainda não existirem no banco, insere com gabarito
    let perguntaCriada: any = null;
    const { data: dataComColunas, error: errComColunas } = await admin
      .from("perguntas")
      .insert({
        ...baseInsert,
        tempo_gravacao_s: tempoGravacaoS,
        audio_modelo_professor_path: audioProfessorPath,
      })
      .select("*")
      .single();

    if (!errComColunas && dataComColunas) {
      perguntaCriada = dataComColunas;
    } else {
      const { data: dataFallback, error: errFallback } = await admin
        .from("perguntas")
        .insert(baseInsert)
        .select("*")
        .single();
      if (errFallback) throw errFallback;
      perguntaCriada = dataFallback;
    }

    return NextResponse.json({ pergunta: perguntaCriada });
  } catch (error: any) {
    console.error("Erro ao criar pergunta:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao criar questão." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = await extrairPayload(request);
    if (!payload.id) {
      return NextResponse.json({ error: "ID da questão é obrigatório." }, { status: 400 });
    }

    const admin = createAdminClient();
    await garantirBucketAtividades(admin);

    const { data: atual, error: findErr } = await admin
      .from("perguntas")
      .select("*")
      .eq("id", payload.id)
      .single();

    if (findErr || !atual) {
      return NextResponse.json({ error: "Questão não encontrada." }, { status: 404 });
    }

    const gabAtual =
      atual.gabarito && typeof atual.gabarito === "object" ? { ...atual.gabarito } : {};

    const temImagemAtual = Boolean(atual.imagem_path && atual.tipo !== "oral");
    const temImagemFinal =
      payload.tem_imagem !== undefined
        ? payload.tem_imagem
        : payload.tipo !== undefined
          ? payload.tipo !== "oral"
          : temImagemAtual;

    let imagemPathFinal: string | null = temImagemFinal
      ? payload.imagem_path !== undefined
        ? payload.imagem_path || null
        : atual.imagem_path
      : null;

    if (temImagemFinal && payload.imagemFile) {
      const ext = (payload.imagemFile.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
      const storagePath = `imagens-questoes/${atual.atividade_id}-${payload.id.slice(0, 8)}-${Date.now()}.${ext}`;
      const buffer = Buffer.from(await payload.imagemFile.arrayBuffer());
      const { error: upImgErr } = await admin.storage.from("atividades").upload(storagePath, buffer, {
        contentType: payload.imagemFile.type || "image/png",
        upsert: true,
      });
      if (upImgErr) {
        throw new Error(`Falha ao enviar imagem da questão: ${upImgErr.message}`);
      }
      imagemPathFinal = storagePath;
    }

    let audioProfPathFinal: string | null =
      atual.audio_modelo_professor_path ?? gabAtual.audio_modelo_professor_path ?? null;

    if (payload.remover_audio_professor) {
      audioProfPathFinal = null;
    }

    if (payload.audioProfessorFile) {
      const storageAudioPath = `modelos-professor/${payload.id}-${Date.now()}.wav`;
      const bufferAudio = Buffer.from(await payload.audioProfessorFile.arrayBuffer());
      const { error: upAudioErr } = await admin.storage.from("atividades").upload(storageAudioPath, bufferAudio, {
        contentType: payload.audioProfessorFile.type || "audio/wav",
        upsert: true,
      });
      if (upAudioErr) {
        throw new Error(`Falha ao salvar áudio do professor: ${upAudioErr.message}`);
      }
      audioProfPathFinal = storageAudioPath;
    }

    const tipoFinal: "oral" | "imagem" | "comparacao" = !temImagemFinal
      ? "oral"
      : payload.tipo === "comparacao" || (!payload.tipo && atual.tipo === "comparacao")
        ? "comparacao"
        : "imagem";

    const tempoRaw =
      payload.tempo_gravacao_s ??
      atual.tempo_gravacao_s ??
      gabAtual.tempo_gravacao_s ??
      (tipoFinal === "comparacao" ? 20 : 10);
    const tempoGravacaoS: 5 | 10 | 20 = tempoRaw === 5 ? 5 : tempoRaw === 20 ? 20 : 10;

    const novoGabarito = {
      ...gabAtual,
      tempo_gravacao_s: tempoGravacaoS,
      audio_modelo_professor_path: audioProfPathFinal,
      tem_imagem: temImagemFinal,
    };

    const camposBase: Record<string, any> = {
      tipo: tipoFinal,
      imagem_path: imagemPathFinal,
      gabarito: novoGabarito,
    };

    if (payload.secao !== undefined) camposBase.secao = payload.secao || "Geral";
    if (payload.ordem !== undefined && !Number.isNaN(payload.ordem)) camposBase.ordem = payload.ordem;
    if (payload.enunciado !== undefined) camposBase.enunciado = payload.enunciado;
    if (payload.instrucao_pt !== undefined) {
      camposBase.instrucao_pt = garantirFraseCompletaNaInstrucao(payload.instrucao_pt);
    }
    if (payload.respostas_esperadas !== undefined && payload.respostas_esperadas.length > 0) {
      camposBase.respostas_esperadas = payload.respostas_esperadas;
      camposBase.texto_referencia = payload.respostas_esperadas[0];
    }
    if (payload.foco_avaliacao !== undefined && payload.foco_avaliacao.length > 0) {
      camposBase.foco_avaliacao = payload.foco_avaliacao;
    }
    if (payload.dicas !== undefined && payload.dicas.length > 0) {
      camposBase.dicas = payload.dicas;
    }

    let perguntaAtualizada: any = null;
    const { data: upComColunas, error: errComColunas } = await admin
      .from("perguntas")
      .update({
        ...camposBase,
        tempo_gravacao_s: tempoGravacaoS,
        audio_modelo_professor_path: audioProfPathFinal,
      })
      .eq("id", payload.id)
      .select("*")
      .single();

    if (!errComColunas && upComColunas) {
      perguntaAtualizada = upComColunas;
    } else {
      const { data: upFallback, error: errFallback } = await admin
        .from("perguntas")
        .update(camposBase)
        .eq("id", payload.id)
        .select("*")
        .single();
      if (errFallback) throw errFallback;
      perguntaAtualizada = upFallback;
    }

    return NextResponse.json({ pergunta: perguntaAtualizada });
  } catch (error: any) {
    console.error("Erro ao atualizar pergunta:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao atualizar questão." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID da questão é obrigatório." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin.from("perguntas").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Erro ao excluir pergunta:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao excluir questão." },
      { status: 500 }
    );
  }
}

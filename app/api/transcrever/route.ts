import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  obterChaveGemini,
  transcreverAudioGemini,
  type ModoTranscricaoGemini,
} from "@/lib/pronuncia/transcrever";

export const maxDuration = 60;

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB por requisição HTTP

function parseListaTexto(valor: FormDataEntryValue | null): string[] {
  if (typeof valor !== "string" || !valor.trim()) return [];
  const limpo = valor.trim();
  if (limpo.startsWith("[")) {
    try {
      const parsed = JSON.parse(limpo);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      // Continua com separação por vírgula
    }
  }
  return limpo
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    if (!obterChaveGemini()) {
      return NextResponse.json(
        { error: "Chave GOOGLE_GENERATIVE_AI_API_KEY não configurada no servidor." },
        { status: 503 }
      );
    }

    const form = await request.formData();
    const audioRaw = form.get("audio") ?? form.get("file");

    if (!audioRaw || typeof audioRaw === "string") {
      return NextResponse.json(
        { error: "Envie um arquivo de áudio no campo 'audio'." },
        { status: 400 }
      );
    }

    const audio = audioRaw as File;
    if (!audio.size || audio.size === 0) {
      return NextResponse.json({ error: "O arquivo de áudio está vazio." }, { status: 400 });
    }
    if (audio.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "Arquivo de áudio excede o limite de 25 MB." },
        { status: 413 }
      );
    }

    const modoParam = String(form.get("modo") ?? form.get("mode") ?? "verbatim")
      .trim()
      .toLowerCase();
    const modo: ModoTranscricaoGemini = modoParam === "smart" ? "smart" : "verbatim";

    const diarizacao =
      String(form.get("diarizacao") ?? form.get("diarization") ?? "false").toLowerCase() ===
      "true";
    const marcarTempoPalavras =
      String(form.get("timestamps") ?? "false").toLowerCase() === "true";
    const vocabularioPersonalizado = parseListaTexto(
      form.get("vocabulario") ?? form.get("custom_vocabulary")
    );
    const idiomas = parseListaTexto(form.get("idiomas") ?? form.get("language_codes"));

    const bytes = new Uint8Array(await audio.arrayBuffer());

    const resultado = await transcreverAudioGemini({
      audioBytes: bytes,
      mimeType: audio.type || "audio/wav",
      nomeArquivo: audio.name || `upload-${Date.now()}.wav`,
      modo,
      diarizacao,
      marcarTempoPalavras,
      vocabularioPersonalizado,
      idiomas,
      timeoutMs: 45000,
    });

    return NextResponse.json({
      sucesso: true,
      ...resultado,
    });
  } catch (error: unknown) {
    console.error("[api/transcrever] Erro ao transcrever áudio:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "Não foi possível transcrever o arquivo de áudio.",
        detalhe: msg,
      },
      { status: 500 }
    );
  }
}


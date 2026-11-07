/**
 * Transcrição de áudio com Gemini 3.5 Transcribe (`gemini-3.5-transcribe`)
 * via Files API + Gemini Interactions API (`@google/genai`).
 *
 * Recursos suportados:
 * - Upload de arquivos de áudio via Files API (com limpeza automática após uso)
 * - Identificação automática de idioma (85+ idiomas e code-switching) ou dicas BCP-47
 * - Modo `verbatim` (fiel palavra por palavra, com suporte a timestamps por palavra e diarização)
 * - Modo `smart` (transcrição inteligente com remoção de disfluências e formatação automática)
 * - Dicas de vocabulário personalizado (`custom_vocabulary`, até 1.000 termos)
 *
 * Somente servidor.
 */
import { GoogleGenAI } from "@google/genai";

export const MODELO_TRANSCRICAO_PADRAO = "gemini-3.5-transcribe";

export const FORMATOS_AUDIO_SUPORTADOS = [
  "audio/wav",
  "audio/mp3",
  "audio/mpeg",
  "audio/aiff",
  "audio/aac",
  "audio/ogg",
  "audio/flac",
  "audio/m4a",
  "audio/l16",
  "audio/opus",
  "audio/alaw",
  "audio/mulaw",
  "audio/webm",
] as const;

export type ModoTranscricaoGemini = "verbatim" | "smart";

export interface PalavraTranscrita {
  texto: string;
  inicio?: string;
  fim?: string;
  inicioSegundos?: number;
  fimSegundos?: number;
  falante?: string;
}

export interface MetricasFluênciaTranscricao {
  totalPalavras: number;
  pausasLongas: number; // Pausas > 1.5s entre palavras consecutivas
  maiorPausaSegundos: number;
  hesitacoesDetectadas: number;
  duracaoFalaSegundos: number;
}

export interface ArquivoGeminiRemoto {
  name: string;
  uri: string;
  mimeType: string;
}

export interface OpcoesTranscricaoGemini {
  /** Bytes do arquivo de áudio (obrigatório caso `arquivoRemoto` não seja informado). */
  audioBytes?: Uint8Array;
  /** MIME type do arquivo de áudio (padrão: `audio/wav`). */
  mimeType?: string;
  /** Nome de exibição opcional no upload temporário para a Files API. */
  nomeArquivo?: string;
  /** Arquivo já enviado previamente via `uploadAudioGemini` para reutilizar o URI. */
  arquivoRemoto?: ArquivoGeminiRemoto;
  /** Modo de transcrição: `verbatim` (padrão) ou `smart` (remoção de disfluências e formatação inteligente). */
  modo?: ModoTranscricaoGemini;
  /** Habilita marcações de tempo em nível de palavra (`timestamp_granularities: ["word"]`). Requer modo `verbatim`. */
  marcarTempoPalavras?: boolean;
  /** Habilita diarização do falante (`diarization_mode: "speaker"`). Requer modo `verbatim`. */
  diarizacao?: boolean;
  /** Dicas de vocabulário personalizado (até 1.000 termos). Incompatível simultaneamente com timestamps/diarização na API. */
  vocabularioPersonalizado?: string[];
  /** Códigos de idioma BCP-47 (ex: `["en-US"]`). Omita ou envie `[]` para detecção automática de idioma. */
  idiomas?: string[];
  /** Tempo limite em ms para a chamada de transcrição (padrão: 15000). */
  timeoutMs?: number;
}

export interface ResultadoTranscricaoGemini {
  texto: string;
  modo: ModoTranscricaoGemini;
  modelo: string;
  palavras: PalavraTranscrita[];
  metricasFluencia: MetricasFluênciaTranscricao;
}

export function obterChaveGemini(): string | undefined {
  const raw =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    "";
  const key = raw.replace(/^["']|["']$/g, "").trim();
  return key || undefined;
}

export function criarClienteGemini(): GoogleGenAI {
  const apiKey = obterChaveGemini();
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY não configurada");
  }
  return new GoogleGenAI({ apiKey });
}

function normalizarMimeTypeAudio(mimeType?: string): string {
  if (!mimeType) return "audio/wav";
  const limpo = mimeType.split(";")[0].trim().toLowerCase();
  if (limpo === "audio/x-wav" || limpo === "audio/wave") return "audio/wav";
  if (limpo === "audio/x-m4a" || limpo === "audio/mp4") return "audio/m4a";
  return limpo || "audio/wav";
}

function converterOffsetParaSegundos(offset?: string): number | undefined {
  if (!offset) return undefined;
  const limpo = offset.trim().replace(/s$/i, "");
  const valor = Number(limpo);
  return Number.isFinite(valor) ? valor : undefined;
}

/**
 * Faz o upload de um arquivo de áudio em memória para a Gemini Files API.
 */
export async function uploadAudioGemini(
  audioBytes: Uint8Array,
  mimeType = "audio/wav",
  displayName?: string,
  aiClient?: GoogleGenAI
): Promise<ArquivoGeminiRemoto> {
  const ai = aiClient ?? criarClienteGemini();
  const mimeNormalizado = normalizarMimeTypeAudio(mimeType);
  const blob = new Blob([Buffer.from(audioBytes)], { type: mimeNormalizado });

  const uploaded = await ai.files.upload({
    file: blob,
    config: {
      mimeType: mimeNormalizado,
      displayName: displayName || `audio-${Date.now()}`,
    },
  });

  if (!uploaded.uri || !uploaded.name) {
    throw new Error("A Files API do Gemini não retornou um URI válido para o áudio enviado.");
  }

  return {
    name: uploaded.name,
    uri: uploaded.uri,
    mimeType: uploaded.mimeType || mimeNormalizado,
  };
}

/**
 * Remove silenciosamente um arquivo temporário enviado à Gemini Files API.
 */
export async function removerArquivoGemini(
  fileName?: string | null,
  aiClient?: GoogleGenAI
): Promise<void> {
  if (!fileName) return;
  try {
    const ai = aiClient ?? criarClienteGemini();
    await ai.files.delete({ name: fileName });
  } catch (err) {
    console.warn("[transcrever] Não foi possível excluir arquivo temporário na Files API:", err);
  }
}

interface RawWordAnnotation {
  type?: string;
  text?: string;
  word?: string;
  speaker?: string;
  start_offset?: string;
  end_offset?: string;
  startOffset?: string;
  endOffset?: string;
}

function extrairPalavrasComTimestamps(interaction: unknown): PalavraTranscrita[] {
  const palavras: PalavraTranscrita[] = [];
  const obj = interaction as {
    steps?: Array<{
      content?: Array<{
        annotations?: RawWordAnnotation[];
      }>;
    }>;
  };

  for (const step of obj?.steps ?? []) {
    for (const content of step?.content ?? []) {
      for (const annotation of content?.annotations ?? []) {
        if (annotation?.type === "word_info") {
          const inicio = annotation.start_offset ?? annotation.startOffset;
          const fim = annotation.end_offset ?? annotation.endOffset;
          palavras.push({
            texto: String(annotation.text ?? annotation.word ?? "").trim(),
            ...(inicio ? { inicio } : {}),
            ...(fim ? { fim } : {}),
            ...(converterOffsetParaSegundos(inicio) !== undefined
              ? { inicioSegundos: converterOffsetParaSegundos(inicio) }
              : {}),
            ...(converterOffsetParaSegundos(fim) !== undefined
              ? { fimSegundos: converterOffsetParaSegundos(fim) }
              : {}),
            ...(annotation.speaker ? { falante: annotation.speaker } : {}),
          });
        }
      }
    }
  }

  return palavras;
}

function calcularMetricasFluencia(
  texto: string,
  palavras: PalavraTranscrita[]
): MetricasFluênciaTranscricao {
  const tokensTexto = texto
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  const hesitacoesRegex = /^(uh+|um+|ah+|eh+|er+|hmm+|hm+)$/i;
  const hesitacoesDetectadas = tokensTexto.filter((t) =>
    hesitacoesRegex.test(t.replace(/[.,!?;:]/g, ""))
  ).length;

  let pausasLongas = 0;
  let maiorPausaSegundos = 0;
  let primeiroInicio: number | undefined;
  let ultimoFim: number | undefined;

  for (let i = 0; i < palavras.length; i++) {
    const atual = palavras[i];
    if (atual.inicioSegundos !== undefined && primeiroInicio === undefined) {
      primeiroInicio = atual.inicioSegundos;
    }
    if (atual.fimSegundos !== undefined) {
      ultimoFim = atual.fimSegundos;
    }

    if (i > 0) {
      const anterior = palavras[i - 1];
      if (anterior.fimSegundos !== undefined && atual.inicioSegundos !== undefined) {
        const pausa = Math.max(0, atual.inicioSegundos - anterior.fimSegundos);
        if (pausa > maiorPausaSegundos) {
          maiorPausaSegundos = Number(pausa.toFixed(3));
        }
        if (pausa >= 1.5) {
          pausasLongas++;
        }
      }
    }
  }

  const duracaoFalaSegundos =
    primeiroInicio !== undefined && ultimoFim !== undefined && ultimoFim >= primeiroInicio
      ? Number((ultimoFim - primeiroInicio).toFixed(3))
      : 0;

  return {
    totalPalavras: palavras.length > 0 ? palavras.length : tokensTexto.length,
    pausasLongas,
    maiorPausaSegundos,
    hesitacoesDetectadas,
    duracaoFalaSegundos,
  };
}

/**
 * Faz upload do áudio (se necessário) e transcreve usando `gemini-3.5-transcribe`.
 */
export async function transcreverAudioGemini(
  opcoes: OpcoesTranscricaoGemini
): Promise<ResultadoTranscricaoGemini> {
  const ai = criarClienteGemini();
  const modo: ModoTranscricaoGemini = opcoes.modo ?? "verbatim";

  // Regra oficial da API Gemini 3.5 Transcribe:
  // 1) Modo `smart` não pode ser combinado com `timestamp_granularities` ou `diarization_mode`.
  // 2) `custom_vocabulary` não pode ser combinado com `timestamp_granularities` ou `diarization_mode`.
  const usarTimestamps = modo === "verbatim" && Boolean(opcoes.marcarTempoPalavras);
  const usarDiarizacao = modo === "verbatim" && Boolean(opcoes.diarizacao);
  const vocabularioLimpo = (opcoes.vocabularioPersonalizado ?? [])
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
    .slice(0, 1000);
  const usarVocabulario =
    !usarTimestamps && !usarDiarizacao && vocabularioLimpo.length > 0;

  let arquivoProprio: ArquivoGeminiRemoto | null = null;
  const timeoutMs = opcoes.timeoutMs ?? 15000;

  try {
    const arquivo =
      opcoes.arquivoRemoto ??
      (opcoes.audioBytes
        ? ((arquivoProprio = await uploadAudioGemini(
            opcoes.audioBytes,
            opcoes.mimeType ?? "audio/wav",
            opcoes.nomeArquivo,
            ai
          )),
          arquivoProprio)
        : null);

    if (!arquivo) {
      throw new Error("É necessário fornecer `audioBytes` ou `arquivoRemoto` para transcrever.");
    }

    const modeConfig =
      modo === "smart"
        ? ("smart" as const)
        : usarTimestamps || usarDiarizacao
        ? {
            type: "verbatim" as const,
            ...(usarTimestamps ? { timestamp_granularities: ["word"] } : {}),
            ...(usarDiarizacao ? { diarization_mode: "speaker" } : {}),
          }
        : ("verbatim" as const);

    const interaction = await ai.interactions.create(
      {
        model: MODELO_TRANSCRICAO_PADRAO,
        store: false,
        input: [
          {
            type: "audio",
            uri: arquivo.uri,
            mime_type: arquivo.mimeType,
          },
        ],
        generation_config: {
          transcription_config: {
            language_codes: opcoes.idiomas ?? [],
            mode: modeConfig,
            ...(usarVocabulario ? { custom_vocabulary: vocabularioLimpo } : {}),
          },
        },
      },
      {
        timeout: timeoutMs,
      }
    );

    const texto = (interaction.output_text ?? "").trim();
    const palavras = extrairPalavrasComTimestamps(interaction);
    const metricasFluencia = calcularMetricasFluencia(texto, palavras);

    return {
      texto,
      modo,
      modelo: MODELO_TRANSCRICAO_PADRAO,
      palavras,
      metricasFluencia,
    };
  } finally {
    if (arquivoProprio?.name) {
      void removerArquivoGemini(arquivoProprio.name, ai);
    }
  }
}

/**
 * Gera um pequeno buffer WAV PCM 16 kHz mono silencioso (0.4s) para teste de conectividade
 * do modelo `gemini-3.5-transcribe` no painel administrativo.
 */
export function gerarWavSilencioTeste(duracaoMs = 400): Uint8Array {
  const sampleRate = 16000;
  const numSamples = Math.max(160, Math.floor((sampleRate * duracaoMs) / 1000));
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM = 1
  view.setUint16(22, 1, true); // Mono = 1
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  return new Uint8Array(buffer);
}


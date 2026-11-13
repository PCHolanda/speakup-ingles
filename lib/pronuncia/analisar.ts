/**
 * Análise de pronúncia com Gemini (áudio → transcrição + notas + feedback pt-BR).
 * Arquitetura Aprofundada (v3):
 * - Avaliação profunda dos 4 critérios solicitados:
 *   1. Pronúncia: Sons específicos (th, r, v, ed final), clareza, entonação.
 *   2. Vocabulário: Uso correto das palavras esperadas, variedade, adequação ao tema.
 *   3. Fluência: Pausas excessivas, hesitação, ritmo.
 *   4. Estrutura: Uso de frases completas, ordem das palavras.
 * Somente servidor.
 */
import { z } from "zod";
import { CODIGOS_ERRO, CodigoErro, CATALOGO_ERROS } from "@/lib/catalogo-erros";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  criarClienteGemini,
  MODELO_TRANSCRICAO_PADRAO,
  obterChaveGemini,
  removerArquivoGemini,
  transcreverAudioGemini,
  uploadAudioGemini,
  type ArquivoGeminiRemoto,
  type ResultadoTranscricaoGemini,
} from "@/lib/pronuncia/transcrever";

export class ConfigIAAusenteError extends Error {}

export interface ContextoPergunta {
  enunciado: string;
  instrucao_pt?: string | null;
  respostas_esperadas?: string[] | null;
  texto_referencia?: string | null;
  foco_avaliacao?: string[] | null;
  tipo?: "oral" | "imagem" | "comparacao" | string | null;
  imagem_path?: string | null;
  contexto_imagem?: string | null;
}

// ============================================================================
// PROMPT DE AVALIAÇÃO COM PROFUNDIDADE (ANÁLISE MULTIMODAL DE ÁUDIO)
// ============================================================================

export const PROMPT_AVALIACAO_PROFUNDA = `Você é um avaliador especialista em inglês oral infantil para alunos brasileiros de 9 a 12 anos, nível A1 do CEFR (Cambridge Young Learners: Starters/Movers).

Você ouvirá a gravação em áudio e fará uma AVALIAÇÃO COM PROFUNDIDADE, rigorosa e ao mesmo tempo acolhedora, observando detalhadamente os 4 CRITÉRIOS ESSENCIAIS:

## 1. CRITÉRIO: PRONÚNCIA
O que observar:
- **Sons específicos do inglês**:
  * **Som do TH** (/θ/ e /ð/ em "three", "the", "this", "think", "mother"): O aluno posicionou a língua entre os dentes ou trocou por /t/, /f/, /d/ ou /s/?
  * **Som do R inicial e medial** (/ɹ/ em "red", "rabbit", "run", "orange"): O aluno enrolou a língua para trás sem tocar o céu da boca ou fez o som gutural/aspirado de R da garganta /h/ do português?
  * **Sons de V e W** (/v/ e /w/ em "very", "water", "we", "vet"): O V foi feito com dentes superiores no lábio inferior (labiodental) ou trocado por W/B? O W foi pronunciado como semivogal labializada /w/?
  * **Sufixo -ED final** (/t/, /d/, /ɪd/ em passados regulares como "played", "watched", "liked"): O aluno leu o "-ed" como uma sílaba completa errada ("pleiédi", "wa-tchedi") ou articulou a consoante final correta (/d/ em "played", /t/ em "watched")?
  * **Epêntese**: O aluno adicionou vogal "i" intrusiva antes de S inicial ("istop", "ischool") ou após consoante final muda ("bigui", "dogui", "likei", "redy")?
  * **H aspirado**: O /h/ inicial ("house", "have", "horse") foi aspirado com ar quente da garganta ou omitido ("ouse", "ave")?
  * **Vogais curtas vs longas**: Diferenciação adequada de pares como ship/sheep, live/leave.
- **Clareza**: Inteligibilidade acústica da gravação. A voz foi nítida, com boa abertura de boca e projeção, ou soou abafada, sussurrada, mastigada ou engolida?
- **Entonação**: Melodia e curva de entonação da frase. O aluno usou a curva descendente natural do inglês ao afirmar, ou falou em tom monótono, robótico ou inseguro?

Calibração de Nota de Pronúncia (1 a 4):
- 4 (Excelente): Sons específicos (th, r, v, -ed) bem produzidos, pronúncia nítida e entonação natural.
- 3 (Bom): Compreensível e claro, com leve sotaque brasileiro que não atrapalha a comunicação.
- 2 (Em Desenvolvimento): Trocas fonéticas marcadas (ex: TH como T/F, R como H, epêntese frequente) ou clareza prejudicada.
- 1 (Necessita Apoio): Palavras ininteligíveis, sons muito distorcidos ou pronúncia que impede a compreensão.

## 2. CRITÉRIO: VOCABULÁRIO
O que observar:
- **Uso correto das palavras esperadas**: O aluno utilizou os termos-chave que respondem à pergunta (ex: cores corretas, números, partes do corpo, animais, roupas, objetos)?
- **Variedade vocabular**: Demonstrou repertório de vocabulário variado para o nível A1 ou apenas palavras genéricas repetitivas?
- **Adequação ao tema**: O vocabulário empregado correspondeu com exatidão ao tema da atividade e ao contexto da imagem/pergunta?

Calibração de Nota de Vocabulário (1 a 4):
- 4: Vocabulário preciso, rico e emprega as palavras esperadas com exatidão.
- 3: Vocabulário adequado ao tema, respondendo à pergunta sem falhas graves.
- 2: Vocabulário restrito, usou palavras vagas ou faltou o termo essencial da resposta.
- 1: Não utilizou palavras em inglês pertinentes ao tema ou respondeu em português.

## 3. CRITÉRIO: FLUÊNCIA
O que observar:
- **Pausas excessivas**: Houve silêncios longos e anormais (> 1.5 a 2 segundos) entre as palavras que quebraram o fluxo de fala?
- **Hesitação**: Presença excessiva de marcadores ("uh", "um", "ah"), repetições de sílabas ou gaguejos ao tentar formular as palavras?
- **Ritmo de fala**: A cadência de fala foi contínua e natural para uma criança de 9 a 12 anos, ou soou excessivamente travada palavra por palavra?

Calibração de Nota de Fluência (1 a 4):
- 4: Ritmo fluido e constante, sem pausas excessivas ou hesitações marcantes.
- 3: Ritmo compreensível, com pequenas pausas normais de elaboração mental infantil.
- 2: Muitas hesitações, pausas longas frequentes ou fala fragmentada palavra a palavra.
- 1: Fala extremamente interrompida, travas severas ou apenas uma palavra isolada após muito tempo.

## 4. CRITÉRIO: ESTRUTURA
O que observar:
- **Uso de frases completas (OBRIGATÓRIO para nota 3 ou 4)**: O aluno formulou uma oração completa com sujeito e verbo (ex: "My name is Paul.", "It is blue.", "There are two dogs.", "I am ten years old.") ou falou apenas palavras soltas isoladas / apenas o primeiro nome (ex: "Paul", "Blue", "Two", "Brazil", "Cat")?
- **REGRA RIGOROSA DE FRASE COMPLETA**: Se o aluno disser apenas o próprio nome isolado (ex: "Paulo", "Paul") ou apenas 1 ou 2 palavras sem verbo (ex: "Ten", "Brazil", "White", "Cat"), `frase_completa` DEVE ser `false` e a nota de `estrutura` DEVE ser no máximo `2` (NUNCA dê 3 ou 4 para palavras soltas!). Além disso, em `ponto_melhorar`, oriente explicitamente o aluno a dizer a frase completa (ex: "My name is ...").
- **Ordem das palavras**: Respeitou a ordem sintática natural do inglês (SVO: Sujeito + Verbo + Objeto; Adjetivo ANTES do Substantivo: "a blue car" e NUNCA "a car blue")?
- **Concordância**: Empregou concordância básica A1 ("He is" / "They are", singular e plural).

Calibração de Nota de Estrutura (1 a 4):
- 4: Frase completa (com sujeito e verbo) e correta, com ordem das palavras perfeitamente respeitada.
- 3: Frase completa (com sujeito e verbo) com pequeno deslize que não prejudica a estrutura geral.
- 2: Respondeu apenas com palavra solta isolada (ex: só o primeiro nome, só o número, só a cor, sem formar frase com sujeito e verbo) ou com ordem invertida ("car blue").
- 1: Estrutura gramatical incompreensível ou inexistente.

## REGRAS CRÍTICAS:
- TRANSCRIÇÃO: Transcreva fielmente as palavras do áudio, sem corrigir erros. Trechos inaudíveis viram [inaudível].
- Se o aluno tentou responder em inglês, "status_audio" DEVE ser "sucesso". Use "audio_vazio", "apenas_ruido" ou "apenas_portugues" somente se não houver fala em inglês.
- O campo "resposta_ideal" NUNCA pode ser vazio. Forneça sempre o modelo ideal e completo de resposta em inglês A1.

## FORMATO DE SAÍDA (Retorne ESTRITAMENTE um JSON com esta estrutura, sem blocos markdown):
{
  "status_audio": "sucesso",
  "transcricao": "o que o aluno disse literalmente",
  "criterios": {
    "pronuncia": {
      "nota": 4,
      "sons_especificos": {
        "th": "correto",
        "r": "correto",
        "v_w": "correto",
        "ed_final": "nao_aplicavel",
        "epentese": "ausente"
      },
      "clareza": "nitida",
      "entonacao": "natural",
      "observacoes": "Pronúncia clara, entonação natural e sons bem articulados."
    },
    "vocabulario": {
      "nota": 4,
      "palavras_esperadas_utilizadas": ["blue", "pen"],
      "palavras_ausentes": [],
      "variedade": "adequada",
      "adequacao_tema": true,
      "observacoes": "Usou os termos exatos esperados para a pergunta."
    },
    "fluencia": {
      "nota": 4,
      "pausas_excessivas": 0,
      "hesitacoes": 0,
      "ritmo": "fluido",
      "observacoes": "Ritmo constante e sem pausas longas."
    },
    "estrutura": {
      "nota": 4,
      "frase_completa": true,
      "ordem_palavras_correta": true,
      "observacoes": "Respondeu em frase completa com ordem SVO correta."
    }
  },
  "palavras_avaliadas": [
    {
      "palavra": "palavra_ouvida",
      "palavra_alvo": "palavra_correta",
      "inteligibilidade": "clara",
      "precisao": 95,
      "codigo_erro": "NENHUM",
      "dica": "Pronúncia clara e correta."
    }
  ],
  "resposta_ideal": {
    "frase": "It is blue.",
    "original_estava_correta": true
  },
  "feedback_pedagogico": {
    "ponto_forte": "Elogio detalhado destacando o ponto alto da fala.",
    "ponto_melhorar": "Uma única dica concreta e carinhosa para aperfeiçoar.",
    "mensagem_completa": "Mensagem encorajadora para a criança em português."
  }
}`;

// Manter exportações de compatibilidade para código legado
export const PROMPT_CHAMADA_1 = PROMPT_AVALIACAO_PROFUNDA;

export const erroGramaticalSchema = z.object({
  trecho: z.string().describe("Trecho com erro gramatical."),
  explicacao: z.string().describe("Explicação simples do erro em português."),
  correcao: z.string().describe("Correção sugerida em inglês."),
});

export const analiseChamada1Schema = z.object({
  status_audio: z
    .enum(["ok", "sucesso", "audio_vazio", "apenas_ruido", "apenas_portugues", "incompreensivel"])
    .describe("Status da análise do áudio recebido."),
  transcricao: z.string().describe("O que o aluno realmente disse, palavra por palavra."),
  coerencia: z.object({
    coerente: z.boolean().describe("true se a resposta faz sentido para a pergunta e contexto da atividade."),
    comentario: z.string().describe("Comentário curto justificando a coerência."),
  }),
  erros_gramaticais: z.array(erroGramaticalSchema).describe("Lista de erros gramaticais ou array vazio."),
  naturalidade: z.object({
    natural: z.boolean().describe("true se soa natural em inglês americano."),
    comentario: z.string().describe("Observação sobre naturalidade ou traduções literais do português."),
  }),
  indicios_fluencia: z.object({
    hesitacoes: z.number().describe("Quantidade de hesitações (uh, hmm, ah)."),
    pausas_longas: z.number().describe("Quantidade de pausas longas perceptíveis."),
    autocorrecoes: z.number().describe("Quantidade de autocorreções na fala."),
  }),
});

export type AnaliseChamada1 = z.infer<typeof analiseChamada1Schema>;

export interface FonemaFraco {
  esperado: string;
  precisao: number;
}

export interface PalavraMotor {
  palavra: string;
  palavra_alvo?: string;
  precisao: number;
  inteligibilidade: "clara" | "com_esforco" | "nao_entendida";
  fonemas_fracos: FonemaFraco[];
  codigo_erro?: CodigoErro;
  dica_sugerida?: string;
}

export interface PronunciaMotor {
  fluencia_motor: number; // 0 a 100
  palavras: PalavraMotor[];
}

export const PROMPT_CHAMADA_2 = `Você é um professor de inglês para crianças brasileiras de 9 a 12 anos, nível A1.`;

export const palavraFeedbackSchema = z.object({
  palavra: z.string().describe("Palavra avaliada"),
  inteligibilidade: z.enum(["clara", "com_esforco", "nao_entendida"]).describe("Repasse do motor"),
  erro_catalogo: z.enum(CODIGOS_ERRO).describe("Código do catálogo aplicável (ou NENHUM)"),
  explicacao: z.string().describe("Dica de articulação ou elogio curto."),
});

export const feedbackChamada2Schema = z.object({
  palavras_feedback: z.array(palavraFeedbackSchema),
  resposta_ideal: z.object({
    frase: z.string(),
    original_estava_correta: z.boolean(),
  }),
  sugestao_notas: z.object({
    vocabulario: z.number().min(1).max(4),
    justificativa_vocabulario: z.string(),
    estrutura: z.number().min(1).max(4),
    justificativa_estrutura: z.string(),
  }),
  comentario_professor: z.string(),
  feedback_aluno: z.object({
    ponto_forte: z.string(),
    ponto_melhorar: z.string(),
    mensagem_completa: z.string(),
  }),
});

export type FeedbackChamada2 = z.infer<typeof feedbackChamada2Schema>;

// ============================================================================
// CONSOLIDAÇÃO DA ANÁLISE PROFUNDA
// ============================================================================

export interface PalavraAnalise {
  palavra: string;
  status: "ok" | "atencao" | "erro";
  codigo_erro: CodigoErro | null;
  dica: string | null;
  nota: number; // 0 a 10
  ouvido: string;
  palavra_alvo: string;
}

export interface DetalhesCriterios {
  pronuncia: {
    nota: number;
    clareza: string;
    entonacao: string;
    sons_especificos: {
      th?: string;
      r?: string;
      v_w?: string;
      ed_final?: string;
      epentese?: string;
    };
    observacoes: string;
  };
  vocabulario: {
    nota: number;
    palavras_esperadas_utilizadas: string[];
    variedade: string;
    adequacao_tema: boolean;
    observacoes: string;
  };
  fluencia: {
    nota: number;
    pausas_excessivas: number;
    hesitacoes: number;
    ritmo: string;
    observacoes: string;
  };
  estrutura: {
    nota: number;
    frase_completa: boolean;
    ordem_palavras_correta: boolean;
    observacoes: string;
  };
}

export type NivelIncentivo = "excellent" | "good_job" | "doing_ok" | "try_again";

export interface AnalisePronuncia {
  transcricao: string;
  respondeu_pergunta: boolean;
  nota_pronuncia: number; // 1 a 4
  nota_fluencia: number;  // 1 a 4
  nota_vocabulario: number; // 1 a 4
  nota_estrutura: number; // 1 a 4
  resultado: NivelIncentivo;
  ponto_forte: string;
  ponto_melhorar: string;
  palavras: PalavraAnalise[];
  frase_modelo: string;
  modelo_utilizado?: string;
  detalhes_criterios?: DetalhesCriterios;
  analise_detalhada?: {
    chamada1: any;
    motor: any;
    chamada2: any;
    transcricao_gemini?: ResultadoTranscricaoGemini | null;
  };
}

export const MODELOS_RECOMENDADOS = [
  {
    id: "gemini-3.5-transcribe",
    nome: "Gemini 3.5 Transcribe + 3.5 Flash-Lite",
    descricao: "Recomendado: Motor Speech-to-Text dedicado + avaliador pedagógico ultra-rápido",
  },
  {
    id: "gemini-3.5-flash-lite",
    nome: "Gemini 3.5 Flash-Lite",
    descricao: "Ultra rápido (< 1s), menor latência e alta franquia de requisições",
  },
  {
    id: "gemini-3.6-flash",
    nome: "Gemini 3.6 Flash",
    descricao: "Modelo de produção estável com alta capacidade",
  },
  {
    id: "gemini-3.8-flash",
    nome: "Gemini 3.8 Flash",
    descricao: "Mais avançado da família Flash (sujeito a limite de 20 req/dia no plano gratuito)",
  },
  {
    id: "gemini-3.1-flash-lite",
    nome: "Gemini 3.1 Flash-Lite",
    descricao: "Econômico e ágil para alta frequência de avaliações",
  },
];

function normalizarModeloAvaliador(modeloBruto?: string | null): string | null {
  if (!modeloBruto) return null;
  const limpo = modeloBruto.trim().replace(/^models\//, "");
  if (!limpo) return null;
  if (
    limpo.startsWith("gemini-1.5") ||
    limpo.startsWith("gemini-2.0") ||
    limpo.startsWith("gemini-2.5")
  ) {
    return "gemini-3.5-flash-lite";
  }
  // `gemini-3.5-transcribe` já roda sempre na Etapa 1 (Speech-to-Text);
  // a Etapa 2 (rubrica JSON pedagógica) usa `gemini-3.5-flash-lite` por padrão para máxima velocidade e cota.
  if (limpo === MODELO_TRANSCRICAO_PADRAO || limpo.startsWith("gemini-3.5-transcribe")) {
    return "gemini-3.5-flash-lite";
  }
  return limpo;
}

let modeloAtivoCache: string = "gemini-3.5-flash-lite";
let ultimoFetchConfig = 0;
const modelosEmCooldownAte = new Map<string, number>();

export function atualizarModeloAtivoCache(modelo: string) {
  modeloAtivoCache = normalizarModeloAvaliador(modelo) || "gemini-3.5-flash-lite";
  ultimoFetchConfig = Date.now();
}

export async function obterModeloConfigurado(): Promise<string> {
  const agora = Date.now();
  if (agora - ultimoFetchConfig < 30000 && modeloAtivoCache) {
    return modeloAtivoCache;
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("configuracoes")
      .select("valor")
      .eq("chave", "gemini_model")
      .maybeSingle();

    if (!error && data?.valor) {
      const normalizado = normalizarModeloAvaliador(data.valor);
      if (normalizado) {
        modeloAtivoCache = normalizado;
        ultimoFetchConfig = agora;
        return modeloAtivoCache;
      }
    }
  } catch (err) {
    console.warn("[pronuncia] Aviso ao ler configuracoes do banco:", err);
  }

  const envNormalizado = normalizarModeloAvaliador(process.env.GEMINI_MODEL);
  if (envNormalizado) {
    modeloAtivoCache = envNormalizado;
  }

  return modeloAtivoCache;
}

export interface OpcoesClienteAnalise {
  clienteId?: string | null;
  apiKey?: string | null;
  modelo?: string | null;
}

export async function obterModelosCandidatos(
  modeloPreferido?: string | null,
  clienteId?: string | null
): Promise<string[]> {
  const modeloBase =
    normalizarModeloAvaliador(modeloPreferido) || (await obterModeloConfigurado());
  const todos = Array.from(
    new Set([
      modeloBase,
      "gemini-3.5-flash-lite",
      "gemini-3.6-flash",
      "gemini-3.1-flash-lite",
      "gemini-3.8-flash",
    ])
  );
  const agora = Date.now();
  const escopo = clienteId?.trim() || "global";
  const disponiveis = todos.filter(
    (m) => (modelosEmCooldownAte.get(`${escopo}:${m}`) ?? 0) <= agora
  );
  return disponiveis.length > 0 ? disponiveis : todos;
}

async function executarComFallback(
  chamadaFn: (nomeModelo: string) => Promise<{ text: string }>,
  opcoes?: { modeloPreferido?: string | null; clienteId?: string | null }
): Promise<{ text: string; modeloUsado: string }> {
  const modelos = await obterModelosCandidatos(
    opcoes?.modeloPreferido,
    opcoes?.clienteId
  );
  const escopo = opcoes?.clienteId?.trim() || "global";
  let ultimoErro: unknown = null;

  for (const modelo of modelos) {
    try {
      const res = await chamadaFn(modelo);
      if (!opcoes?.clienteId) {
        modeloAtivoCache = modelo;
      }
      return { text: res.text, modeloUsado: modelo };
    } catch (err: unknown) {
      ultimoErro = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[pronuncia] Falha com modelo ${modelo} (cliente=${escopo}):`, msg);

      const isQuotaOrRateLimit =
        msg.includes("429") ||
        msg.includes("Rate limit") ||
        msg.includes("quota") ||
        msg.includes("RESOURCE_EXHAUSTED");

      if (isQuotaOrRateLimit) {
        // Coloca o modelo em cooldown por 10 minutos para este cliente
        modelosEmCooldownAte.set(`${escopo}:${modelo}`, Date.now() + 10 * 60 * 1000);
        continue;
      }

      const isRetryableOnNextModel =
        msg.includes("high demand") ||
        msg.includes("Spikes in demand") ||
        msg.includes("503") ||
        msg.includes("overloaded") ||
        msg.includes("not found") ||
        msg.includes("not supported") ||
        msg.includes("no longer available") ||
        msg.includes("AbortError") ||
        msg.includes("timeout") ||
        msg.includes("timed out") ||
        msg.includes("Timeout");

      if (isRetryableOnNextModel) {
        continue;
      }

      throw err;
    }
  }

  throw ultimoErro;
}

export async function analisarPronuncia(
  audioWav: Uint8Array,
  pergunta: ContextoPergunta,
  opcoesCliente?: OpcoesClienteAnalise
): Promise<AnalisePronuncia> {
  const chaveEfetiva =
    opcoesCliente?.apiKey?.replace(/^["']|["']$/g, "").trim() || obterChaveGemini();
  if (!chaveEfetiva) {
    throw new ConfigIAAusenteError(
      "Chave de API do Google Gemini não configurada para este cliente."
    );
  }

  const ai = criarClienteGemini(chaveEfetiva);

  const tipoMapeado =
    pergunta.tipo === "imagem"
      ? "pergunta_com_imagem"
      : pergunta.tipo === "comparacao"
      ? "comparacao_de_cenas"
      : "pergunta_oral";

  const contextoImagem =
    pergunta.contexto_imagem ||
    (pergunta.imagem_path
      ? `Imagem associada: ${pergunta.imagem_path}. ${pergunta.instrucao_pt || ""}`
      : null) ||
    "não se aplica";

  const respostaEsperada =
    pergunta.respostas_esperadas && pergunta.respostas_esperadas.length > 0
      ? pergunta.respostas_esperadas.join(" | ")
      : pergunta.texto_referencia || "não informada";

  const fraseExemploPadrao =
    (pergunta.respostas_esperadas && pergunta.respostas_esperadas[0]) ||
    pergunta.texto_referencia ||
    (respostaEsperada !== "não informada" ? respostaEsperada : pergunta.enunciado);

  let arquivoRemoto: ArquivoGeminiRemoto | null = null;
  let transcricaoGemini: ResultadoTranscricaoGemini | null = null;

  try {
    // Etapa 1: Upload na Gemini Files API + Transcrição precisa com `gemini-3.5-transcribe`
    // (modo verbatim + marcações de tempo em nível de palavra + detecção automática de idioma)
    try {
      arquivoRemoto = await uploadAudioGemini(
        audioWav,
        "audio/wav",
        `pronuncia-${Date.now()}.wav`,
        ai
      );

      transcricaoGemini = await transcreverAudioGemini({
        arquivoRemoto,
        modo: "verbatim",
        marcarTempoPalavras: true,
        idiomas: [],
        timeoutMs: 6500,
        permitirFallbackMultimodal: false,
        aiClient: ai,
      });

      console.log("[pronuncia] Transcrição gemini-3.5-transcribe concluída:", {
        texto: transcricaoGemini.texto,
        palavras: transcricaoGemini.palavras.length,
        pausasLongas: transcricaoGemini.metricasFluencia.pausasLongas,
      });
    } catch (errTranscricao) {
      console.warn(
        "[pronuncia] Aviso: falha temporária no gemini-3.5-transcribe; prosseguindo com avaliação multimodal direta:",
        errTranscricao instanceof Error ? errTranscricao.message : String(errTranscricao)
      );
    }

    const blocoTelemetriaTranscricao = transcricaoGemini
      ? `\nTRANSCRIÇÃO_OFICIAL_GEMINI_3_5_TRANSCRIBE (verbatim): "${transcricaoGemini.texto || "[sem fala detectada]"}"
MARCAÇÕES_TEMPO_PALAVRAS: ${
          transcricaoGemini.palavras.length > 0
            ? transcricaoGemini.palavras
                .map((p) => `${p.texto} (${p.inicio ?? "?"}->${p.fim ?? "?"})`)
                .join(", ")
            : "nenhuma palavra marcada"
        }
TELEMETRIA_PAUSAS_REAIS: pausas_longas_acima_1_5s=${transcricaoGemini.metricasFluencia.pausasLongas}, maior_pausa_s=${transcricaoGemini.metricasFluencia.maiorPausaSegundos}, hesitacoes_detectadas=${transcricaoGemini.metricasFluencia.hesitacoesDetectadas}`
      : "";

    const inputAudicao = `PERGUNTA: ${pergunta.enunciado}
TIPO_ATIVIDADE: ${tipoMapeado}
CONTEXTO_IMAGEM: ${contextoImagem}
RESPOSTAS_ESPERADAS: ${respostaEsperada}
FOCO_AVALIACAO: ${pergunta.foco_avaliacao?.join(", ") || "Pronúncia geral, clareza e estrutura"}${blocoTelemetriaTranscricao}
ÁUDIO DO ALUNO: (arquivo de áudio .wav anexo — ouça atentamente os fonemas, clareza e entonação e utilize a transcrição e telemetria acima como apoio fiel)`;

    const blocoAudioInput = arquivoRemoto
      ? {
          type: "audio" as const,
          uri: arquivoRemoto.uri,
          mime_type: "audio/wav" as const,
        }
      : {
          type: "audio" as const,
          data: Buffer.from(audioWav).toString("base64"),
          mime_type: "audio/wav" as const,
        };

    // Etapa 2: Avaliação pedagógica profunda dos 4 critérios via Gemini Interactions API
    const resultado = await executarComFallback(
      async (nomeModelo) => {
        const timeoutAvaliacaoMs = 9500;
        const interaction = await Promise.race([
          ai.interactions.create(
            {
              model: nomeModelo,
              store: false,
              system_instruction:
                PROMPT_AVALIACAO_PROFUNDA +
                "\n\nCRÍTICO: Retorne ESTRITAMENTE um JSON válido com todos os campos solicitados. Não inclua blocos markdown (```json).",
              input: [
                {
                  type: "user_input",
                  content: [
                    { type: "text", text: inputAudicao },
                    blocoAudioInput,
                  ],
                },
              ],
              generation_config: {
                temperature: 0.0,
                thinking_level: "minimal",
              },
            },
            {
              timeout_ms: timeoutAvaliacaoMs,
              retries: { strategy: "none" },
              retry_codes: [],
            }
          ),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error(`Timeout de ${timeoutAvaliacaoMs}ms excedido em ${nomeModelo}`)),
              timeoutAvaliacaoMs
            )
          ),
        ]);

        const textoSaida = (interaction.output_text ?? "").trim();
        if (!textoSaida) {
          throw new Error(`Modelo ${nomeModelo} retornou resposta vazia.`);
        }
        return { text: textoSaida };
      },
      {
        modeloPreferido: opcoesCliente?.modelo,
        clienteId: opcoesCliente?.clienteId,
      }
    );

    const modeloNome = transcricaoGemini
      ? `${MODELO_TRANSCRICAO_PADRAO} + ${resultado.modeloUsado}`
      : resultado.modeloUsado;
    console.log("[pronuncia] Avaliação profunda concluída com sucesso usando:", modeloNome);

    const textoPuro = resultado.text.replace(/```json/g, "").replace(/```/g, "").trim();
    let jsonResposta: any;
    try {
      jsonResposta = JSON.parse(textoPuro);
    } catch {
      const jsonMatch = textoPuro.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonResposta = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Não foi possível decodificar a resposta profunda da IA.");
      }
    }

    const transcricaoFinal = (
      transcricaoGemini?.texto?.trim() ||
      jsonResposta.transcricao ||
      ""
    ).trim();
    const temFala =
      transcricaoFinal.length > 0 &&
      transcricaoFinal !== "[inaudível]" &&
      transcricaoFinal !== "[]";

    const audioInvalido =
      !temFala &&
      (jsonResposta.status_audio === "audio_vazio" ||
        jsonResposta.status_audio === "apenas_ruido" ||
        jsonResposta.status_audio === "apenas_portugues" ||
        jsonResposta.status_audio === "incompreensivel");

    if (audioInvalido) {
      return {
        transcricao: transcricaoFinal || "(nenhuma fala compreendida)",
        respondeu_pergunta: false,
        nota_pronuncia: 1,
        nota_fluencia: 1,
        nota_vocabulario: 1,
        nota_estrutura: 1,
        resultado: "try_again",
        ponto_forte: "Ouvimos sua tentativa de gravação!",
        ponto_melhorar: "Fale um pouquinho mais perto do microfone e tente responder em inglês.",
        palavras: [],
        frase_modelo: fraseExemploPadrao,
        modelo_utilizado: modeloNome,
        detalhes_criterios: {
          pronuncia: {
            nota: 1,
            clareza: "abafada",
            entonacao: "insegura",
            sons_especificos: {},
            observacoes: "Não foi possível identificar sons em inglês no áudio gravado.",
          },
          vocabulario: {
            nota: 1,
            palavras_esperadas_utilizadas: [],
            variedade: "restrita",
            adequacao_tema: false,
            observacoes: "Sem palavras em inglês identificadas.",
          },
          fluencia: {
            nota: 1,
            pausas_excessivas: 1,
            hesitacoes: 1,
            ritmo: "fragmentado",
            observacoes: "Áudio sem fala identificável.",
          },
          estrutura: {
            nota: 1,
            frase_completa: false,
            ordem_palavras_correta: false,
            observacoes: "Sem estrutura identificada.",
          },
        },
      };
    }

    // Extrair notas e detalhes dos 4 critérios
    const c = jsonResposta.criterios || {};
    const cPronuncia = c.pronuncia || {};
    const cVocabulario = c.vocabulario || {};
    const cFluencia = c.fluencia || {};
    const cEstrutura = c.estrutura || {};

    const notaPronuncia = Math.min(Math.max(Number(cPronuncia.nota) || 3, 1), 4);
    let notaVocabulario = Math.min(Math.max(Number(cVocabulario.nota) || 3, 1), 4);
    const notaFluencia = Math.min(Math.max(Number(cFluencia.nota) || 3, 1), 4);
    let notaEstrutura = Math.min(Math.max(Number(cEstrutura.nota) || 3, 1), 4);

    // Verificação determinística de Frase Completa (impede que resposta de 1 palavra / só primeiro nome receba Good Job ou Excellent)
    const tokensSignificativos = transcricaoFinal
      .toLowerCase()
      .replace(/[.,!?;:"'()\[\]]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 0 && !["uh", "um", "ah", "er", "hmm", "eh"].includes(t));

    const temPadraoFraseCompleta =
      /\b(i am|i'm|im|my name is|my name's|it is|it's|its|this is|that is|the cat is|they are|there is|there are|yes i|no i|i have|i wake|i go|i brush|i get|i do|on the left|on the right)\b/i.test(
        transcricaoFinal
      ) ||
      (tokensSignificativos.length >= 3 &&
        /\b(am|is|are|was|were|have|has|do|don't|dont|doesn't|doesnt|wake|wakes|go|goes|brush|get|eat|drink|play|live|like|can)\b/i.test(
          transcricaoFinal
        ));

    const fraseCompleta =
      Boolean(cEstrutura.frase_completa ?? true) &&
      tokensSignificativos.length >= 2 &&
      temPadraoFraseCompleta;

    if (!fraseCompleta) {
      notaEstrutura = Math.min(notaEstrutura, 2);
      if (tokensSignificativos.length <= 1) {
        notaVocabulario = Math.min(notaVocabulario, 3);
      }
    }

    // Palavras avaliadas com feedback fonético
    const rawPalavras: Array<any> = jsonResposta.palavras_avaliadas || [];
    const palavrasAdaptadas: PalavraAnalise[] = rawPalavras.map((p: any) => {
      let status: "ok" | "atencao" | "erro" = "ok";
      if (p.inteligibilidade === "nao_entendida") status = "erro";
      else if (p.inteligibilidade === "com_esforco") status = "atencao";

      const codigoValido = p.codigo_erro && p.codigo_erro in CATALOGO_ERROS ? p.codigo_erro : null;

      let dica = p.dica || null;
      if (status !== "ok" && !dica && codigoValido && CATALOGO_ERROS[codigoValido as CodigoErro]) {
        dica = CATALOGO_ERROS[codigoValido as CodigoErro].dica;
      }
      if (status !== "ok" && !dica) {
        dica = `Ouça a pronúncia de "${p.palavra_alvo || p.palavra}" e tente repetir com clareza.`;
      }

      return {
        palavra: String(p.palavra || "").toLowerCase().replace(/[.,!?]/g, ""),
        palavra_alvo: String(p.palavra_alvo || p.palavra || "").toLowerCase().replace(/[.,!?]/g, ""),
        ouvido: String(p.palavra || ""),
        nota: Math.round((Number(p.precisao) || 90) / 10),
        status,
        codigo_erro: codigoValido,
        dica,
      };
    });

    const fraseModeloFinal =
      jsonResposta.resposta_ideal?.frase && jsonResposta.resposta_ideal.frase.trim().length > 0
        ? jsonResposta.resposta_ideal.frase.trim()
        : fraseExemploPadrao;

    const adequacaoTema = Boolean(cVocabulario.adequacao_tema ?? true);
    const mediaNotas = (notaPronuncia + notaVocabulario + notaFluencia + notaEstrutura) / 4;

    // 4 níveis de incentivo:
    // - "excellent": frase completa + estrutura 4 + pronúncia 4 + vocabulário/fluência >= 3 (média >= 3.75)
    // - "good_job": frase completa + estrutura >= 3 + pronúncia >= 3 + vocabulário >= 3 + fluência >= 2
    // - "doing_ok": respondeu ao tema com pronúncia/vocabulário >= 2, mas sem frase completa (ex: só o primeiro nome) ou com pontos a melhorar
    // - "try_again": não respondeu à pergunta, pronúncia/vocabulário insuficiente (nota 1) ou média < 2
    let resultadoFinal: NivelIncentivo = "try_again";
    if (
      fraseCompleta &&
      adequacaoTema &&
      notaEstrutura === 4 &&
      notaPronuncia === 4 &&
      notaVocabulario >= 3 &&
      notaFluencia >= 3 &&
      mediaNotas >= 3.75
    ) {
      resultadoFinal = "excellent";
    } else if (
      fraseCompleta &&
      adequacaoTema &&
      notaEstrutura >= 3 &&
      notaPronuncia >= 3 &&
      notaVocabulario >= 3 &&
      notaFluencia >= 2
    ) {
      resultadoFinal = "good_job";
    } else if (adequacaoTema && notaPronuncia >= 2 && notaVocabulario >= 2 && mediaNotas >= 2.0) {
      resultadoFinal = "doing_ok";
    } else {
      resultadoFinal = "try_again";
    }

    const pausasCalculadas =
      transcricaoGemini?.metricasFluencia.pausasLongas ?? (cFluencia.pausas_excessivas || 0);
    const hesitacoesCalculadas = Math.max(
      Number(cFluencia.hesitacoes) || 0,
      transcricaoGemini?.metricasFluencia.hesitacoesDetectadas ?? 0
    );

    const observacaoEstruturaPadrao = !fraseCompleta
      ? `Resposta curta ou palavra isolada ("${transcricaoFinal}"). Pratique responder com uma frase completa como "${fraseModeloFinal}".`
      : cEstrutura.observacoes || "Estrutura gramatical e ordem das palavras observadas.";

    let pontoMelhorarFinal =
      jsonResposta.feedback_pedagogico?.ponto_melhorar ||
      "Continue praticando para aperfeiçoar sua pronúncia.";
    if (!fraseCompleta && !/frase completa|full sentence|my name is|i am|it is/i.test(pontoMelhorarFinal)) {
      pontoMelhorarFinal = `Você disse apenas "${transcricaoFinal}". Tente responder usando uma frase completa, por exemplo: "${fraseModeloFinal}"!`;
    }

    const detalhesCriterios: DetalhesCriterios = {
      pronuncia: {
        nota: notaPronuncia,
        clareza: cPronuncia.clareza || "nitida",
        entonacao: cPronuncia.entonacao || "natural",
        sons_especificos: cPronuncia.sons_especificos || {},
        observacoes: cPronuncia.observacoes || "Pronúncia avaliada com sons e clareza observados.",
      },
      vocabulario: {
        nota: notaVocabulario,
        palavras_esperadas_utilizadas: cVocabulario.palavras_esperadas_utilizadas || [],
        variedade: cVocabulario.variedade || "adequada",
        adequacao_tema: adequacaoTema,
        observacoes: cVocabulario.observacoes || "Vocabulário adequado ao tema da atividade.",
      },
      fluencia: {
        nota: notaFluencia,
        pausas_excessivas: pausasCalculadas,
        hesitacoes: hesitacoesCalculadas,
        ritmo: cFluencia.ritmo || "fluido",
        observacoes: cFluencia.observacoes || "Ritmo e pausas observados na fala.",
      },
      estrutura: {
        nota: notaEstrutura,
        frase_completa: fraseCompleta,
        ordem_palavras_correta: cEstrutura.ordem_palavras_correta ?? fraseCompleta,
        observacoes: observacaoEstruturaPadrao,
      },
    };

    return {
      transcricao: transcricaoFinal,
      respondeu_pergunta: adequacaoTema,
      nota_pronuncia: notaPronuncia,
      nota_fluencia: notaFluencia,
      nota_vocabulario: notaVocabulario,
      nota_estrutura: notaEstrutura,
      resultado: resultadoFinal,
      ponto_forte:
        jsonResposta.feedback_pedagogico?.ponto_forte || "Muito bom empenho na resposta em inglês!",
      ponto_melhorar: pontoMelhorarFinal,
      palavras: palavrasAdaptadas,
      frase_modelo: fraseModeloFinal,
      modelo_utilizado: modeloNome,
      detalhes_criterios: detalhesCriterios,
      analise_detalhada: {
        chamada1: jsonResposta,
        motor: { fluencia_motor: notaFluencia * 25, palavras: palavrasAdaptadas },
        chamada2: jsonResposta.feedback_pedagogico || {},
        transcricao_gemini: transcricaoGemini,
      },
    };
  } finally {
    if (arquivoRemoto?.name) {
      await Promise.race([
        removerArquivoGemini(arquivoRemoto.name, ai),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);
    }
  }
}

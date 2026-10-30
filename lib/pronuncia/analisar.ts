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
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { z } from "zod";
import { CODIGOS_ERRO, CodigoErro, CATALOGO_ERROS } from "@/lib/catalogo-erros";
import { createAdminClient } from "@/lib/supabase/admin";

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
- **Uso de frases completas**: O aluno formulou uma oração completa com sujeito e verbo (ex: "It is blue.", "There are two dogs.", "I am ten years old.") ou falou apenas palavras soltas isoladas (ex: "Blue", "Two")?
- **Ordem das palavras**: Respeitou a ordem sintática natural do inglês (SVO: Sujeito + Verbo + Objeto; Adjetivo ANTES do Substantivo: "a blue car" e NUNCA "a car blue")?
- **Concordância**: Empregou concordância básica A1 ("He is" / "They are", singular e plural).

Calibração de Nota de Estrutura (1 a 4):
- 4: Frase completa e correta, com ordem das palavras perfeitamente respeitada.
- 3: Frase quase completa com pequeno deslize que não prejudica a estrutura geral.
- 2: Respondeu apenas com palavra solta isolada (sem formar frase) ou com ordem invertida ("car blue").
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

export interface AnalisePronuncia {
  transcricao: string;
  respondeu_pergunta: boolean;
  nota_pronuncia: number; // 1 a 4
  nota_fluencia: number;  // 1 a 4
  nota_vocabulario: number; // 1 a 4
  nota_estrutura: number; // 1 a 4
  resultado: "good_job" | "try_again";
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
  };
}

export const MODELOS_RECOMENDADOS = [
  {
    id: "gemini-3.8-flash",
    nome: "Gemini 3.8 Flash",
    descricao: "Recomendado oficial (Mais inteligente, multimodal moderno e rápido)",
  },
  {
    id: "gemini-3.6-flash",
    nome: "Gemini 3.6 Flash",
    descricao: "Modelo de produção estável com alta capacidade",
  },
  {
    id: "gemini-3.5-flash-lite",
    nome: "Gemini 3.5 Flash-Lite",
    descricao: "Ultra rápido, menor latência e ideal para contornar picos de demanda",
  },
  {
    id: "gemini-2.5-flash",
    nome: "Gemini 2.5 Flash",
    descricao: "Versão consagrada e econômica",
  },
  {
    id: "gemini-flash-latest",
    nome: "Gemini Flash Latest",
    descricao: "Apelido dinâmico para a versão mais recente",
  },
];

let modeloAtivoCache: string = "gemini-3.8-flash";
let ultimoFetchConfig = 0;

export function atualizarModeloAtivoCache(modelo: string) {
  modeloAtivoCache = modelo.replace(/^models\//, "").trim();
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
      modeloAtivoCache = data.valor.trim();
      ultimoFetchConfig = agora;
      return modeloAtivoCache;
    }
  } catch (err) {
    console.warn("[pronuncia] Aviso ao ler configuracoes do banco:", err);
  }

  const envModel = process.env.GEMINI_MODEL?.trim().replace(/^models\//, "");
  if (
    envModel &&
    !envModel.startsWith("gemini-1.5") &&
    !envModel.startsWith("gemini-2.0")
  ) {
    modeloAtivoCache = envModel;
  }

  return modeloAtivoCache;
}

export async function obterModelosCandidatos(): Promise<string[]> {
  const modeloConfigurado = await obterModeloConfigurado();
  return Array.from(
    new Set([
      modeloConfigurado,
      "gemini-3.8-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash-lite",
      "gemini-2.5-flash",
      "gemini-flash-latest",
    ])
  );
}

async function executarComFallback(
  chamadaFn: (genModel: ReturnType<typeof google>, nomeModelo: string) => Promise<{ text: string }>
): Promise<{ text: string; modeloUsado: string }> {
  const modelos = await obterModelosCandidatos();
  let ultimoErro: unknown = null;

  for (const modelo of modelos) {
    for (let tentativa = 1; tentativa <= 2; tentativa++) {
      try {
        const genModel = google(modelo);
        const res = await chamadaFn(genModel, modelo);
        modeloAtivoCache = modelo;
        return { text: res.text, modeloUsado: modelo };
      } catch (err: unknown) {
        ultimoErro = err;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[pronuncia] Falha com modelo ${modelo} (tentativa ${tentativa}):`, msg);

        const isHighDemandOrLimit =
          msg.includes("high demand") ||
          msg.includes("Spikes in demand") ||
          msg.includes("429") ||
          msg.includes("503") ||
          msg.includes("overloaded") ||
          msg.includes("quota") ||
          msg.includes("RESOURCE_EXHAUSTED");

        const isDeprecatedOrTimeout =
          msg.includes("not found") ||
          msg.includes("not supported") ||
          msg.includes("no longer available") ||
          msg.includes("AbortError") ||
          msg.includes("timeout") ||
          msg.includes("timed out");

        if (isHighDemandOrLimit && tentativa === 1) {
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }

        if (isHighDemandOrLimit || isDeprecatedOrTimeout) {
          break;
        }

        throw err;
      }
    }
  }

  throw ultimoErro;
}

export async function analisarPronuncia(
  audioWav: Uint8Array,
  pergunta: ContextoPergunta
): Promise<AnalisePronuncia> {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new ConfigIAAusenteError("GOOGLE_GENERATIVE_AI_API_KEY não configurada");
  }

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

  const inputAudicao = `PERGUNTA: ${pergunta.enunciado}
TIPO_ATIVIDADE: ${tipoMapeado}
CONTEXTO_IMAGEM: ${contextoImagem}
RESPOSTAS_ESPERADAS: ${respostaEsperada}
FOCO_AVALIACAO: ${pergunta.foco_avaliacao?.join(", ") || "Pronúncia geral, clareza e estrutura"}
ÁUDIO DO ALUNO: (arquivo de áudio .wav anexo)`;

  // Execução direta com fallback resiliente entre versões do Gemini
  const resultado = await executarComFallback(async (genModel) => {
    return await generateText({
      model: genModel,
      system:
        PROMPT_AVALIACAO_PROFUNDA +
        "\n\nCRÍTICO: Retorne ESTRITAMENTE um JSON válido com todos os campos solicitados. Não inclua blocos markdown (```json).",
      temperature: 0.0,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(12000),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: inputAudicao },
            { type: "file", mediaType: "audio/wav", data: audioWav },
          ],
        },
      ],
    });
  });

  const modeloNome = resultado.modeloUsado;
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

  const transcricao = (jsonResposta.transcricao || "").trim();
  const temFala = transcricao.length > 0 && transcricao !== "[inaudível]" && transcricao !== "[]";

  const audioInvalido =
    !temFala &&
    (jsonResposta.status_audio === "audio_vazio" ||
      jsonResposta.status_audio === "apenas_ruido" ||
      jsonResposta.status_audio === "apenas_portugues" ||
      jsonResposta.status_audio === "incompreensivel");

  if (audioInvalido) {
    return {
      transcricao: transcricao || "(nenhuma fala compreendida)",
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
  const notaVocabulario = Math.min(Math.max(Number(cVocabulario.nota) || 3, 1), 4);
  const notaFluencia = Math.min(Math.max(Number(cFluencia.nota) || 3, 1), 4);
  const notaEstrutura = Math.min(Math.max(Number(cEstrutura.nota) || 3, 1), 4);

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

  const resultadoFinal: "good_job" | "try_again" =
    notaPronuncia >= 3 && notaVocabulario >= 2 && notaEstrutura >= 2 ? "good_job" : "try_again";

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
      adequacao_tema: cVocabulario.adequacao_tema ?? true,
      observacoes: cVocabulario.observacoes || "Vocabulário adequado ao tema da atividade.",
    },
    fluencia: {
      nota: notaFluencia,
      pausas_excessivas: cFluencia.pausas_excessivas || 0,
      hesitacoes: cFluencia.hesitacoes || 0,
      ritmo: cFluencia.ritmo || "fluido",
      observacoes: cFluencia.observacoes || "Ritmo e pausas observados na fala.",
    },
    estrutura: {
      nota: notaEstrutura,
      frase_completa: cEstrutura.frase_completa ?? true,
      ordem_palavras_correta: cEstrutura.ordem_palavras_correta ?? true,
      observacoes: cEstrutura.observacoes || "Estrutura gramatical e ordem das palavras observadas.",
    },
  };

  return {
    transcricao: jsonResposta.transcricao || "",
    respondeu_pergunta: cVocabulario.adequacao_tema ?? true,
    nota_pronuncia: notaPronuncia,
    nota_fluencia: notaFluencia,
    nota_vocabulario: notaVocabulario,
    nota_estrutura: notaEstrutura,
    resultado: resultadoFinal,
    ponto_forte:
      jsonResposta.feedback_pedagogico?.ponto_forte || "Muito bom empenho na resposta em inglês!",
    ponto_melhorar:
      jsonResposta.feedback_pedagogico?.ponto_melhorar ||
      "Continue praticando para aperfeiçoar sua pronúncia.",
    palavras: palavrasAdaptadas,
    frase_modelo: fraseModeloFinal,
    modelo_utilizado: modeloNome,
    detalhes_criterios: detalhesCriterios,
    analise_detalhada: {
      chamada1: jsonResposta,
      motor: { fluencia_motor: notaFluencia * 25, palavras: palavrasAdaptadas },
      chamada2: jsonResposta.feedback_pedagogico || {},
    },
  };
}

/**
 * Análise de pronúncia com Gemini (áudio → transcrição + notas + feedback pt-BR).
 * Arquitetura Híbrida (v2):
 * - Chamada 1: Transcrição, coerência, gramática e naturalidade.
 * - Motor de Pronúncia: (Simulado nesta versão) Precisão por palavra e fluência.
 * - Chamada 2: Explicação e feedback pedagógico.
 * Somente servidor.
 */
import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { z } from "zod";
import { CODIGOS_ERRO, CodigoErro } from "@/lib/catalogo-erros";

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
// CHAMADA 1: ANÁLISE DE CONTEÚDO
// ============================================================================

export const PROMPT_CHAMADA_1 = `Você é um avaliador de inglês oral para alunos brasileiros de 9 a 12 anos, nível A1 do CEFR, em atividades no formato Cambridge Young Learners (Starters/Movers). Nesta etapa você avalia **o que** o aluno disse, não a pronúncia.

## ENTRADAS
- PERGUNTA: a pergunta feita ao aluno.
- TIPO_ATIVIDADE: pergunta_oral, pergunta_com_imagem ou comparacao_de_cenas.
- CONTEXTO_IMAGEM (opcional): descrição da imagem ou das duas cenas.
- ÁUDIO: a gravação do aluno.

## REGRA PRINCIPAL: TRANSREVA O QUE FOI DITO
- Nunca corrija a fala na transcrição. Escreva as palavras como você as reconheceu, mesmo que estejam erradas ou fora de contexto.
- Registre hesitações (uh, hmm), repetições, autocorreções e palavras em português.
- Trechos que você não entendeu viram [inaudível]. Nunca invente palavras.
- Se o áudio estiver vazio, só com ruído ou só em português, informe no campo status_audio e deixe as demais análises vazias.

## ETAPAS
1. Transcrição literal, seguindo a regra acima.
2. Coerência: a resposta atende à pergunta? Nas atividades com imagem, o conteúdo bate com a cena? Respostas curtas típicas do A1 ("Ten.", "It's red.") são coerentes.
3. Erros gramaticais: sintaxe, concordância verbal e nominal, ordem das palavras, palavra faltando. Para cada erro: trecho, explicação em uma frase e correção. Lista vazia se não houver erros.
4. Naturalidade: a frase soaria natural para um falante de inglês? Aponte construções traduzidas do português (ex.: "I have 10 years" em vez de "I'm 10 years old").
5. Indícios de fluência: conte pausas longas, hesitações e autocorreções. Não atribua nota; apenas registre.

## SAÍDA
Somente o objeto JSON do schema analiseSchema. Comentários em português do Brasil; transcrição em inglês.`;

export const erroGramaticalSchema = z.object({
  trecho: z.string().describe("Trecho com erro gramatical."),
  explicacao: z.string().describe("Explicação simples do erro em português."),
  correcao: z.string().describe("Correção sugerida em inglês."),
});

export const analiseChamada1Schema = z.object({
  status_audio: z
    .enum(["sucesso", "audio_vazio", "apenas_ruido", "apenas_portugues", "incompreensivel"])
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

// ============================================================================
// SIMULAÇÃO DO MOTOR DE PRONÚNCIA (até integração real do Azure)
// ============================================================================

export interface FonemaFraco {
  esperado: string;
  precisao: number;
}

export interface PalavraMotor {
  palavra: string;
  precisao: number;
  inteligibilidade: "clara" | "com_esforco" | "nao_entendida";
  fonemas_fracos: FonemaFraco[];
}

export interface PronunciaMotor {
  fluencia_motor: number; // 0 a 100
  palavras: PalavraMotor[];
}

/**
 * Função temporária para simular o retorno do motor de pronúncia com base na transcrição.
 * Na integração final com o Azure, esta função será substituída pela chamada real.
 */
function simularMotorDePronuncia(transcricao: string): PronunciaMotor {
  const palavras = transcricao
    .split(/\s+/)
    .filter((w) => w.length > 0 && !w.match(/\[.*\]/))
    .map((w) => w.replace(/[.,!?]/g, "").toLowerCase());

  return {
    fluencia_motor: 85,
    palavras: palavras.map((palavra) => {
      // Aleatoriza levemente ou apenas assume "clara" para evitar falsos positivos nos testes.
      return {
        palavra,
        precisao: 90,
        inteligibilidade: "clara",
        fonemas_fracos: [],
      };
    }),
  };
}

// ============================================================================
// CHAMADA 2: FEEDBACK PEDAGÓGICO
// ============================================================================

export const PROMPT_CHAMADA_2 = `Você é um professor de inglês para crianças brasileiras de 9 a 12 anos, nível A1. Você recebe a análise do conteúdo e as notas de pronúncia de um motor especializado, e transforma isso em explicações claras e em um feedback encorajador.

## ENTRADAS
- PERGUNTA e TIPO_ATIVIDADE.
- RESPOSTA_ESPERADA (opcional).
- ANALISE: o JSON da Chamada 1.
- PRONUNCIA: as notas do motor, por palavra, já classificadas pelo sistema.
- ÁUDIO: a gravação, apenas para contextualizar a explicação.

## REGRAS SOBRE A PRONÚNCIA
- Não altere as notas nem a classificação de inteligibilidade. Elas vêm do motor e são a fonte de verdade.
- Se PRONUNCIA vier vazio ou ausente, escreva que a pronúncia não foi avaliada.
- Para cada palavra com inteligibilidade diferente de "clara", explique o que aconteceu usando os fonemas_fracos e associe ao catálogo de interferências.
- Palavras "clara" com sotaque leve não são tratadas como erro para o aluno.

## CATÁLOGO DE INTERFERÊNCIAS DO PORTUGUÊS
- TH: /θ/ e /ð/ trocados por /t/, /f/ ou /d/
- R_INICIAL: R inglês como R forte do português
- EPENTESE: Vogal extra em encontro ou final consonantal (stop -> istópi)
- SUFIXO_ED: -ed lido como sílaba inteira
- VOGAL_CURTA_LONGA: Pares de vogais neutralizados (ship/sheep)
- V_W: Troca entre /v/ e /w/
- Y_INICIAL: Perda do /j/ inicial (years -> ears)
- H_ASPIRADO: /h/ omitido ou como R
- CONSOANTE_FINAL: Final omitido ou nasalizado
- OUTRO / NENHUM

## ETAPAS
1. Explicação por palavra: para cada palavra não "clara" recebida na PRONUNCIA, crie um comentário de uma frase com o código do catálogo (se aplicável) e a dica de articulação.
2. Resposta ideal: como o aluno deveria responder, de forma correta e natural. Use a RESPOSTA_ESPERADA se houver. Indique se a resposta original já estava correta.
3. Sugestão de notas: Notas de 1 a 4 para Vocabulário e Estrutura, justificadas. 
4. Comentário para o professor: 2 a 4 frases técnicas.
5. Feedback para o aluno: 2 a 3 frases em português do Brasil, tom lúdico. Elogie primeiro, dê UMA dica principal, sem termos técnicos.

## SAÍDA
Somente o objeto JSON do schema feedbackSchema.`;

export const palavraFeedbackSchema = z.object({
  palavra: z.string().describe("Palavra avaliada"),
  inteligibilidade: z.enum(["clara", "com_esforco", "nao_entendida"]).describe("Repasse do motor"),
  erro_catalogo: z.enum(CODIGOS_ERRO).describe("Código do catálogo aplicável (ou NENHUM)"),
  explicacao: z.string().describe("Dica de articulação ou elogio curto."),
});

export const feedbackChamada2Schema = z.object({
  palavras_feedback: z.array(palavraFeedbackSchema).describe("Feedback individual para cada palavra avaliada do motor."),
  resposta_ideal: z.object({
    frase: z.string().describe("Resposta modelo completa e curta em nível A1."),
    original_estava_correta: z.boolean().describe("true se a resposta original do aluno já estava correta."),
  }),
  sugestao_notas: z.object({
    vocabulario: z.number().min(1).max(4).describe("Sugestão de nota 1 a 4 para Vocabulário"),
    justificativa_vocabulario: z.string(),
    estrutura: z.number().min(1).max(4).describe("Sugestão de nota 1 a 4 para Estrutura"),
    justificativa_estrutura: z.string(),
  }),
  comentario_professor: z.string().describe("Comentário técnico para o professor (sotaque, erros específicos)."),
  feedback_aluno: z.object({
    ponto_forte: z.string().describe("Elogio curto do que o aluno acertou."),
    ponto_melhorar: z.string().describe("Uma única dica principal concreta para melhorar."),
    mensagem_completa: z.string().describe("2 a 3 frases em português, lúdicas e encorajadoras para a criança."),
  }),
});

export type FeedbackChamada2 = z.infer<typeof feedbackChamada2Schema>;

// ============================================================================
// CONSOLIDAÇÃO DA ANÁLISE (UI E BD)
// ============================================================================

export interface PalavraAnalise {
  palavra: string;
  status: "ok" | "atencao" | "erro";
  codigo_erro: CodigoErro | null;
  dica: string | null;
  nota: number; // mantido para compatibilidade, será convertido da precisão do motor (0 a 10)
  ouvido: string;
  palavra_alvo: string;
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
  analise_detalhada?: {
    chamada1: AnaliseChamada1;
    motor: PronunciaMotor;
    chamada2: FeedbackChamada2;
  };
}

function calcularMetricasHibridas(
  chamada1: AnaliseChamada1,
  motor: PronunciaMotor,
  chamada2: FeedbackChamada2
): {
  nota_pronuncia: number;
  nota_fluencia: number;
  nota_vocabulario: number;
  nota_estrutura: number;
  resultado: "good_job" | "try_again";
  palavrasAdaptadas: PalavraAnalise[];
} {
  if (chamada1.status_audio !== "sucesso") {
    return {
      nota_pronuncia: 1,
      nota_fluencia: 1,
      nota_vocabulario: 1,
      nota_estrutura: 1,
      resultado: "try_again",
      palavrasAdaptadas: [],
    };
  }

  // Regra de Pronúncia: proporção de palavras 'clara'
  const totalPalavras = motor.palavras.length;
  const claras = motor.palavras.filter(p => p.inteligibilidade === "clara").length;
  const proporcaoClaras = totalPalavras > 0 ? claras / totalPalavras : 0;
  
  let notaPronuncia1a4 = 1;
  if (totalPalavras > 0) {
    if (proporcaoClaras >= 0.85) notaPronuncia1a4 = 4;
    else if (proporcaoClaras >= 0.65) notaPronuncia1a4 = 3;
    else if (proporcaoClaras >= 0.40) notaPronuncia1a4 = 2;
    else notaPronuncia1a4 = 1;
  }

  // Regra de Fluência: fluência do motor + hesitações
  let baseFluencia = 4;
  if (motor.fluencia_motor < 50) baseFluencia = 2;
  else if (motor.fluencia_motor < 70) baseFluencia = 3;

  const hesits = chamada1.indicios_fluencia.hesitacoes + chamada1.indicios_fluencia.pausas_longas;
  let notaFluencia1a4 = baseFluencia;
  if (hesits >= 4 || chamada1.transcricao.includes("[inaudível]")) notaFluencia1a4 = Math.min(baseFluencia, 2);
  else if (hesits >= 2) notaFluencia1a4 = Math.min(baseFluencia, 3);

  // Vocabulário e Estrutura (do feedback, ou limitados pelas regras do prompt original se preferir)
  const notaVocabulario1a4 = chamada2.sugestao_notas.vocabulario;
  const notaEstrutura1a4 = chamada2.sugestao_notas.estrutura;

  // Palavras adaptadas para UI
  const palavrasAdaptadas: PalavraAnalise[] = motor.palavras.map((pm) => {
    const feedbackInfo = chamada2.palavras_feedback.find(pf => pf.palavra.toLowerCase() === pm.palavra.toLowerCase());
    
    let status: "ok" | "atencao" | "erro" = "ok";
    if (pm.inteligibilidade === "nao_entendida") status = "erro";
    else if (pm.inteligibilidade === "com_esforco") status = "atencao";

    return {
      palavra: pm.palavra,
      palavra_alvo: pm.palavra,
      ouvido: pm.palavra, // Motor ainda não nos dá "ouvida" detalhada, mantemos para compatibilidade
      nota: Math.round(pm.precisao / 10), // Converte precisão de 0-100 para escala 0-10
      status,
      codigo_erro: feedbackInfo && feedbackInfo.erro_catalogo !== "NENHUM" ? feedbackInfo.erro_catalogo : null,
      dica: status === "ok" ? null : (feedbackInfo?.explicacao || null),
    };
  });

  const resultado: "good_job" | "try_again" =
    notaPronuncia1a4 >= 3 && chamada1.coerencia.coerente ? "good_job" : "try_again";

  return {
    nota_pronuncia: notaPronuncia1a4,
    nota_fluencia: notaFluencia1a4,
    nota_vocabulario: notaVocabulario1a4,
    nota_estrutura: notaEstrutura1a4,
    resultado,
    palavrasAdaptadas,
  };
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

  const genModel = google(process.env.GEMINI_MODEL || "gemini-1.5-flash");

  // --- CHAMADA 1: CONTEÚDO ---
  const inputChamada1 = `PERGUNTA: ${pergunta.enunciado}
TIPO_ATIVIDADE: ${tipoMapeado}
CONTEXTO_IMAGEM: ${contextoImagem}
ÁUDIO: (arquivo anexo)`;

  const response1 = await generateText({
    model: genModel,
    system: PROMPT_CHAMADA_1,
    temperature: 0.0,
    output: Output.object({ schema: analiseChamada1Schema }),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: inputChamada1 },
          { type: "file", mediaType: "audio/wav", data: audioWav },
        ],
      },
    ],
  });
  
  const analise1 = response1.output;

  if (analise1.status_audio !== "sucesso") {
    const defaultFeedback: FeedbackChamada2 = {
      palavras_feedback: [],
      resposta_ideal: { frase: "", original_estava_correta: false },
      sugestao_notas: { vocabulario: 1, justificativa_vocabulario: "", estrutura: 1, justificativa_estrutura: "" },
      comentario_professor: "Áudio não avaliável.",
      feedback_aluno: {
        ponto_forte: "",
        ponto_melhorar: "Tente gravar novamente, não conseguimos te ouvir direito.",
        mensagem_completa: "Parece que houve um problema com o áudio! Grave de novo falando bem pertinho do microfone."
      }
    };
    
    return {
      transcricao: analise1.transcricao || "",
      respondeu_pergunta: false,
      nota_pronuncia: 1,
      nota_fluencia: 1,
      nota_vocabulario: 1,
      nota_estrutura: 1,
      resultado: "try_again",
      ponto_forte: defaultFeedback.feedback_aluno.ponto_forte,
      ponto_melhorar: defaultFeedback.feedback_aluno.ponto_melhorar,
      palavras: [],
      frase_modelo: "",
      analise_detalhada: {
        chamada1: analise1,
        motor: { fluencia_motor: 0, palavras: [] },
        chamada2: defaultFeedback
      }
    };
  }

  // --- SIMULAÇÃO MOTOR DE PRONÚNCIA ---
  const motor = simularMotorDePronuncia(analise1.transcricao);

  // --- CHAMADA 2: FEEDBACK ---
  const inputChamada2 = `PERGUNTA: ${pergunta.enunciado}
TIPO_ATIVIDADE: ${tipoMapeado}
RESPOSTA_ESPERADA: ${respostaEsperada}
ANALISE: ${JSON.stringify(analise1, null, 2)}
PRONUNCIA: ${JSON.stringify(motor, null, 2)}
ÁUDIO: (arquivo anexo)`;

  const response2 = await generateText({
    model: genModel,
    system: PROMPT_CHAMADA_2,
    temperature: 0.0,
    output: Output.object({ schema: feedbackChamada2Schema }),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: inputChamada2 },
          { type: "file", mediaType: "audio/wav", data: audioWav },
        ],
      },
    ],
  });
  
  const analise2 = response2.output;

  // --- CONSOLIDAÇÃO ---
  const metricas = calcularMetricasHibridas(analise1, motor, analise2);

  return {
    transcricao: analise1.transcricao,
    respondeu_pergunta: analise1.coerencia.coerente,
    nota_pronuncia: metricas.nota_pronuncia,
    nota_fluencia: metricas.nota_fluencia,
    nota_vocabulario: metricas.nota_vocabulario,
    nota_estrutura: metricas.nota_estrutura,
    resultado: metricas.resultado,
    ponto_forte: analise2.feedback_aluno.ponto_forte,
    ponto_melhorar: analise2.feedback_aluno.ponto_melhorar,
    palavras: metricas.palavrasAdaptadas,
    frase_modelo: analise2.resposta_ideal.frase,
    analise_detalhada: {
      chamada1: analise1,
      motor,
      chamada2: analise2,
    },
  };
}

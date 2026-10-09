/**
 * Análise de pronúncia com Gemini (áudio → transcrição + notas + feedback pt-BR).
 * Utiliza o Prompt Oficial de Avaliação Oral — SpeakUp A1.
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

export const SYSTEM_PROMPT = `# Prompt de Avaliação Oral — SpeakUp A1

## PAPEL
Você é um avaliador de inglês oral especializado em fonética, gramática e fluência. Você avalia alunos brasileiros de 9 a 12 anos, nível A1 do CEFR, em atividades no formato Cambridge Young Learners (Starters/Movers).

A referência de pronúncia é o inglês americano nativo (General American). Você conhece bem as interferências do português brasileiro no inglês.

## ENTRADAS
Você vai receber:
- PERGUNTA: a pergunta feita ao aluno.
- TIPO_ATIVIDADE: pergunta_oral, pergunta_com_imagem ou comparacao_de_cenas.
- CONTEXTO_IMAGEM (opcional): descrição do que aparece na imagem ou nas duas cenas. Use para julgar se a resposta está correta.
- RESPOSTA_ESPERADA (opcional): uma resposta de referência do professor.
- ÁUDIO: a gravação do aluno.

## REGRA MAIS IMPORTANTE: TRANSCREVA O QUE FOI DITO, NÃO O QUE DEVERIA SER DITO
- Nunca corrija a fala na transcrição. Se o aluno disse "tree" querendo dizer "three", a transcrição não pode esconder isso.
- Registre hesitações (uh, hmm), repetições, autocorreções e palavras em português exatamente como ocorreram.
- Trechos que você não conseguiu entender viram [inaudível]. Nunca invente palavras.
- Se o áudio estiver vazio, só com ruído ou só em português, informe isso no campo de status e não invente uma avaliação.

## ETAPAS DA ANÁLISE

### 1. Transcrição
Transcreva a fala do aluno palavra por palavra, seguindo a regra acima.

### 2. Coerência com a pergunta
Diga se a resposta faz sentido e responde ao que foi perguntado. Nas atividades com imagem, confira também se o conteúdo bate com a imagem (cor, posição, objeto). Escreva um comentário curto explicando o julgamento.
Considere o nível A1: respostas curtas e diretas ("Ten.", "It's red.") são coerentes. Não penalize a falta de frase completa nesta etapa.

### 3. Erros gramaticais
Analise sintaxe, concordância verbal e nominal, ordem das palavras e palavras faltando (ex.: "The cat is on box"). Para cada erro, mostre o trecho, explique em uma frase e dê a correção. Se não houver erros, retorne a lista vazia.

### 4. Naturalidade
A frase soa como algo que um americano nativo diria? Aponte construções traduzidas ao pé da letra do português (ex.: "I have 10 years" em vez de "I'm 10 years old").

### 5. Pronúncia palavra por palavra (nota de 0 a 10)
Para cada palavra da transcrição (exceto hesitações e [inaudível]), informe:
- palavra_alvo: a palavra que o aluno tentou dizer, na grafia correta.
- ouvido: como ela soou, em grafia aproximada (ex.: "tri" para three, "istópi" para stop). Se soou correta, repita a palavra.
- nota de 0 a 10, seguindo esta régua:
  * 10 = Indistinguível de um nativo americano
  * 8–9 = Sotaque leve, palavra totalmente clara
  * 6–7 = Um som com interferência perceptível, mas a palavra é reconhecida sem esforço
  * 4–5 = Troca de som que pode gerar confusão com outra palavra (three → tree)
  * 2–3 = Palavra difícil de reconhecer
  * 0–1 = Irreconhecível ou outra palavra
- erro_catalogo: a interferência principal, se houver:
  * TH — three como "tree" ou "free"; this como "dis"
  * R_INICIAL — red soando como "hed" (R de "rato")
  * EPENTESE — vogal extra: stop → "istópi", big → "bigui"
  * SUFIXO_ED — ler a sílaba inteira: played → "pleiédi"
  * VOGAL_CURTA_LONGA — ship/sheep, live/leave
  * V_W — troca entre V e W
  * Y_INICIAL — years soando como ears
  * H_ASPIRADO — house soando com R ou sem H
  * CONSOANTE_FINAL — final engolido ou nasalizado (cat → "ké", time → "taimi")
  * OUTRO / NENHUM
- comentario: uma frase justificando a nota, com uma dica de articulação quando houver erro (posição da língua, lábios, sopro).
Seja consistente: o mesmo erro, com a mesma intensidade, recebe a mesma nota.

### 6. Resposta ideal
Escreva como o aluno deveria responder, de forma correta e natural, dentro do vocabulário e da gramática do nível A1. Use frase curta e completa (ex.: "I'm ten years old."). Indique se a resposta original do aluno já estava correta.

### 7. Feedback para o aluno
Escreva de 2 a 3 frases em português do Brasil, em tom lúdico e encorajador, para uma criança de 9 a 12 anos:
- Comece por algo que o aluno acertou.
- Dê uma dica principal (a mais importante), de forma concreta.
- Nunca use termos técnicos (epêntese, fonema, concordância) e nunca desencoraje.

## FORMATO DA SAÍDA
Responda somente com o objeto JSON definido no schema. Todos os comentários em português do Brasil; transcrições, palavras e respostas ideais em inglês.
Não calcule a média das notas. O sistema calcula a partir das notas por palavra.`;

export const palavraPronunciaSchema = z.object({
  palavra_alvo: z.string().describe("A palavra que o aluno tentou dizer, na grafia correta em inglês."),
  ouvido: z.string().describe("Como soou aproximadamente (ex.: 'tri' para three, 'istópi' para stop). Se soou correta, repita."),
  nota: z.number().min(0).max(10).describe("Nota de 0 a 10 pela régua de pronúncia."),
  erro_catalogo: z.enum(CODIGOS_ERRO).describe("Código de erro do catálogo ou NENHUM."),
  comentario: z.string().describe("Justificativa da nota com dica de articulação se houver erro."),
});

export const erroGramaticalSchema = z.object({
  trecho: z.string().describe("Trecho com erro gramatical."),
  explicacao: z.string().describe("Explicação curta do erro em português."),
  correcao: z.string().describe("Correção sugerida em inglês."),
});

export const analiseBrutaSchema = z.object({
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
  palavras: z.array(palavraPronunciaSchema).describe("Avaliação fonética para cada palavra dita."),
  resposta_ideal: z.object({
    frase: z.string().describe("Resposta modelo completa e curta em nível A1."),
    original_estava_correta: z.boolean().describe("true se a resposta original do aluno já estava correta."),
  }),
  feedback_aluno: z.object({
    ponto_forte: z.string().describe("Elogio curto do que o aluno acertou."),
    ponto_melhorar: z.string().describe("Uma única dica principal concreta para melhorar."),
    mensagem_completa: z.string().describe("2 a 3 frases em português, lúdicas e encorajadoras para a criança."),
  }),
});

export type AnaliseBruta = z.infer<typeof analiseBrutaSchema>;

export interface PalavraAnalise {
  palavra: string;
  status: "ok" | "atencao" | "erro";
  codigo_erro: CodigoErro | null;
  dica: string | null;
  nota: number;
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
  analise_detalhada?: AnaliseBruta;
}

/**
 * Converte notas de 0-10 e análises qualitativas para a escala 1-4 (rubrica CEFR A1)
 */
function calcularMetricasSistema(bruta: AnaliseBruta): {
  nota_pronuncia: number;
  nota_fluencia: number;
  nota_vocabulario: number;
  nota_estrutura: number;
  resultado: "good_job" | "try_again";
  palavrasAdaptadas: PalavraAnalise[];
} {
  const { status_audio, palavras, coerencia, erros_gramaticais, transcricao } = bruta;

  if (status_audio !== "sucesso") {
    return {
      nota_pronuncia: 1,
      nota_fluencia: 1,
      nota_vocabulario: 1,
      nota_estrutura: 1,
      resultado: "try_again",
      palavrasAdaptadas: [],
    };
  }

  // 1. Pronúncia (a partir das notas das palavras)
  let notaPronuncia1a4 = 1;
  if (palavras.length > 0) {
    const soma = palavras.reduce((acc, p) => acc + p.nota, 0);
    const media0a10 = soma / palavras.length;
    if (media0a10 >= 8.5) notaPronuncia1a4 = 4;
    else if (media0a10 >= 6.0) notaPronuncia1a4 = 3;
    else if (media0a10 >= 3.5) notaPronuncia1a4 = 2;
    else notaPronuncia1a4 = 1;
  }

  // 2. Fluência (baseado em ritmo, hesitações e pausas identificadas na transcrição)
  const hesitacoes = (transcricao.match(/\b(uh|um|hmm|er|éé|ah)\b/gi) || []).length;
  let notaFluencia1a4 = 4;
  if (hesitacoes >= 4 || transcricao.includes("[inaudível]")) {
    notaFluencia1a4 = 2;
  } else if (hesitacoes >= 2) {
    notaFluencia1a4 = 3;
  }

  // 3. Vocabulário (coerência com a pergunta e adequação ao A1)
  let notaVocabulario1a4 = 3;
  if (coerencia.coerente && palavras.length >= 2) {
    notaVocabulario1a4 = 4;
  } else if (!coerencia.coerente) {
    notaVocabulario1a4 = 2;
  }

  // 4. Estrutura (gramática e sintaxe)
  let notaEstrutura1a4 = 4;
  if (erros_gramaticais.length > 2) {
    notaEstrutura1a4 = 1;
  } else if (erros_gramaticais.length === 2) {
    notaEstrutura1a4 = 2;
  } else if (erros_gramaticais.length === 1) {
    notaEstrutura1a4 = 3;
  }

  // Palavras adaptadas para a UI
  const palavrasAdaptadas: PalavraAnalise[] = palavras.map((p) => {
    const status: "ok" | "atencao" | "erro" =
      p.nota >= 8 ? "ok" : p.nota >= 5 ? "atencao" : "erro";
    const codigo_erro = p.erro_catalogo === "NENHUM" ? null : p.erro_catalogo;

    return {
      palavra: p.palavra_alvo,
      palavra_alvo: p.palavra_alvo,
      ouvido: p.ouvido,
      nota: p.nota,
      status,
      codigo_erro,
      dica: status === "ok" ? null : p.comentario,
    };
  });

  const resultado: "good_job" | "try_again" =
    notaPronuncia1a4 >= 3 && coerencia.coerente ? "good_job" : "try_again";

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

  const textoUsuario = `PERGUNTA: ${pergunta.enunciado}
TIPO_ATIVIDADE: ${tipoMapeado}
CONTEXTO_IMAGEM: ${contextoImagem}
RESPOSTA_ESPERADA: ${respostaEsperada}
ÁUDIO: (arquivo anexo)`;

  const { output } = await generateText({
    model: google(process.env.GEMINI_MODEL || "gemini-flash-latest"),
    system: SYSTEM_PROMPT,
    temperature: 0.2,
    output: Output.object({ schema: analiseBrutaSchema }),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: textoUsuario },
          { type: "file", mediaType: "audio/wav", data: audioWav },
        ],
      },
    ],
  });

  const metricas = calcularMetricasSistema(output);

  return {
    transcricao: output.transcricao,
    respondeu_pergunta: output.coerencia.coerente,
    nota_pronuncia: metricas.nota_pronuncia,
    nota_fluencia: metricas.nota_fluencia,
    nota_vocabulario: metricas.nota_vocabulario,
    nota_estrutura: metricas.nota_estrutura,
    resultado: metricas.resultado,
    ponto_forte: output.feedback_aluno.ponto_forte,
    ponto_melhorar: output.feedback_aluno.ponto_melhorar,
    palavras: metricas.palavrasAdaptadas,
    frase_modelo: output.resposta_ideal.frase,
    analise_detalhada: output,
  };
}

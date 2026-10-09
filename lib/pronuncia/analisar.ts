/**
 * Análise de pronúncia com Gemini (áudio → transcrição + notas + feedback pt-BR).
 * Somente servidor.
 */
import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { z } from "zod";
import { CATALOGO_ERROS, CODIGOS_ERRO } from "@/lib/catalogo-erros";

const nota = z.number().int().min(1).max(4);

export const analiseSchema = z.object({
  transcricao: z.string().describe("O que o aluno realmente disse, em inglês, palavra por palavra."),
  respondeu_pergunta: z.boolean().describe("true se a fala responde ao que foi perguntado."),
  nota_pronuncia: nota,
  nota_fluencia: nota,
  nota_vocabulario: nota,
  nota_estrutura: nota,
  resultado: z.enum(["good_job", "try_again"]),
  ponto_forte: z.string().describe("Elogio curto e específico, em português, para criança."),
  ponto_melhorar: z.string().describe("Uma única coisa para melhorar, em português, para criança."),
  palavras: z
    .array(
      z.object({
        palavra: z.string(),
        status: z.enum(["ok", "atencao", "erro"]),
        codigo_erro: z.enum(CODIGOS_ERRO).nullable(),
        dica: z.string().nullable().describe("Dica curta em português de como pronunciar. null se status = ok."),
      })
    )
    .describe("Cada palavra falada, na ordem."),
  frase_modelo: z.string().describe("Uma resposta modelo curta, em inglês A1, parecida com a do aluno."),
});

export type AnalisePronuncia = z.infer<typeof analiseSchema>;

export interface ContextoPergunta {
  enunciado: string;
  instrucao_pt: string | null;
  respostas_esperadas: string[] | null;
  texto_referencia: string | null;
  foco_avaliacao: string[] | null;
}

export class ConfigIAAusenteError extends Error {}

const catalogoTexto = CODIGOS_ERRO.map(
  (c) => `- ${c}: ${CATALOGO_ERROS[c].descricao} Ex.: ${CATALOGO_ERROS[c].exemplo}`
).join("\n");

const SISTEMA = `Você é um avaliador de pronúncia de inglês para crianças brasileiras no nível A1 (CEFR).
Ouça o áudio com atenção e avalie APENAS o que foi realmente dito. Nunca invente palavras que não estão no áudio.

Rubrica (1 a 4) para cada critério:
1 = não compreensível / não respondeu
2 = compreensível com muito esforço, vários erros
3 = compreensível, poucos erros que não atrapalham
4 = claro e natural para o nível A1

- pronúncia: sons das palavras, sílabas tônicas, erros típicos de brasileiros.
- fluência: ritmo, pausas longas, hesitações ("ééé", "hmm").
- vocabulário: palavras adequadas à pergunta.
- estrutura: gramática básica da frase (A1, seja tolerante).

resultado = "good_job" se pronúncia >= 3 E respondeu à pergunta; senão "try_again".

Erros típicos de brasileiros (use o código em codigo_erro quando aplicável, senão null):
${catalogoTexto}

Feedback: em português do Brasil, frases curtas, tom gentil e encorajador, para crianças de 9 a 12 anos.
Nunca entregue a resposta pronta no ponto_melhorar; a frase_modelo é separada.
Se o áudio estiver vazio, em português ou incompreensível, dê notas 1, transcricao com o que der para entender (ou "") e explique com gentileza.`;

export async function analisarPronuncia(
  audioWav: Uint8Array,
  pergunta: ContextoPergunta
): Promise<AnalisePronuncia> {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new ConfigIAAusenteError("GOOGLE_GENERATIVE_AI_API_KEY não configurada");
  }

  const contexto = [
    `Pergunta feita ao aluno (em inglês): "${pergunta.enunciado}"`,
    pergunta.instrucao_pt && `Instrução em português: ${pergunta.instrucao_pt}`,
    pergunta.texto_referencia && `Frase de referência: "${pergunta.texto_referencia}"`,
    pergunta.respostas_esperadas?.length &&
      `Exemplos de respostas aceitáveis: ${pergunta.respostas_esperadas.map((r) => `"${r}"`).join("; ")}`,
    pergunta.foco_avaliacao?.length && `Foco da avaliação: ${pergunta.foco_avaliacao.join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  const { output } = await generateText({
    model: google(process.env.GEMINI_MODEL || "gemini-flash-latest"),
    system: SISTEMA,
    temperature: 0.2,
    output: Output.object({ schema: analiseSchema }),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: `${contexto}\n\nAvalie a resposta gravada pelo aluno:` },
          { type: "file", mediaType: "audio/wav", data: audioWav },
        ],
      },
    ],
  });

  return output;
}

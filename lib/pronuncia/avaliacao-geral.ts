import { GoogleGenAI } from "@google/genai";
import type { NivelIncentivo } from "./analisar";
import {
  obterConfigIaCliente,
  resolverClienteIdPorSessaoOuAluno,
} from "./config-cliente";

export interface ItemResumoQuestao {
  ordem: number;
  enunciado: string;
  transcricao: string;
  nota_pronuncia: number;
  nota_fluencia: number;
  nota_vocabulario: number;
  nota_estrutura: number;
  frase_completa: boolean;
  resultado: NivelIncentivo;
  palavras_atencao: string[];
}

export interface AvaliacaoGeralFinal {
  resultado_geral: NivelIncentivo;
  media_pronuncia: number;
  media_fluencia: number;
  media_vocabulario: number;
  media_estrutura: number;
  media_geral: number;
  total_perguntas: number;
  total_respondidas: number;
  total_frases_completas: number;
  resumo_ia: string;
  pontos_fortes: string[];
  pontos_melhorar: string[];
  palavras_praticar: string[];
  modelo_utilizado: string;
}

function arredondar1Casa(v: number): number {
  return Math.round(v * 10) / 10;
}

export async function gerarAvaliacaoGeralFinalIA(params: {
  alunoId?: string | null;
  turmaId?: string | null;
  tituloAtividade: string;
  nivelAtividade: string;
  totalPerguntas: number;
  itens: ItemResumoQuestao[];
}): Promise<AvaliacaoGeralFinal> {
  const { itens, totalPerguntas } = params;
  const totalRespondidas = itens.length;

  const somaPron = itens.reduce((s, i) => s + (Number(i.nota_pronuncia) || 1), 0);
  const somaFlu = itens.reduce((s, i) => s + (Number(i.nota_fluencia) || 1), 0);
  const somaVoc = itens.reduce((s, i) => s + (Number(i.nota_vocabulario) || 1), 0);
  const somaEst = itens.reduce((s, i) => s + (Number(i.nota_estrutura) || 1), 0);

  const divisor = Math.max(1, totalRespondidas);
  const mediaPronuncia = arredondar1Casa(somaPron / divisor);
  const mediaFluencia = arredondar1Casa(somaFlu / divisor);
  const mediaVocabulario = arredondar1Casa(somaVoc / divisor);
  const mediaEstrutura = arredondar1Casa(somaEst / divisor);
  const mediaGeral = arredondar1Casa(
    (mediaPronuncia + mediaFluencia + mediaVocabulario + mediaEstrutura) / 4
  );

  const totalFrasesCompletas = itens.filter((i) => i.frase_completa).length;
  const taxaFrasesCompletas = totalRespondidas > 0 ? totalFrasesCompletas / totalRespondidas : 0;

  let resultadoGeral: NivelIncentivo;
  if (
    totalRespondidas > 0 &&
    taxaFrasesCompletas >= 0.8 &&
    mediaGeral >= 3.5 &&
    mediaPronuncia >= 3 &&
    mediaEstrutura >= 3
  ) {
    resultadoGeral = "excellent";
  } else if (
    totalRespondidas > 0 &&
    taxaFrasesCompletas >= 0.6 &&
    mediaGeral >= 2.8 &&
    mediaPronuncia >= 2.5
  ) {
    resultadoGeral = "good_job";
  } else if (totalRespondidas > 0 && mediaGeral >= 2.0) {
    resultadoGeral = "doing_ok";
  } else {
    resultadoGeral = "try_again";
  }

  // Coletar palavras únicas com atenção/erro ao longo das questões
  const setPalavras = new Set<string>();
  for (const item of itens) {
    for (const p of item.palavras_atencao || []) {
      const limpa = p.replace(/[.,!?;:"'()\[\]]/g, "").trim();
      if (limpa.length >= 2) {
        setPalavras.add(limpa);
      }
    }
  }
  const palavrasPraticarPadrao = Array.from(setPalavras).slice(0, 8);

  // Resolver configuração de IA do cliente do aluno
  const clienteId = await resolverClienteIdPorSessaoOuAluno({
    alunoId: params.alunoId,
    turmaId: params.turmaId,
  });
  const configCliente = await obterConfigIaCliente(clienteId);
  const apiKey = configCliente.apiKey;
  const modeloBruto = configCliente.modeloConfigurado || "gemini-3.6-flash";
  const modeloTexto =
    modeloBruto === "gemini-3.5-transcribe" ? "gemini-3.5-flash-lite" : modeloBruto;

  // Fallback determinístico caso não haja respostas ou não haja chave configurada
  const construirFallback = (): AvaliacaoGeralFinal => {
    const pontosFortes: string[] = [];
    const pontosMelhorar: string[] = [];

    if (mediaPronuncia >= 3) {
      pontosFortes.push("Sua pronúncia foi clara e compreensível na maioria das respostas.");
    } else {
      pontosFortes.push("Você se esforçou para responder às perguntas falando em inglês!");
    }

    if (totalFrasesCompletas === totalRespondidas && totalRespondidas > 0) {
      pontosFortes.push("Excelente uso de frases completas (sujeito + verbo) em todas as questões!");
    } else if (totalFrasesCompletas > 0) {
      pontosFortes.push(
        `Você construiu frases completas em ${totalFrasesCompletas} de ${totalRespondidas} respostas.`
      );
    }

    if (mediaVocabulario >= 3) {
      pontosFortes.push("Ótimo domínio do vocabulário esperado para o nível da atividade.");
    }

    if (totalFrasesCompletas < totalRespondidas) {
      pontosMelhorar.push(
        "Lembre-se de responder sempre com frases completas (sujeito + verbo), evitando responder com uma única palavra solta."
      );
    }
    if (mediaPronuncia < 3.5 || palavrasPraticarPadrao.length > 0) {
      pontosMelhorar.push(
        "Ouça o áudio modelo do professor nas questões e repita as palavras destacadas para deixar sua pronúncia ainda mais natural."
      );
    }
    if (mediaFluencia < 3) {
      pontosMelhorar.push(
        "Pratique falar a frase inteira em um ritmo contínuo, reduzindo pausas longas entre as palavras."
      );
    }
    if (pontosMelhorar.length === 0) {
      pontosMelhorar.push(
        "Continue praticando em voz alta para expandir seu vocabulário e ganhar cada vez mais fluência!"
      );
    }

    const resumoPadrao =
      resultadoGeral === "excellent"
        ? `Parabéns! Você teve um desempenho excelente na atividade "${params.tituloAtividade}", respondendo com frases completas, ótima pronúncia e segurança.`
        : resultadoGeral === "good_job"
          ? `Muito bom trabalho na atividade "${params.tituloAtividade}"! Você se comunicou bem em inglês e estruturou boas frases na maioria das questões.`
          : resultadoGeral === "doing_ok"
            ? `Bom esforço na atividade "${params.tituloAtividade}"! Você conseguiu se fazer entender em várias respostas, e agora pode avançar ainda mais formando frases completas em todas as perguntas.`
            : `Obrigado por praticar na atividade "${params.tituloAtividade}"! Ouça os exemplos de resposta com atenção e tente novamente falando frases completas no microfone.`;

    return {
      resultado_geral: resultadoGeral,
      media_pronuncia: mediaPronuncia,
      media_fluencia: mediaFluencia,
      media_vocabulario: mediaVocabulario,
      media_estrutura: mediaEstrutura,
      media_geral: mediaGeral,
      total_perguntas: totalPerguntas,
      total_respondidas: totalRespondidas,
      total_frases_completas: totalFrasesCompletas,
      resumo_ia: resumoPadrao,
      pontos_fortes: pontosFortes.slice(0, 3),
      pontos_melhorar: pontosMelhorar.slice(0, 3),
      palavras_praticar: palavrasPraticarPadrao,
      modelo_utilizado: modeloTexto,
    };
  };

  if (!apiKey || totalRespondidas === 0) {
    return construirFallback();
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const relatorioQuestoes = itens
      .map(
        (i) =>
          `Q${i.ordem} ("${i.enunciado}"): Aluno falou "${i.transcricao}" | Notas: Pron=${i.nota_pronuncia}/4, Flu=${i.nota_fluencia}/4, Voc=${i.nota_vocabulario}/4, Est=${i.nota_estrutura}/4 | Frase completa: ${
            i.frase_completa ? "SIM" : "NÃO"
          } | Resultado: ${i.resultado} | Palavras com atenção: ${
            i.palavras_atencao?.join(", ") || "nenhuma"
          }`
      )
      .join("\n");

    const prompt = `Você é um professor especialista em ensino de inglês para alunos brasileiros (nível ${params.nivelAtividade || "A1"}).
O aluno acabou de concluir a avaliação oral "${params.tituloAtividade}".

Abaixo está o desempenho detalhado do aluno em cada questão respondida (${totalRespondidas} de ${totalPerguntas} questões):
${relatorioQuestoes}

Médias calculadas (escala 1 a 4):
- Pronúncia: ${mediaPronuncia}/4
- Fluência: ${mediaFluencia}/4
- Vocabulário: ${mediaVocabulario}/4
- Estrutura (Frases Completas): ${mediaEstrutura}/4
- Frases completas utilizadas: ${totalFrasesCompletas} de ${totalRespondidas}
- Nível de incentivo geral alcançado: ${resultadoGeral}

Gere uma AVALIAÇÃO GERAL FINAL pedagógica, acolhedora e objetiva em português (com exemplos curtos em inglês) para o aluno.
Retorne APENAS um JSON válido com a seguinte estrutura exata:
{
  "resumo_ia": "Parágrafo de 2 a 3 frases comentando de forma personalizada e motivadora o desempenho geral do aluno ao longo da avaliação.",
  "pontos_fortes": [
    "Ponto forte 1 observado nas respostas do aluno",
    "Ponto forte 2 observado nas respostas do aluno"
  ],
  "pontos_melhorar": [
    "Orientação prática 1 para o aluno melhorar (ex.: usar frases completas com sujeito e verbo, ou atenção a determinado som)",
    "Orientação prática 2 para o aluno evoluir"
  ],
  "palavras_praticar": ["palavra1", "palavra2", "palavra3"]
}`;

    const response = await ai.models.generateContent({
      model: modeloTexto,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        temperature: 0.3,
      },
    });

    const texto = response.text?.trim() || "";
    const jsonMatch = texto.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return construirFallback();
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const fallback = construirFallback();

    return {
      resultado_geral: resultadoGeral,
      media_pronuncia: mediaPronuncia,
      media_fluencia: mediaFluencia,
      media_vocabulario: mediaVocabulario,
      media_estrutura: mediaEstrutura,
      media_geral: mediaGeral,
      total_perguntas: totalPerguntas,
      total_respondidas: totalRespondidas,
      total_frases_completas: totalFrasesCompletas,
      resumo_ia:
        typeof parsed.resumo_ia === "string" && parsed.resumo_ia.trim()
          ? parsed.resumo_ia.trim()
          : fallback.resumo_ia,
      pontos_fortes:
        Array.isArray(parsed.pontos_fortes) && parsed.pontos_fortes.length > 0
          ? parsed.pontos_fortes.map((s: any) => String(s).trim()).filter(Boolean).slice(0, 4)
          : fallback.pontos_fortes,
      pontos_melhorar:
        Array.isArray(parsed.pontos_melhorar) && parsed.pontos_melhorar.length > 0
          ? parsed.pontos_melhorar.map((s: any) => String(s).trim()).filter(Boolean).slice(0, 4)
          : fallback.pontos_melhorar,
      palavras_praticar:
        Array.isArray(parsed.palavras_praticar) && parsed.palavras_praticar.length > 0
          ? parsed.palavras_praticar.map((s: any) => String(s).trim()).filter(Boolean).slice(0, 8)
          : fallback.palavras_praticar,
      modelo_utilizado: modeloTexto,
    };
  } catch (err) {
    console.warn("[avaliacao-geral] Usando síntese determinística após falha na chamada IA:", err);
    return construirFallback();
  }
}

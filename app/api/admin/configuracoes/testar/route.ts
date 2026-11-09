import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  criarClienteGemini,
  gerarWavSilencioTeste,
  MODELO_TRANSCRICAO_PADRAO,
  transcreverAudioGemini,
} from "@/lib/pronuncia/transcrever";
import { obterConfigIaCliente } from "@/lib/pronuncia/config-cliente";

const testSchema = z.object({
  cliente_id: z.string().trim().optional().nullable(),
  modelo: z.string().trim().min(3, "Nome do modelo inválido"),
  api_key: z.string().optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = testSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const { cliente_id, modelo, api_key } = result.data;
    const cfgCliente = await obterConfigIaCliente(cliente_id || null);
    const chaveTeste =
      api_key?.replace(/^["']|["']$/g, "").trim() || cfgCliente.apiKey;

    if (!chaveTeste) {
      return NextResponse.json(
        {
          sucesso: false,
          erro: "Nenhuma chave de API (GOOGLE_GENERATIVE_AI_API_KEY) configurada para este cliente.",
        },
        { status: 400 }
      );
    }

    const cleanModel = modelo.replace(/^models\//, "").trim();
    const inicio = Date.now();
    const ai = criarClienteGemini(chaveTeste);

    if (cleanModel === MODELO_TRANSCRICAO_PADRAO || cleanModel.startsWith("gemini-3.5-transcribe")) {
      const wavTeste = gerarWavSilencioTeste(400);
      await transcreverAudioGemini({
        audioBytes: wavTeste,
        mimeType: "audio/wav",
        nomeArquivo: "teste-admin.wav",
        modo: "verbatim",
        timeoutMs: 10000,
        aiClient: ai,
      });

      const tempoMs = Date.now() - inicio;
      return NextResponse.json({
        sucesso: true,
        modelo: MODELO_TRANSCRICAO_PADRAO,
        resposta: "OK (Files API + Speech-to-Text)",
        tempo_ms: tempoMs,
        mensagem: `Teste bem-sucedido! Upload e transcrição via ${MODELO_TRANSCRICAO_PADRAO} concluídos em ${tempoMs}ms com a chave do cliente.`,
      });
    }

    const interaction = await ai.interactions.create(
      {
        model: cleanModel,
        store: false,
        input: "Reply with the exact word 'OK'.",
        generation_config: {
          temperature: 0.0,
          thinking_level: "minimal",
        },
      },
      {
        timeout_ms: 8000,
        retries: { strategy: "none" },
        retry_codes: [],
      }
    );

    const tempoMs = Date.now() - inicio;

    return NextResponse.json({
      sucesso: true,
      modelo: cleanModel,
      resposta: (interaction.output_text ?? "OK").trim(),
      tempo_ms: tempoMs,
      mensagem: `Teste bem-sucedido! O modelo respondeu em ${tempoMs}ms com a chave do cliente.`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[configuracoes/testar] Falha no teste do modelo:", msg);

    let erroAmigavel = msg;
    if (msg.includes("API_KEY_INVALID") || msg.includes("API key not valid")) {
      erroAmigavel = `A chave de API informada para este cliente é inválida. Verifique se copiou a chave completa do Google AI Studio.`;
    } else if (msg.includes("not found") || msg.includes("not supported")) {
      erroAmigavel = `O modelo solicitado não foi encontrado ou não é suportado pela chave de API deste cliente.`;
    } else if (msg.includes("no longer available")) {
      erroAmigavel = `Este modelo não está mais disponível para novas contas Google.`;
    } else if (msg.includes("high demand") || msg.includes("429") || msg.includes("503")) {
      erroAmigavel = `A chave deste cliente atingiu o limite de requisições (429) ou o modelo está com alta demanda momentânea.`;
    } else if (msg.includes("timeout") || msg.includes("AbortError")) {
      erroAmigavel = `Tempo limite esgotado (mais de 8s para responder).`;
    }

    return NextResponse.json(
      {
        sucesso: false,
        erro: erroAmigavel,
        detalhe: msg,
      },
      { status: 400 }
    );
  }
}

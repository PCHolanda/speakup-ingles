import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";

const testSchema = z.object({
  modelo: z.string().trim().min(3, "Nome do modelo inválido"),
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

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return NextResponse.json(
        { error: "GOOGLE_GENERATIVE_AI_API_KEY não está configurada no servidor." },
        { status: 400 }
      );
    }

    const cleanModel = result.data.modelo.replace(/^models\//, "").trim();
    const inicio = Date.now();

    const genModel = google(cleanModel);
    const res = await generateText({
      model: genModel,
      prompt: "Reply with the exact word 'OK'.",
      temperature: 0.0,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(8000),
    });

    const tempoMs = Date.now() - inicio;

    return NextResponse.json({
      sucesso: true,
      modelo: cleanModel,
      resposta: res.text.trim(),
      tempo_ms: tempoMs,
      mensagem: `Teste bem-sucedido! O modelo respondeu em ${tempoMs}ms.`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[configuracoes/testar] Falha no teste do modelo:", msg);

    let erroAmigavel = msg;
    if (msg.includes("not found") || msg.includes("not supported")) {
      erroAmigavel = `O modelo solicitado não foi encontrado ou não é suportado pela sua chave de API.`;
    } else if (msg.includes("no longer available")) {
      erroAmigavel = `Este modelo não está mais disponível para novas contas Google.`;
    } else if (msg.includes("high demand") || msg.includes("429") || msg.includes("503")) {
      erroAmigavel = `O modelo está com alta demanda momentânea no Google.`;
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

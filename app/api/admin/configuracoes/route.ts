import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { atualizarModeloAtivoCache, MODELOS_RECOMENDADOS } from "@/lib/pronuncia/analisar";

const configSchema = z.object({
  modelo: z.string().trim().min(3, "Nome do modelo inválido"),
});

export async function GET() {
  try {
    const admin = createAdminClient();
    let modeloAtual = process.env.GEMINI_MODEL?.trim().replace(/^models\//, "") || "gemini-3.8-flash";
    let tabelaExiste = true;

    try {
      const { data, error } = await admin
        .from("configuracoes")
        .select("valor, updated_at")
        .eq("chave", "gemini_model")
        .maybeSingle();

      if (!error && data?.valor) {
        modeloAtual = data.valor.trim();
      } else if (error) {
        console.warn("[configuracoes] Tabela configuracoes ainda não existe ou inacessível:", error.message);
        tabelaExiste = false;
      }
    } catch {
      tabelaExiste = false;
    }

    return NextResponse.json({
      modelo_atual: modeloAtual,
      modelos_recomendados: MODELOS_RECOMENDADOS,
      tem_api_key: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      tabela_existe: tabelaExiste,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Erro ao obter configurações: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = configSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const cleanModel = result.data.modelo.replace(/^models\//, "").trim();
    const admin = createAdminClient();

    // Tentar salvar na tabela configuracoes
    const { error } = await admin.from("configuracoes").upsert({
      chave: "gemini_model",
      valor: cleanModel,
      descricao: "Modelo do Google Gemini configurado pelo painel Admin",
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[configuracoes] Erro ao salvar no banco:", error);
      // Se a tabela não existir, avisamos o admin
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        return NextResponse.json(
          {
            error:
              "A tabela 'configuracoes' ainda não existe no seu Supabase. Execute o script '004_configuracoes.sql' no SQL Editor do Supabase.",
          },
          { status: 400 }
        );
      }
      throw error;
    }

    // Atualiza cache em memória para efeito imediato
    atualizarModeloAtivoCache(cleanModel);

    return NextResponse.json({
      sucesso: true,
      modelo: cleanModel,
      mensagem: `Modelo configurado com sucesso para "${cleanModel}"!`,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Erro ao salvar modelo: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { atualizarModeloAtivoCache, MODELOS_RECOMENDADOS } from "@/lib/pronuncia/analisar";
import { MODELO_TRANSCRICAO_PADRAO } from "@/lib/pronuncia/transcrever";
import {
  mascararApiKey,
  MODELO_PADRAO_CLIENTE,
  obterConfigIaCliente,
  obterMapaConfigTodosClientes,
  salvarConfigIaCliente,
} from "@/lib/pronuncia/config-cliente";

const configSchema = z.object({
  cliente_id: z.string().trim().optional().nullable(),
  modelo: z.string().trim().min(3, "Nome do modelo inválido").optional(),
  api_key: z.string().optional().nullable(),
  limpar_api_key: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const clienteIdParam = request.nextUrl.searchParams.get("cliente_id")?.trim() || null;
    const { modeloGlobal, apiKeyGlobal, porCliente } = await obterMapaConfigTodosClientes();
    const cfgSelecionado = await obterConfigIaCliente(clienteIdParam);

    const configsClientes: Record<
      string,
      {
        modelo: string;
        tem_chave_propria: boolean;
        tem_api_key: boolean;
        api_key_mascarada: string | null;
      }
    > = {};

    porCliente.forEach((val, cid) => {
      configsClientes[cid] = {
        modelo: val.modelo || modeloGlobal || MODELO_PADRAO_CLIENTE,
        tem_chave_propria: Boolean(val.apiKeyPropria),
        tem_api_key: Boolean(val.apiKeyPropria || apiKeyGlobal),
        api_key_mascarada: mascararApiKey(val.apiKeyPropria),
      };
    });

    return NextResponse.json({
      cliente_id: cfgSelecionado.clienteId,
      modelo_atual: cfgSelecionado.modeloConfigurado,
      modelo_transcricao: MODELO_TRANSCRICAO_PADRAO,
      modelos_recomendados: MODELOS_RECOMENDADOS,
      tem_api_key: cfgSelecionado.temApiKeyEfetiva,
      tem_chave_propria: cfgSelecionado.temChavePropria,
      api_key_mascarada: cfgSelecionado.apiKeyMascarada,
      tem_api_key_global: Boolean(apiKeyGlobal),
      configs_por_cliente: configsClientes,
      tabela_existe: true,
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

    const { cliente_id, modelo, api_key, limpar_api_key } = result.data;
    const cleanModel = modelo ? modelo.replace(/^models\//, "").trim() : undefined;
    const cleanKey = api_key?.replace(/^["']|["']$/g, "").trim() || null;

    const cfgSalva = await salvarConfigIaCliente({
      clienteId: cliente_id || null,
      modelo: cleanModel,
      apiKey: cleanKey,
      limparApiKey: Boolean(limpar_api_key),
    });

    if (!cliente_id && cleanModel) {
      atualizarModeloAtivoCache(cleanModel);
    }

    return NextResponse.json({
      sucesso: true,
      cliente_id: cfgSalva.clienteId,
      modelo: cfgSalva.modeloConfigurado,
      tem_chave_propria: cfgSalva.temChavePropria,
      tem_api_key: cfgSalva.temApiKeyEfetiva,
      api_key_mascarada: cfgSalva.apiKeyMascarada,
      mensagem: cliente_id
        ? `Configuração de IA do cliente salva com sucesso (modelo: "${cfgSalva.modeloConfigurado}")!`
        : `Modelo padrão configurado com sucesso para "${cfgSalva.modeloConfigurado}"!`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("does not exist") || msg.includes("42P01")) {
      return NextResponse.json(
        {
          error:
            "A tabela 'configuracoes' ainda não existe no seu Supabase. Execute o script '004_configuracoes.sql' no SQL Editor do Supabase.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Erro ao salvar configuração: " + msg },
      { status: 500 }
    );
  }
}

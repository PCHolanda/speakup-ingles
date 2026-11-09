import { createAdminClient } from "@/lib/supabase/admin";
import { obterChaveGemini } from "@/lib/pronuncia/transcrever";

export const MODELO_PADRAO_CLIENTE = "gemini-3.6-flash";

export interface ConfigIaCliente {
  clienteId: string | null;
  apiKey: string | undefined;
  apiKeyPropria: string | undefined;
  apiKeyMascarada: string | null;
  temChavePropria: boolean;
  temApiKeyEfetiva: boolean;
  modeloConfigurado: string;
}

interface CacheEntry {
  apiKeyPropria?: string;
  modelo?: string;
  updatedAt: number;
}

const cachePorCliente = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000;

export function mascararApiKey(key?: string | null): string | null {
  if (!key) return null;
  const limpa = key.replace(/^["']|["']$/g, "").trim();
  if (!limpa) return null;
  if (limpa.length <= 10) {
    return `${limpa.slice(0, 3)}••••${limpa.slice(-2)}`;
  }
  return `${limpa.slice(0, 6)}••••••${limpa.slice(-4)}`;
}

export function chaveConfigModeloCliente(clienteId: string): string {
  return `cliente:${clienteId}:gemini_model`;
}

export function chaveConfigApiKeyCliente(clienteId: string): string {
  return `cliente:${clienteId}:gemini_api_key`;
}

export function invalidarCacheConfigCliente(clienteId?: string | null) {
  if (clienteId) {
    cachePorCliente.delete(clienteId);
  } else {
    cachePorCliente.clear();
  }
}

/**
 * Busca em lote as configurações de todos os clientes na tabela `configuracoes`.
 */
export async function obterMapaConfigTodosClientes(): Promise<{
  modeloGlobal: string;
  apiKeyGlobal: string | undefined;
  porCliente: Map<string, { apiKeyPropria?: string; modelo?: string }>;
}> {
  const admin = createAdminClient();
  const porCliente = new Map<string, { apiKeyPropria?: string; modelo?: string }>();
  let modeloGlobal =
    process.env.GEMINI_MODEL?.trim().replace(/^models\//, "") || MODELO_PADRAO_CLIENTE;
  let apiKeyGlobal = obterChaveGemini();

  try {
    const { data, error } = await admin
      .from("configuracoes")
      .select("chave, valor");

    if (!error && data) {
      for (const item of data) {
        const chave = item.chave?.trim() || "";
        const valor = item.valor?.trim() || "";
        if (!chave) continue;

        if (chave === "gemini_model" && valor) {
          modeloGlobal = valor.replace(/^models\//, "");
          continue;
        }
        if (chave === "gemini_api_key" && valor) {
          apiKeyGlobal = valor.replace(/^["']|["']$/g, "").trim() || apiKeyGlobal;
          continue;
        }

        const matchModelo = chave.match(/^cliente:([^:]+):gemini_model$/);
        if (matchModelo && valor) {
          const cid = matchModelo[1];
          const atual = porCliente.get(cid) || {};
          atual.modelo = valor.replace(/^models\//, "");
          porCliente.set(cid, atual);
          continue;
        }

        const matchKey = chave.match(/^cliente:([^:]+):gemini_api_key$/);
        if (matchKey) {
          const cid = matchKey[1];
          const atual = porCliente.get(cid) || {};
          const limpa = valor.replace(/^["']|["']$/g, "").trim();
          if (limpa) {
            atual.apiKeyPropria = limpa;
          }
          porCliente.set(cid, atual);
        }
      }
    }
  } catch (err) {
    console.warn("[config-cliente] Aviso ao ler configuracoes em lote:", err);
  }

  return { modeloGlobal, apiKeyGlobal, porCliente };
}

/**
 * Obtém a chave de API e o modelo configurados especificamente para um Cliente
 * (com fallback seguro para a configuração global/ambiente caso o cliente ainda não tenha chave própria).
 */
export async function obterConfigIaCliente(
  clienteId?: string | null
): Promise<ConfigIaCliente> {
  const cid = clienteId?.trim() || null;
  const agora = Date.now();

  if (cid) {
    const cached = cachePorCliente.get(cid);
    if (cached && agora - cached.updatedAt < CACHE_TTL_MS) {
      const apiKeyGlobal = obterChaveGemini();
      const apiKeyEfetiva = cached.apiKeyPropria || apiKeyGlobal;
      const modeloEfetivo = cached.modelo || MODELO_PADRAO_CLIENTE;
      return {
        clienteId: cid,
        apiKey: apiKeyEfetiva,
        apiKeyPropria: cached.apiKeyPropria,
        apiKeyMascarada: mascararApiKey(cached.apiKeyPropria),
        temChavePropria: Boolean(cached.apiKeyPropria),
        temApiKeyEfetiva: Boolean(apiKeyEfetiva),
        modeloConfigurado: modeloEfetivo,
      };
    }
  }

  const { modeloGlobal, apiKeyGlobal, porCliente } = await obterMapaConfigTodosClientes();

  if (!cid) {
    return {
      clienteId: null,
      apiKey: apiKeyGlobal,
      apiKeyPropria: undefined,
      apiKeyMascarada: mascararApiKey(apiKeyGlobal),
      temChavePropria: Boolean(apiKeyGlobal),
      temApiKeyEfetiva: Boolean(apiKeyGlobal),
      modeloConfigurado: modeloGlobal,
    };
  }

  const cfg = porCliente.get(cid);
  const apiKeyPropria = cfg?.apiKeyPropria;
  const modeloConfigurado = cfg?.modelo || modeloGlobal || MODELO_PADRAO_CLIENTE;
  const apiKeyEfetiva = apiKeyPropria || apiKeyGlobal;

  cachePorCliente.set(cid, {
    apiKeyPropria,
    modelo: modeloConfigurado,
    updatedAt: agora,
  });

  return {
    clienteId: cid,
    apiKey: apiKeyEfetiva,
    apiKeyPropria,
    apiKeyMascarada: mascararApiKey(apiKeyPropria),
    temChavePropria: Boolean(apiKeyPropria),
    temApiKeyEfetiva: Boolean(apiKeyEfetiva),
    modeloConfigurado,
  };
}

/**
 * Salva o modelo e/ou chave de API Gemini de um Cliente na tabela `configuracoes`
 * (e tenta sincronizar opcionalmente nas colunas de `clientes` se existirem).
 */
export async function salvarConfigIaCliente(params: {
  clienteId?: string | null;
  modelo?: string | null;
  apiKey?: string | null;
  limparApiKey?: boolean;
}): Promise<ConfigIaCliente> {
  const admin = createAdminClient();
  const cid = params.clienteId?.trim() || null;
  const agoraIso = new Date().toISOString();

  const upserts: Array<{
    chave: string;
    valor: string;
    descricao: string;
    updated_at: string;
  }> = [];

  const modeloLimpo = params.modelo?.trim().replace(/^models\//, "");
  const apiKeyLimpa = params.apiKey?.replace(/^["']|["']$/g, "").trim();

  if (cid) {
    if (modeloLimpo) {
      upserts.push({
        chave: chaveConfigModeloCliente(cid),
        valor: modeloLimpo,
        descricao: `Modelo Gemini configurado para o cliente ${cid}`,
        updated_at: agoraIso,
      });
    }

    if (params.limparApiKey) {
      await admin.from("configuracoes").delete().eq("chave", chaveConfigApiKeyCliente(cid));
    } else if (apiKeyLimpa) {
      upserts.push({
        chave: chaveConfigApiKeyCliente(cid),
        valor: apiKeyLimpa,
        descricao: `Chave de API Gemini exclusiva do cliente ${cid}`,
        updated_at: agoraIso,
      });
    }
  } else {
    if (modeloLimpo) {
      upserts.push({
        chave: "gemini_model",
        valor: modeloLimpo,
        descricao: "Modelo Gemini padrão global",
        updated_at: agoraIso,
      });
    }
    if (params.limparApiKey) {
      await admin.from("configuracoes").delete().eq("chave", "gemini_api_key");
    } else if (apiKeyLimpa) {
      upserts.push({
        chave: "gemini_api_key",
        valor: apiKeyLimpa,
        descricao: "Chave de API Gemini padrão global",
        updated_at: agoraIso,
      });
    }
  }

  if (upserts.length > 0) {
    const { error } = await admin.from("configuracoes").upsert(upserts);
    if (error) {
      throw error;
    }
  }

  // Tenta sincronizar nas colunas opcionais da tabela `clientes` (caso a migration 006 tenha sido executada)
  if (cid) {
    try {
      const updateCampos: Record<string, string | null> = {};
      if (modeloLimpo) updateCampos.gemini_model = modeloLimpo;
      if (params.limparApiKey) updateCampos.gemini_api_key = null;
      else if (apiKeyLimpa) updateCampos.gemini_api_key = apiKeyLimpa;

      if (Object.keys(updateCampos).length > 0) {
        await admin.from("clientes").update(updateCampos).eq("id", cid);
      }
    } catch {
      // Ignora silenciosamente se as colunas opcionais ainda não existirem na tabela clientes
    }
  }

  invalidarCacheConfigCliente(cid);
  return obterConfigIaCliente(cid);
}

/**
 * Resolve a qual `cliente_id` pertence uma sessão ou aluno (Turma -> Escola -> Cliente).
 */
export async function resolverClienteIdPorSessaoOuAluno(opcoes: {
  turmaId?: string | null;
  alunoId?: string | null;
}): Promise<string | null> {
  const admin = createAdminClient();
  let turmaId = opcoes.turmaId || null;

  try {
    if (!turmaId && opcoes.alunoId) {
      const { data: vinculo } = await admin
        .from("turma_alunos")
        .select("turma_id")
        .eq("aluno_id", opcoes.alunoId)
        .limit(1)
        .maybeSingle();
      turmaId = vinculo?.turma_id || null;
    }

    if (turmaId) {
      const { data: turma } = await admin
        .from("turmas")
        .select("escola_id")
        .eq("id", turmaId)
        .maybeSingle();

      if (turma?.escola_id) {
        const { data: escola } = await admin
          .from("escolas")
          .select("cliente_id")
          .eq("id", turma.escola_id)
          .maybeSingle();

        if (escola?.cliente_id) {
          return escola.cliente_id;
        }
      }
    }

    // Fallback caso a turma legada ainda não tenha escola_id preenchido: usa o primeiro cliente ativo
    const { data: primeiroCliente } = await admin
      .from("clientes")
      .select("id")
      .eq("ativo", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    return primeiroCliente?.id || null;
  } catch (err) {
    console.warn("[config-cliente] Aviso ao resolver cliente_id da sessão:", err);
    return null;
  }
}


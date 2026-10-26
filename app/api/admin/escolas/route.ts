import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const escolaSchema = z.object({
  cliente_id: z.string().uuid("Selecione um cliente válido"),
  nome: z.string().min(2, "O nome da escola deve ter pelo menos 2 caracteres"),
  codigo_inep: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  estado: z.string().max(2).optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const admin = createAdminClient();
    const { searchParams } = new URL(request.url);
    const clienteId = searchParams.get("cliente_id");

    let query = admin
      .from("escolas")
      .select(`
        id,
        nome,
        codigo_inep,
        cidade,
        estado,
        ativo,
        created_at,
        cliente_id,
        cliente:clientes(id, nome)
      `)
      .order("nome", { ascending: true });

    if (clienteId) {
      query = query.eq("cliente_id", clienteId);
    }

    const { data: escolas, error } = await query;

    if (error) {
      if (error.message?.includes("does not exist") || error.code === "42P01") {
        return NextResponse.json({ escolas: [], tabela_existe: false });
      }
      throw error;
    }

    const formatadas = (escolas || []).map((e) => {
      const c = Array.isArray(e.cliente) ? e.cliente[0] : e.cliente;
      return {
        id: e.id,
        nome: e.nome,
        codigo_inep: e.codigo_inep,
        cidade: e.cidade,
        estado: e.estado,
        ativo: e.ativo,
        created_at: e.created_at,
        cliente_id: e.cliente_id,
        cliente_nome: c?.nome || "Cliente não informado",
      };
    });

    return NextResponse.json({ escolas: formatadas, tabela_existe: true });
  } catch (error: unknown) {
    console.error("Erro ao listar escolas:", error);
    return NextResponse.json(
      { error: "Erro ao buscar escolas cadastradas." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = escolaSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "Dados de escola inválidos." },
        { status: 400 }
      );
    }

    const { cliente_id, nome, codigo_inep, cidade, estado } = result.data;
    const admin = createAdminClient();

    // 1. Verificar se o cliente existe
    const { data: cliente, error: cliError } = await admin
      .from("clientes")
      .select("id, nome")
      .eq("id", cliente_id)
      .single();

    if (cliError || !cliente) {
      return NextResponse.json(
        { error: "Cliente associado não encontrado." },
        { status: 404 }
      );
    }

    // 2. Inserir a escola
    const { data: novaEscola, error: insertError } = await admin
      .from("escolas")
      .insert({
        cliente_id,
        nome: nome.trim(),
        codigo_inep: codigo_inep?.trim() || null,
        cidade: cidade?.trim() || null,
        estado: estado?.trim().toUpperCase() || null,
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.message?.includes("does not exist") || insertError.code === "42P01") {
        return NextResponse.json(
          {
            error:
              "A tabela de 'escolas' ainda não foi criada no banco Supabase. Execute a migration 005_clientes_escolas.sql no SQL Editor.",
            precisa_migration: true,
          },
          { status: 400 }
        );
      }
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      escola: {
        ...novaEscola,
        cliente_nome: cliente.nome,
      },
    });
  } catch (error: unknown) {
    console.error("Erro ao cadastrar escola:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor ao cadastrar escola." },
      { status: 500 }
    );
  }
}

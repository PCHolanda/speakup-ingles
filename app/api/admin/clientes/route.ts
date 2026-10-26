import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const clienteSchema = z.object({
  nome: z.string().min(2, "O nome do cliente deve ter pelo menos 2 caracteres"),
  documento: z.string().optional().nullable(),
  email_contato: z.string().email("E-mail de contato inválido").optional().or(z.literal("")),
  telefone_contato: z.string().optional().nullable(),
});

export async function GET() {
  try {
    const admin = createAdminClient();
    const { data: clientes, error } = await admin
      .from("clientes")
      .select(`
        id,
        nome,
        documento,
        email_contato,
        telefone_contato,
        ativo,
        created_at
      `)
      .order("nome", { ascending: true });

    if (error) {
      // Se a tabela ainda não existir no Supabase, retorna lista vazia amigável
      if (error.message?.includes("does not exist") || error.code === "42P01") {
        return NextResponse.json({ clientes: [], tabela_existe: false });
      }
      throw error;
    }

    return NextResponse.json({ clientes: clientes || [], tabela_existe: true });
  } catch (error: unknown) {
    console.error("Erro ao listar clientes:", error);
    return NextResponse.json(
      { error: "Erro ao buscar clientes cadastrados." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = clienteSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "Dados de cliente inválidos." },
        { status: 400 }
      );
    }

    const { nome, documento, email_contato, telefone_contato } = result.data;
    const admin = createAdminClient();

    const { data: novoCliente, error } = await admin
      .from("clientes")
      .insert({
        nome: nome.trim(),
        documento: documento?.trim() || null,
        email_contato: email_contato?.trim() || null,
        telefone_contato: telefone_contato?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      if (error.message?.includes("does not exist") || error.code === "42P01") {
        return NextResponse.json(
          {
            error:
              "A tabela de 'clientes' ainda não foi criada no banco Supabase. Execute a migration 005_clientes_escolas.sql no SQL Editor.",
            precisa_migration: true,
          },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      cliente: novoCliente,
    });
  } catch (error: unknown) {
    console.error("Erro ao cadastrar cliente:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor ao cadastrar cliente." },
      { status: 500 }
    );
  }
}

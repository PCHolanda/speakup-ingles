import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const turmaSchema = z.object({
  nome: z.string().min(2, "Nome da turma deve ter pelo menos 2 caracteres"),
  codigo: z
    .string()
    .length(6, "O código da turma deve ter exatamente 6 caracteres")
    .regex(/^[A-Za-z0-9]{6}$/, "O código deve conter apenas letras e números"),
  professor_id: z.string().uuid("Selecione um professor válido"),
  escola_id: z.string().uuid("Selecione uma escola válida").optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = turmaSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const { nome, codigo, professor_id, escola_id } = result.data;
    const admin = createAdminClient();
    const cleanCodigo = codigo.trim().toUpperCase();

    // 1. Verificar se o código já existe
    const { data: existente } = await admin
      .from("turmas")
      .select("id")
      .eq("codigo", cleanCodigo)
      .maybeSingle();

    if (existente) {
      return NextResponse.json(
        { error: `O código de turma "${cleanCodigo}" já está em uso. Escolha outro código.` },
        { status: 409 }
      );
    }

    // 2. Inserir a turma (tolerante caso a coluna escola_id ainda não exista no banco)
    const payload: Record<string, unknown> = {
      nome: nome.trim(),
      codigo: cleanCodigo,
      professor_id,
    };
    if (escola_id) {
      payload.escola_id = escola_id;
    }

    let { data: novaTurma, error: insertError } = await admin
      .from("turmas")
      .insert(payload)
      .select()
      .single();

    if (insertError && escola_id && insertError.message?.includes("escola_id")) {
      delete payload.escola_id;
      const retry = await admin.from("turmas").insert(payload).select().single();
      novaTurma = retry.data;
      insertError = retry.error;
    }

    if (insertError) {
      return NextResponse.json(
        { error: "Erro ao registrar a turma no banco de dados." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      turma: novaTurma,
    });
  } catch (error: unknown) {
    console.error("Erro ao cadastrar turma:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor ao cadastrar turma." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const alunoSchema = z.object({
  nome: z.string().min(2, "Nome do aluno deve ter pelo menos 2 caracteres"),
  turma_id: z.string().uuid("Selecione uma turma válida"),
  pin: z.string().regex(/^\d{6}$/, "O PIN deve conter exatamente 6 números"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = alunoSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const { nome, turma_id, pin } = result.data;
    const admin = createAdminClient();

    // 1. Verificar se a turma existe
    const { data: turma, error: turmaError } = await admin
      .from("turmas")
      .select("id, nome, codigo")
      .eq("id", turma_id)
      .single();

    if (turmaError || !turma) {
      return NextResponse.json(
        { error: "Turma não encontrada." },
        { status: 404 }
      );
    }

    // 2. Criar usuário temporário para gerar UUID no Supabase Auth
    const tempEmail = `aluno-temp-${Date.now()}@speakup.local`;
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: tempEmail,
      password: pin,
      email_confirm: true,
      user_metadata: { nome: nome.trim() },
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || "Não foi possível criar o login do aluno." },
        { status: 500 }
      );
    }

    const alunoId = authData.user.id;
    const syntheticEmail = `aluno-${alunoId}@speakup.local`;

    // 3. Atualizar para o e-mail sintético padronizado
    await admin.auth.admin.updateUserById(alunoId, { email: syntheticEmail });

    // 4. Inserir perfil de estudante
    const { error: profileError } = await admin.from("profiles").upsert({
      id: alunoId,
      papel: "student",
      nome: nome.trim(),
    });

    if (profileError) {
      await admin.auth.admin.deleteUser(alunoId);
      return NextResponse.json(
        { error: "Erro ao criar perfil do aluno." },
        { status: 500 }
      );
    }

    // 5. Vincular aluno à turma
    const { error: vinculoError } = await admin.from("turma_alunos").insert({
      turma_id: turma.id,
      aluno_id: alunoId,
    });

    if (vinculoError) {
      return NextResponse.json(
        { error: "Erro ao matricular aluno na turma." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      aluno: {
        id: alunoId,
        nome: nome.trim(),
        pin,
        turma_nome: turma.nome,
        turma_codigo: turma.codigo,
      },
    });
  } catch (error: unknown) {
    console.error("Erro ao cadastrar aluno:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor ao cadastrar aluno." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const professorSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  papel: z.enum(["teacher", "admin"]).default("teacher"),
  escola_id: z.string().uuid().optional().nullable(),
  escola_ids: z.array(z.string().uuid()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = professorSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const { nome, email, senha, papel, escola_id, escola_ids } = result.data;
    const admin = createAdminClient();

    // 1. Criar usuário no Supabase Auth
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: senha,
      email_confirm: true,
      user_metadata: { nome: nome.trim(), papel: papel || "teacher" },
      app_metadata: { papel: papel || "teacher" },
    });

    if (authError || !authData.user) {
      if (
        authError?.message?.includes("already registered") ||
        authError?.message?.includes("already exists")
      ) {
        return NextResponse.json(
          { error: "Este e-mail já está cadastrado no sistema." },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: authError?.message || "Não foi possível criar o usuário no sistema de autenticação." },
        { status: 500 }
      );
    }

    const userId = authData.user.id;

    // 2. Inserir ou atualizar na tabela profiles com o papel 'teacher' do enum
    const { error: profileError } = await admin.from("profiles").upsert({
      id: userId,
      papel: "teacher",
      nome: nome.trim(),
    });

    if (profileError) {
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: "Erro ao salvar o perfil do professor no banco de dados." },
        { status: 500 }
      );
    }

    // 3. Vincular às escolas selecionadas (se fornecidas)
    const targets = new Set<string>();
    if (escola_id) targets.add(escola_id);
    if (escola_ids) escola_ids.forEach((id) => targets.add(id));

    if (targets.size > 0) {
      try {
        const registros = Array.from(targets).map((eid) => ({
          escola_id: eid,
          professor_id: userId,
        }));
        await admin.from("escola_professores").insert(registros);
      } catch (e) {
        console.warn("Aviso ao vincular professor às escolas:", e);
      }
    }

    return NextResponse.json({
      success: true,
      professor: {
        id: userId,
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        papel,
      },
    });
  } catch (error: unknown) {
    console.error("Erro ao cadastrar professor:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor ao cadastrar professor." },
      { status: 500 }
    );
  }
}

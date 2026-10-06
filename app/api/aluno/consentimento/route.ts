import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const consentSchema = z.object({
  responsavel_nome: z.string().min(3, "O nome do responsável deve ter pelo menos 3 caracteres"),
});

// GET: Verifica se o aluno logado já possui consentimento
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Buscar perfil do aluno
    const { data: profile } = await admin
      .from("profiles")
      .select("id, nome, papel")
      .eq("id", user.id)
      .single();

    // Buscar consentimento
    const { data: consentimento } = await admin
      .from("consentimentos")
      .select("responsavel_nome, aceito_em, versao_termo")
      .eq("aluno_id", user.id)
      .maybeSingle();

    return NextResponse.json({
      aluno: profile || { id: user.id, nome: user.user_metadata?.nome || "Aluno" },
      consentimento: consentimento || null,
      temConsentimento: !!consentimento,
    });
  } catch (error: unknown) {
    console.error("Erro ao verificar consentimento:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor ao verificar termo de consentimento." },
      { status: 500 }
    );
  }
}

// POST: Registra o consentimento do responsável
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Sessão expirada. Faça login novamente." }, { status: 401 });
    }

    const body = await request.json();
    const result = consentSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const { responsavel_nome } = result.data;
    const admin = createAdminClient();

    // Inserir ou atualizar consentimento na tabela consentimentos
    const { error: consentError } = await admin
      .from("consentimentos")
      .upsert({
        aluno_id: user.id,
        responsavel_nome: responsavel_nome.trim(),
        versao_termo: "v1.0",
        aceito_em: new Date().toISOString(),
      });

    if (consentError) {
      console.error("Erro ao salvar consentimento no banco:", consentError);
      return NextResponse.json(
        { error: "Não foi possível registrar o termo de consentimento no momento." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      redirectUrl: "/aluno/atividades",
    });
  } catch (error: unknown) {
    console.error("Erro no registro do consentimento:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor." },
      { status: 500 }
    );
  }
}

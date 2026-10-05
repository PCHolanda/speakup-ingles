import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const loginSchema = z.object({
  turma_codigo: z.string().length(6, "O código da turma deve ter 6 caracteres"),
  aluno_id: z.string().uuid("Identificador do aluno inválido"),
  pin: z.string().regex(/^\d{6}$/, "O PIN deve conter exatamente 6 dígitos"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "Dados de login inválidos." },
        { status: 400 }
      );
    }

    const { turma_codigo, aluno_id, pin } = result.data;
    const admin = createAdminClient();

    // 1. Rate Limiting Check
    const { data: tentativa } = await admin
      .from("login_tentativas")
      .select("*")
      .eq("aluno_id", aluno_id)
      .single();

    const agora = new Date();

    if (tentativa) {
      if (tentativa.bloqueado_ate && new Date(tentativa.bloqueado_ate) > agora) {
        const minutosRestantes = Math.ceil(
          (new Date(tentativa.bloqueado_ate).getTime() - agora.getTime()) / (1000 * 60)
        );
        return NextResponse.json(
          {
            error: `Conta temporariamente bloqueada por excesso de tentativas. Tente novamente em ${minutosRestantes} minuto(s).`,
          },
          { status: 429 }
        );
      }

      // Se a primeira tentativa foi há mais de 15 minutos, reinicia contagem
      const diffMinutos = (agora.getTime() - new Date(tentativa.primeira_tentativa).getTime()) / (1000 * 60);
      if (diffMinutos > 15) {
        await admin.from("login_tentativas").delete().eq("aluno_id", aluno_id);
      }
    }

    // 2. Validar se o aluno pertence à turma informada
    const { data: turma } = await admin
      .from("turmas")
      .select("id")
      .ilike("codigo", turma_codigo.trim())
      .single();

    if (!turma) {
      return NextResponse.json(
        { error: "Código da turma não encontrado." },
        { status: 404 }
      );
    }

    const { data: matricula } = await admin
      .from("turma_alunos")
      .select("aluno_id")
      .eq("turma_id", turma.id)
      .eq("aluno_id", aluno_id)
      .single();

    if (!matricula) {
      return NextResponse.json(
        { error: "Este aluno não está cadastrado nesta turma." },
        { status: 403 }
      );
    }

    // 3. Tentar autenticação no Supabase Auth com e-mail sintético e PIN
    const syntheticEmail = `aluno-${aluno_id}@speakup.local`;
    const supabase = await createClient();

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: syntheticEmail,
      password: pin,
    });

    if (authError || !authData.user) {
      // Registrar falha de login no rate limiter
      const contagemAtual = (tentativa?.tentativas || 0) + 1;
      const deveBloquear = contagemAtual >= 5;
      const bloqueadoAte = deveBloquear ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;

      await admin.from("login_tentativas").upsert({
        aluno_id,
        tentativas: contagemAtual,
        primeira_tentativa: tentativa?.primeira_tentativa || agora.toISOString(),
        bloqueado_ate: bloqueadoAte,
      });

      if (deveBloquear) {
        return NextResponse.json(
          {
            error: "Limite de 5 tentativas atingido. O acesso deste aluno foi bloqueado por 15 minutos.",
          },
          { status: 429 }
        );
      }

      const restantes = 5 - contagemAtual;
      return NextResponse.json(
        {
          error: `PIN incorreto. Você ainda tem ${restantes} tentativa(s). Peça ajuda ao seu professor se tiver esquecido o PIN.`,
        },
        { status: 401 }
      );
    }

    // 4. Sucesso: limpar histórico de tentativas
    await admin.from("login_tentativas").delete().eq("aluno_id", aluno_id);

    // 5. Verificar se já possui consentimento LGPD aceito
    const { data: consentimento } = await admin
      .from("consentimentos")
      .select("aluno_id")
      .eq("aluno_id", aluno_id)
      .single();

    const redirectUrl = consentimento ? "/aluno/atividades" : "/aluno/consentimento";

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
      redirectUrl,
    });
  } catch (err: unknown) {
    console.error("Erro no login do aluno:", err);
    return NextResponse.json(
      { error: "Erro interno no servidor ao realizar login." },
      { status: 500 }
    );
  }
}

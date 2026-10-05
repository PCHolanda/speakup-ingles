import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(1, "Digite sua senha"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "Credenciais inválidas" },
        { status: 400 }
      );
    }

    const { email, senha } = result.data;
    const supabase = await createClient();

    // 1. Autenticar no Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: senha,
    });

    if (error || !data.user) {
      return NextResponse.json(
        { error: "E-mail ou senha incorretos. Verifique suas credenciais." },
        { status: 401 }
      );
    }

    // 2. Verificar perfil via Admin Client (imune a bloqueio de RLS e 406)
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("papel, nome")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!profile || (profile.papel !== "teacher" && (profile.papel as string) !== "admin")) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: "Acesso não autorizado. Esta conta não possui perfil docente ou administrativo." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        nome: profile.nome,
        papel: profile.papel,
      },
      redirectUrl: "/admin",
    });
  } catch (error: unknown) {
    console.error("Erro no login do professor:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor ao realizar login." },
      { status: 500 }
    );
  }
}

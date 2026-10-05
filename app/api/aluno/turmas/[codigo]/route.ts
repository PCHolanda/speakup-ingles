import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    const { codigo } = await params;
    if (!codigo || codigo.trim().length !== 6) {
      return NextResponse.json(
        { error: "Código da turma deve ter exatamente 6 caracteres." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Buscar turma pelo código (case insensitive)
    const { data: turma, error: turmaError } = await admin
      .from("turmas")
      .select("id, nome, codigo")
      .ilike("codigo", codigo.trim())
      .single();

    if (turmaError || !turma) {
      return NextResponse.json(
        { error: "Turma não encontrada. Verifique o código com o seu professor." },
        { status: 404 }
      );
    }

    // Buscar alunos vinculados à turma
    const { data: vinculos, error: vinculosError } = await admin
      .from("turma_alunos")
      .select(`
        aluno:profiles (
          id,
          nome
        )
      `)
      .eq("turma_id", turma.id);

    if (vinculosError) {
      return NextResponse.json(
        { error: "Não foi possível carregar os alunos da turma." },
        { status: 500 }
      );
    }

    const rawAlunos = (vinculos || [])
      .map((v) => {
        const a = v.aluno;
        if (Array.isArray(a)) return a[0];
        return a;
      })
      .filter((a): a is { id: string; nome: string } => Boolean(a && typeof a === "object" && "id" in a && "nome" in a));

    const alunos = rawAlunos.sort((a, b) => a.nome.localeCompare(b.nome));

    return NextResponse.json({
      turma: {
        id: turma.id,
        nome: turma.nome,
        codigo: turma.codigo,
      },
      alunos,
    });
  } catch (err: unknown) {
    console.error("Erro na busca da turma:", err);
    return NextResponse.json(
      { error: "Erro interno no servidor ao buscar turma." },
      { status: 500 }
    );
  }
}

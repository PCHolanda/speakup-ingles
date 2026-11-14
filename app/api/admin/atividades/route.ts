import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function resolverPublicStorageUrl(rawPath?: string | null): string | null {
  if (!rawPath) return null;
  const limpo = rawPath.trim();
  if (!limpo) return null;
  if (limpo.startsWith("http://") || limpo.startsWith("https://") || limpo.startsWith("/")) {
    return limpo;
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl && (limpo.startsWith("modelos-professor/") || limpo.startsWith("imagens-questoes/"))) {
    return `${supabaseUrl}/storage/v1/object/public/atividades/${limpo}`;
  }
  return `/seed/${limpo}`;
}

export async function GET() {
  try {
    const admin = createAdminClient();

    const { data: atividades, error: ativErr } = await admin
      .from("atividades")
      .select("id, professor_id, titulo, nivel, publicada, created_at")
      .order("created_at", { ascending: true });

    if (ativErr) throw ativErr;

    let perguntasRaw: Array<any> = [];
    const { data: pComColunas, error: pErr } = await admin
      .from("perguntas")
      .select("*")
      .order("ordem", { ascending: true });

    if (pErr) throw pErr;
    perguntasRaw = pComColunas || [];

    const perguntasNormalizadas = perguntasRaw.map((p) => {
      const gab = p.gabarito && typeof p.gabarito === "object" ? p.gabarito : {};
      const tempoRaw = Number(p.tempo_gravacao_s ?? gab.tempo_gravacao_s ?? (p.tipo === "comparacao" ? 20 : 10));
      const tempoGravacaoS: 5 | 10 | 20 = tempoRaw === 5 ? 5 : tempoRaw === 20 ? 20 : 10;
      const audioProfPath: string | null = p.audio_modelo_professor_path ?? gab.audio_modelo_professor_path ?? null;
      const temImagem = Boolean(p.imagem_path && p.imagem_path.trim().length > 0 && p.tipo !== "oral");

      return {
        id: p.id,
        atividade_id: p.atividade_id,
        secao: p.secao || "Geral",
        ordem: p.ordem ?? 1,
        tipo: p.tipo || "oral",
        tem_imagem: temImagem,
        enunciado: p.enunciado || "",
        instrucao_pt: p.instrucao_pt || "",
        imagem_path: p.imagem_path || null,
        imagem_url: resolverPublicStorageUrl(p.imagem_path),
        respostas_esperadas: Array.isArray(p.respostas_esperadas) ? p.respostas_esperadas : [],
        texto_referencia: p.texto_referencia || "",
        foco_avaliacao: Array.isArray(p.foco_avaliacao) ? p.foco_avaliacao : [],
        dicas: Array.isArray(p.dicas) ? p.dicas : [],
        tempo_gravacao_s: tempoGravacaoS,
        audio_modelo_professor_path: audioProfPath,
        audio_modelo_professor_url: audioProfPath ? resolverPublicStorageUrl(audioProfPath) : null,
      };
    });

    const resultado = (atividades || []).map((a) => {
      const questoes = perguntasNormalizadas
        .filter((p) => p.atividade_id === a.id)
        .sort((x, y) => x.ordem - y.ordem);
      return {
        ...a,
        total_perguntas: questoes.length,
        perguntas: questoes,
      };
    });

    return NextResponse.json({ atividades: resultado });
  } catch (error: any) {
    console.error("Erro ao listar atividades:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao listar avaliações." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const titulo = String(body.titulo || "").trim();
    const nivel = String(body.nivel || "A1").trim() || "A1";
    const publicada = body.publicada !== undefined ? Boolean(body.publicada) : true;

    if (!titulo) {
      return NextResponse.json({ error: "Informe o título da avaliação." }, { status: 400 });
    }

    let professorId: string | null = body.professor_id || null;
    if (!professorId) {
      try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) professorId = user.id;
      } catch {
        // continua com null
      }
    }

    const admin = createAdminClient();
    const { data: novaAtividade, error } = await admin
      .from("atividades")
      .insert({
        titulo,
        nivel,
        publicada,
        professor_id: professorId,
      })
      .select("id, professor_id, titulo, nivel, publicada, created_at")
      .single();

    if (error || !novaAtividade) {
      throw error || new Error("Não foi possível criar a avaliação.");
    }

    return NextResponse.json({ atividade: { ...novaAtividade, total_perguntas: 0, perguntas: [] } });
  } catch (error: any) {
    console.error("Erro ao criar atividade:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao criar avaliação." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const id = String(body.id || "").trim();
    if (!id) {
      return NextResponse.json({ error: "ID da avaliação é obrigatório." }, { status: 400 });
    }

    const campos: Record<string, any> = {};
    if (body.titulo !== undefined) campos.titulo = String(body.titulo).trim();
    if (body.nivel !== undefined) campos.nivel = String(body.nivel).trim() || "A1";
    if (body.publicada !== undefined) campos.publicada = Boolean(body.publicada);

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("atividades")
      .update(campos)
      .eq("id", id)
      .select("id, professor_id, titulo, nivel, publicada, created_at")
      .single();

    if (error) throw error;

    return NextResponse.json({ atividade: data });
  } catch (error: any) {
    console.error("Erro ao atualizar atividade:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao atualizar avaliação." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID da avaliação é obrigatório." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin.from("atividades").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Erro ao excluir atividade:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao excluir avaliação." },
      { status: 500 }
    );
  }
}

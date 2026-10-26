import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const admin = createAdminClient();

    // 1. Tentar buscar Clientes e Escolas (com tolerância se as tabelas ainda não existirem)
    let clientesRaw: Array<any> = [];
    let escolasRaw: Array<any> = [];
    let escolaProfessoresRaw: Array<any> = [];
    let tabelasHierarquiaExistem = true;

    try {
      const { data: cData, error: cErr } = await admin
        .from("clientes")
        .select("id, nome, documento, email_contato, telefone_contato, ativo, created_at")
        .order("nome", { ascending: true });

      if (cErr) throw cErr;
      clientesRaw = cData || [];

      const { data: eData, error: eErr } = await admin
        .from("escolas")
        .select(`
          id,
          nome,
          codigo_inep,
          cidade,
          estado,
          ativo,
          cliente_id,
          created_at,
          cliente:clientes(id, nome)
        `)
        .order("nome", { ascending: true });

      if (eErr) throw eErr;
      escolasRaw = eData || [];

      const { data: epData } = await admin
        .from("escola_professores")
        .select("escola_id, professor_id");
      escolaProfessoresRaw = epData || [];
    } catch (e: any) {
      if (e?.message?.includes("does not exist") || e?.code === "42P01") {
        tabelasHierarquiaExistem = false;
      } else {
        console.warn("Aviso ao buscar clientes/escolas:", e);
      }
    }

    // Mapas para lookup rápido
    const clienteMap = new Map<string, { id: string; nome: string }>();
    clientesRaw.forEach((c) => clienteMap.set(c.id, { id: c.id, nome: c.nome }));

    const escolaMap = new Map<
      string,
      { id: string; nome: string; cliente_id: string; cliente_nome: string }
    >();
    escolasRaw.forEach((e) => {
      const cli = Array.isArray(e.cliente) ? e.cliente[0] : e.cliente;
      const cNome = cli?.nome || clienteMap.get(e.cliente_id)?.nome || "Sem cliente";
      escolaMap.set(e.id, {
        id: e.id,
        nome: e.nome,
        cliente_id: e.cliente_id,
        cliente_nome: cNome,
      });
    });

    // 2. Buscar Professores e Admins
    const { data: profProfiles, error: profError } = await admin
      .from("profiles")
      .select("id, nome, papel, created_at")
      .eq("papel", "teacher")
      .order("created_at", { ascending: false });

    if (profError) throw profError;

    // Buscar emails do auth.users (tolerante a falhas)
    let userEmailMap = new Map<string, string>();
    try {
      const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
      if (authUsers?.users) {
        userEmailMap = new Map(authUsers.users.map((u) => [u.id, u.email || ""]));
      }
    } catch (e) {
      console.warn("Aviso ao buscar emails do Auth:", e);
    }

    // Mapear escolas de cada professor
    const escolasPorProfessor = new Map<string, Array<{ id: string; nome: string }>>();
    escolaProfessoresRaw.forEach((ep) => {
      const esc = escolaMap.get(ep.escola_id);
      if (esc) {
        const arr = escolasPorProfessor.get(ep.professor_id) || [];
        arr.push({ id: esc.id, nome: esc.nome });
        escolasPorProfessor.set(ep.professor_id, arr);
      }
    });

    const professores = (profProfiles || []).map((p) => ({
      id: p.id,
      nome: p.nome,
      papel: p.papel,
      email: userEmailMap.get(p.id) || "Email cadastrado",
      escolas: escolasPorProfessor.get(p.id) || [],
      created_at: p.created_at,
    }));

    // 3. Buscar Turmas
    // Tenta buscar com escola_id se existir
    let turmasData: Array<any> = [];
    try {
      const { data: tData, error: tError } = await admin
        .from("turmas")
        .select(`
          id,
          nome,
          codigo,
          created_at,
          professor_id,
          escola_id,
          professor:profiles!turmas_professor_id_fkey(id, nome)
        `)
        .order("created_at", { ascending: false });

      if (tError) throw tError;
      turmasData = tData || [];
    } catch {
      // Fallback sem escola_id caso a migration ainda não tenha sido aplicada
      const { data: tFallback } = await admin
        .from("turmas")
        .select(`
          id,
          nome,
          codigo,
          created_at,
          professor_id,
          professor:profiles!turmas_professor_id_fkey(id, nome)
        `)
        .order("created_at", { ascending: false });
      turmasData = tFallback || [];
    }

    // Contar alunos por turma
    const { data: vinculosAlunos } = await admin.from("turma_alunos").select("turma_id, aluno_id");
    const countAlunosPorTurma = new Map<string, number>();
    vinculosAlunos?.forEach((v) => {
      countAlunosPorTurma.set(v.turma_id, (countAlunosPorTurma.get(v.turma_id) || 0) + 1);
    });

    // Mapear Turmas com dados da Escola e do Cliente
    const turmas = (turmasData || []).map((t) => {
      const prof = Array.isArray(t.professor) ? t.professor[0] : t.professor;
      const esc = t.escola_id ? escolaMap.get(t.escola_id) : null;
      return {
        id: t.id,
        nome: t.nome,
        codigo: t.codigo,
        professor_id: t.professor_id,
        professor_nome: prof?.nome || "Sem professor vinculado",
        escola_id: t.escola_id || null,
        escola_nome: esc?.nome || "Escola não vinculada",
        cliente_id: esc?.cliente_id || null,
        cliente_nome: esc?.cliente_nome || "Cliente não vinculado",
        total_alunos: countAlunosPorTurma.get(t.id) || 0,
        created_at: t.created_at,
      };
    });

    const turmaLookup = new Map<string, (typeof turmas)[0]>();
    turmas.forEach((t) => turmaLookup.set(t.id, t));

    // 4. Buscar Alunos matriculados
    const { data: matriculas, error: matError } = await admin
      .from("turma_alunos")
      .select(`
        turma:turmas(id, nome, codigo),
        aluno:profiles!turma_alunos_aluno_id_fkey(id, nome, created_at)
      `);

    if (matError) throw matError;

    const alunos = (matriculas || [])
      .map((m) => {
        const t = Array.isArray(m.turma) ? m.turma[0] : m.turma;
        const a = Array.isArray(m.aluno) ? m.aluno[0] : m.aluno;
        const turmaCompleta = t?.id ? turmaLookup.get(t.id) : null;
        return {
          id: a?.id,
          nome: a?.nome || "Aluno",
          turma_id: t?.id,
          turma_nome: t?.nome || "Sem turma",
          turma_codigo: t?.codigo || "N/A",
          escola_id: turmaCompleta?.escola_id || null,
          escola_nome: turmaCompleta?.escola_nome || "Escola não vinculada",
          cliente_id: turmaCompleta?.cliente_id || null,
          cliente_nome: turmaCompleta?.cliente_nome || "Cliente não vinculado",
          created_at: a?.created_at,
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome));

    // 5. Agregar contadores para Escolas e Clientes
    const escolas = escolasRaw.map((e) => {
      const esc = escolaMap.get(e.id);
      const turmasDestaEscola = turmas.filter((t) => t.escola_id === e.id);
      const totalTurmas = turmasDestaEscola.length;
      const totalAlunos = turmasDestaEscola.reduce((acc, t) => acc + t.total_alunos, 0);
      const profsDestaEscola = escolaProfessoresRaw.filter((ep) => ep.escola_id === e.id);

      return {
        id: e.id,
        nome: e.nome,
        codigo_inep: e.codigo_inep,
        cidade: e.cidade,
        estado: e.estado,
        ativo: e.ativo,
        cliente_id: e.cliente_id,
        cliente_nome: esc?.cliente_nome || "Cliente não informado",
        total_turmas: totalTurmas,
        total_alunos: totalAlunos,
        total_professores: profsDestaEscola.length,
        created_at: e.created_at,
      };
    });

    const clientes = clientesRaw.map((c) => {
      const escolasDoCliente = escolas.filter((e) => e.cliente_id === c.id);
      const totalEscolas = escolasDoCliente.length;
      const totalTurmas = escolasDoCliente.reduce((acc, e) => acc + e.total_turmas, 0);
      const totalAlunos = escolasDoCliente.reduce((acc, e) => acc + e.total_alunos, 0);

      return {
        id: c.id,
        nome: c.nome,
        documento: c.documento,
        email_contato: c.email_contato,
        telefone_contato: c.telefone_contato,
        ativo: c.ativo,
        total_escolas: totalEscolas,
        total_turmas: totalTurmas,
        total_alunos: totalAlunos,
        created_at: c.created_at,
      };
    });

    return NextResponse.json({
      tabelas_hierarquia_existem: tabelasHierarquiaExistem,
      clientes,
      escolas,
      professores,
      turmas,
      alunos,
    });
  } catch (error: unknown) {
    console.error("Erro ao carregar dados administrativos:", error);
    return NextResponse.json(
      { error: "Falha ao carregar dados do painel administrativo." },
      { status: 500 }
    );
  }
}

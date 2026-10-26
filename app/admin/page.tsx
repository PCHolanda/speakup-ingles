"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  School,
  GraduationCap,
  Users,
  PlusCircle,
  RefreshCw,
  LogOut,
  Search,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Dices,
  Lock,
  Mail,
  User,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Bot,
  Zap,
  Loader2,
  Building2,
  MapPin,
  Phone,
  Filter,
  ArrowRight,
  Shield,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Cliente {
  id: string;
  nome: string;
  documento: string | null;
  email_contato: string | null;
  telefone_contato: string | null;
  ativo: boolean;
  total_escolas: number;
  total_turmas: number;
  total_alunos: number;
  created_at: string;
}

interface Escola {
  id: string;
  nome: string;
  codigo_inep: string | null;
  cidade: string | null;
  estado: string | null;
  ativo: boolean;
  cliente_id: string;
  cliente_nome: string;
  total_turmas: number;
  total_alunos: number;
  total_professores: number;
  created_at: string;
}

interface Professor {
  id: string;
  nome: string;
  email: string;
  papel: string;
  escolas?: Array<{ id: string; nome: string }>;
  created_at: string;
}

interface Turma {
  id: string;
  nome: string;
  codigo: string;
  professor_id: string;
  professor_nome: string;
  escola_id: string | null;
  escola_nome: string;
  cliente_id: string | null;
  cliente_nome: string;
  total_alunos: number;
  created_at: string;
}

interface Aluno {
  id: string;
  nome: string;
  turma_id: string;
  turma_nome: string;
  turma_codigo: string;
  escola_id: string | null;
  escola_nome: string;
  cliente_id: string | null;
  cliente_nome: string;
  created_at: string;
}

type TabType = "clientes" | "escolas" | "turmas" | "alunos" | "professores" | "ia";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabType>("clientes");

  // Dados do sistema
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [escolas, setEscolas] = useState<Escola[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [tabelasHierarquiaExistem, setTabelasHierarquiaExistem] = useState(true);

  // Filtros em cascata
  const [filtroClienteId, setFiltroClienteId] = useState<string>("todos");
  const [filtroEscolaId, setFiltroEscolaId] = useState<string>("todas");
  const [filtroTurmaId, setFiltroTurmaId] = useState<string>("todas");
  const [busca, setBusca] = useState("");

  // Configuração do Modelo de IA
  const [modeloIa, setModeloIa] = useState("gemini-3.8-flash");
  const [modelosRecomendados, setModelosRecomendados] = useState<
    Array<{ id: string; nome: string; descricao: string }>
  >([]);
  const [temApiKey, setTemApiKey] = useState(true);
  const [tabelaConfigExiste, setTabelaConfigExiste] = useState(true);
  const [salvandoModelo, setSalvandoModelo] = useState(false);
  const [testandoModelo, setTestandoModelo] = useState(false);
  const [resultadoTeste, setResultadoTeste] = useState<{
    sucesso: boolean;
    mensagem: string;
  } | null>(null);

  // Mensagens
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  // Formulário: Novo Cliente
  const [clienteNome, setClienteNome] = useState("");
  const [clienteDocumento, setClienteDocumento] = useState("");
  const [clienteEmail, setClienteEmail] = useState("");
  const [clienteTelefone, setClienteTelefone] = useState("");
  const [salvandoCliente, setSalvandoCliente] = useState(false);

  // Formulário: Nova Escola
  const [escolaClienteId, setEscolaClienteId] = useState("");
  const [escolaNome, setEscolaNome] = useState("");
  const [escolaInep, setEscolaInep] = useState("");
  const [escolaCidade, setEscolaCidade] = useState("");
  const [escolaEstado, setEscolaEstado] = useState("");
  const [salvandoEscola, setSalvandoEscola] = useState(false);

  // Formulário: Nova Turma
  const [turmaNome, setTurmaNome] = useState("");
  const [turmaCodigo, setTurmaCodigo] = useState("");
  const [turmaEscolaId, setTurmaEscolaId] = useState("");
  const [turmaProfId, setTurmaProfId] = useState("");
  const [salvandoTurma, setSalvandoTurma] = useState(false);

  // Formulário: Novo Aluno
  const [alunoNome, setAlunoNome] = useState("");
  const [alunoTurmaId, setAlunoTurmaId] = useState("");
  const [alunoPin, setAlunoPin] = useState("");
  const [salvandoAluno, setSalvandoAluno] = useState(false);

  // Formulário: Novo Professor
  const [profNome, setProfNome] = useState("");
  const [profEmail, setProfEmail] = useState("");
  const [profSenha, setProfSenha] = useState("");
  const [profPapel, setProfPapel] = useState<"teacher" | "admin">("teacher");
  const [profEscolaId, setProfEscolaId] = useState("");
  const [salvandoProf, setSalvandoProf] = useState(false);

  // Carregar dados completos
  const carregarDados = async () => {
    setCarregando(true);
    setMensagemErro(null);
    try {
      const [resDados, resConfig] = await Promise.all([
        fetch("/api/admin/dados"),
        fetch("/api/admin/configuracoes").catch(() => null),
      ]);

      const data = await resDados.json();
      if (!resDados.ok) throw new Error(data.error || "Erro ao buscar dados");

      setClientes(data.clientes || []);
      setEscolas(data.escolas || []);
      setProfessores(data.professores || []);
      setTurmas(data.turmas || []);
      setAlunos(data.alunos || []);
      if (data.tabelas_hierarquia_existem !== undefined) {
        setTabelasHierarquiaExistem(data.tabelas_hierarquia_existem);
      }

      if (resConfig && resConfig.ok) {
        const configData = await resConfig.json();
        if (configData.modelo_atual) setModeloIa(configData.modelo_atual);
        if (configData.modelos_recomendados) setModelosRecomendados(configData.modelos_recomendados);
        if (configData.tem_api_key !== undefined) setTemApiKey(configData.tem_api_key);
        if (configData.tabela_existe !== undefined) setTabelaConfigExiste(configData.tabela_existe);
      }

      // Pré-selecionar itens padrão nos selects
      if (data.clientes?.length > 0 && !escolaClienteId) {
        setEscolaClienteId(data.clientes[0].id);
      }
      if (data.escolas?.length > 0 && !turmaEscolaId) {
        setTurmaEscolaId(data.escolas[0].id);
      }
      if (data.professores?.length > 0 && !turmaProfId) {
        setTurmaProfId(data.professores[0].id);
      }
      if (data.turmas?.length > 0 && !alunoTurmaId) {
        setAlunoTurmaId(data.turmas[0].id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro de conexão";
      setMensagemErro(msg);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const exibirSucesso = (msg: string) => {
    setMensagemSucesso(msg);
    setMensagemErro(null);
    setTimeout(() => setMensagemSucesso(null), 5000);
  };

  // Gerador de PIN aleatório (6 dígitos)
  const gerarPinAleatorio = () => {
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    setAlunoPin(pin);
  };

  // Gerador de Código de Turma aleatório (6 caracteres)
  const gerarCodigoTurma = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let cod = "";
    for (let i = 0; i < 6; i++) {
      cod += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setTurmaCodigo(cod);
  };

  // Copiar cartão de acesso do aluno
  const copiarCartao = (aluno: Aluno, pinFallback = "123456") => {
    const texto = `🎓 SpeakUp A1 - Cartão de Acesso:\nCliente/Rede: ${aluno.cliente_nome}\nEscola: ${aluno.escola_nome}\nTurma: ${aluno.turma_nome} (${aluno.turma_codigo})\nAluno: ${aluno.nome}\nPIN: ${pinFallback}\nSite: ${window.location.origin}/aluno/login`;
    navigator.clipboard.writeText(texto);
    setCopiadoId(aluno.id);
    setTimeout(() => setCopiadoId(null), 2500);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/professor/login");
  };

  // 1. Cadastrar Cliente
  const handleCriarCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvandoCliente(true);
    setMensagemErro(null);

    try {
      const res = await fetch("/api/admin/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: clienteNome,
          documento: clienteDocumento || null,
          email_contato: clienteEmail || null,
          telefone_contato: clienteTelefone || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao cadastrar cliente");

      exibirSucesso(`Cliente "${data.cliente.nome}" cadastrado com sucesso!`);
      setClienteNome("");
      setClienteDocumento("");
      setClienteEmail("");
      setClienteTelefone("");
      carregarDados();
    } catch (err: unknown) {
      setMensagemErro(err instanceof Error ? err.message : "Erro ao cadastrar cliente");
    } finally {
      setSalvandoCliente(false);
    }
  };

  // 2. Cadastrar Escola
  const handleCriarEscola = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvandoEscola(true);
    setMensagemErro(null);

    try {
      const res = await fetch("/api/admin/escolas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: escolaClienteId,
          nome: escolaNome,
          codigo_inep: escolaInep || null,
          cidade: escolaCidade || null,
          estado: escolaEstado || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao cadastrar escola");

      exibirSucesso(`Escola "${data.escola.nome}" cadastrada com sucesso!`);
      setEscolaNome("");
      setEscolaInep("");
      setEscolaCidade("");
      setEscolaEstado("");
      carregarDados();
    } catch (err: unknown) {
      setMensagemErro(err instanceof Error ? err.message : "Erro ao cadastrar escola");
    } finally {
      setSalvandoEscola(false);
    }
  };

  // 3. Cadastrar Turma
  const handleCriarTurma = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvandoTurma(true);
    setMensagemErro(null);

    try {
      const res = await fetch("/api/admin/turmas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: turmaNome,
          codigo: turmaCodigo,
          escola_id: turmaEscolaId || null,
          professor_id: turmaProfId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao criar turma");

      exibirSucesso(`Turma "${data.turma.nome}" criada com o código ${data.turma.codigo}!`);
      setTurmaNome("");
      setTurmaCodigo("");
      carregarDados();
    } catch (err: unknown) {
      setMensagemErro(err instanceof Error ? err.message : "Erro ao cadastrar turma");
    } finally {
      setSalvandoTurma(false);
    }
  };

  // 4. Cadastrar Aluno
  const handleCriarAluno = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvandoAluno(true);
    setMensagemErro(null);

    try {
      const res = await fetch("/api/admin/alunos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: alunoNome,
          turma_id: alunoTurmaId,
          pin: alunoPin,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao cadastrar aluno");

      exibirSucesso(`Aluno "${data.aluno.nome}" matriculado com sucesso com PIN ${data.aluno.pin}!`);
      setAlunoNome("");
      setAlunoPin("");
      carregarDados();
    } catch (err: unknown) {
      setMensagemErro(err instanceof Error ? err.message : "Erro ao cadastrar");
    } finally {
      setSalvandoAluno(false);
    }
  };

  // 5. Cadastrar Professor
  const handleCriarProfessor = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvandoProf(true);
    setMensagemErro(null);

    try {
      const res = await fetch("/api/admin/professores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: profNome,
          email: profEmail,
          senha: profSenha,
          papel: profPapel,
          escola_id: profEscolaId || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao criar docente");

      exibirSucesso(
        `${profPapel === "admin" ? "Administrador" : "Professor"} "${data.professor.nome}" cadastrado com sucesso!`
      );
      setProfNome("");
      setProfEmail("");
      setProfSenha("");
      carregarDados();
    } catch (err: unknown) {
      setMensagemErro(err instanceof Error ? err.message : "Erro ao cadastrar professor");
    } finally {
      setSalvandoProf(false);
    }
  };

  // 6. IA: Salvar e Testar
  const handleSalvarModelo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modeloIa.trim()) return;
    setSalvandoModelo(true);
    setMensagemErro(null);
    setResultadoTeste(null);
    try {
      const res = await fetch("/api/admin/configuracoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelo: modeloIa.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar modelo");
      exibirSucesso(`Modelo "${data.modelo}" salvo e ativado com sucesso para avaliações!`);
      setTabelaConfigExiste(true);
    } catch (err: unknown) {
      setMensagemErro(err instanceof Error ? err.message : "Erro ao salvar modelo");
    } finally {
      setSalvandoModelo(false);
    }
  };

  const handleTestarModelo = async () => {
    if (!modeloIa.trim()) return;
    setTestandoModelo(true);
    setResultadoTeste(null);
    try {
      const res = await fetch("/api/admin/configuracoes/testar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelo: modeloIa.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.sucesso) {
        setResultadoTeste({
          sucesso: false,
          mensagem: data.erro || "Falha ao testar modelo.",
        });
      } else {
        setResultadoTeste({
          sucesso: true,
          mensagem: `Conexão bem-sucedida! O modelo respondeu perfeitamente em ${data.tempo_ms}ms.`,
        });
      }
    } catch (err: unknown) {
      setResultadoTeste({
        sucesso: false,
        mensagem: err instanceof Error ? err.message : "Erro ao conectar com a IA.",
      });
    } finally {
      setTestandoModelo(false);
    }
  };

  // Filtragem dinâmica de dados
  const escolasFiltradas = escolas.filter((e) => {
    const matchCliente = filtroClienteId === "todos" || e.cliente_id === filtroClienteId;
    const matchBusca =
      !busca ||
      e.nome.toLowerCase().includes(busca.toLowerCase()) ||
      e.cliente_nome.toLowerCase().includes(busca.toLowerCase()) ||
      (e.cidade && e.cidade.toLowerCase().includes(busca.toLowerCase()));
    return matchCliente && matchBusca;
  });

  const turmasFiltradas = turmas.filter((t) => {
    const matchCliente = filtroClienteId === "todos" || t.cliente_id === filtroClienteId;
    const matchEscola = filtroEscolaId === "todas" || t.escola_id === filtroEscolaId;
    const matchBusca =
      !busca ||
      t.nome.toLowerCase().includes(busca.toLowerCase()) ||
      t.codigo.toLowerCase().includes(busca.toLowerCase()) ||
      t.escola_nome.toLowerCase().includes(busca.toLowerCase()) ||
      t.professor_nome.toLowerCase().includes(busca.toLowerCase());
    return matchCliente && matchEscola && matchBusca;
  });

  const alunosFiltrados = alunos.filter((a) => {
    const matchCliente = filtroClienteId === "todos" || a.cliente_id === filtroClienteId;
    const matchEscola = filtroEscolaId === "todas" || a.escola_id === filtroEscolaId;
    const matchTurma = filtroTurmaId === "todas" || a.turma_id === filtroTurmaId;
    const matchBusca =
      !busca ||
      a.nome.toLowerCase().includes(busca.toLowerCase()) ||
      a.turma_nome.toLowerCase().includes(busca.toLowerCase()) ||
      a.turma_codigo.toLowerCase().includes(busca.toLowerCase()) ||
      a.escola_nome.toLowerCase().includes(busca.toLowerCase());
    return matchCliente && matchEscola && matchTurma && matchBusca;
  });

  const clientesFiltrados = clientes.filter((c) => {
    return (
      !busca ||
      c.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (c.documento && c.documento.toLowerCase().includes(busca.toLowerCase())) ||
      (c.email_contato && c.email_contato.toLowerCase().includes(busca.toLowerCase()))
    );
  });

  // Copiar SQL de Migração 005
  const copiarSqlMigration005 = () => {
    const sql = `-- Migration 005: Clientes e Escolas
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  documento text,
  email_contato text,
  telefone_contato text,
  ativo boolean default true,
  created_at timestamptz default now()
);

create table if not exists escolas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  nome text not null,
  codigo_inep text,
  cidade text,
  estado varchar(2),
  ativo boolean default true,
  created_at timestamptz default now()
);

alter table turmas add column if not exists escola_id uuid references escolas(id) on delete set null;

create table if not exists escola_professores (
  escola_id uuid not null references escolas(id) on delete cascade,
  professor_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (escola_id, professor_id)
);

alter table clientes enable row level security;
alter table escolas enable row level security;
alter table escola_professores enable row level security;

create policy "Acesso total service_role clientes" on clientes for all to service_role using (true) with check (true);
create policy "Acesso total service_role escolas" on escolas for all to service_role using (true) with check (true);
create policy "Acesso total service_role escola_professores" on escola_professores for all to service_role using (true) with check (true);
create policy "Leitura autenticada clientes" on clientes for select to authenticated using (true);
create policy "Leitura autenticada escolas" on escolas for select to authenticated using (true);
create policy "Leitura autenticada escola_professores" on escola_professores for select to authenticated using (true);

do $$
declare
  v_cliente_id uuid;
  v_escola_id uuid;
begin
  if not exists (select 1 from clientes limit 1) then
    insert into clientes (nome, documento, email_contato)
    values ('Rede SpeakUp Oficial', '00.000.000/0001-00', 'contato@speakup.local')
    returning id into v_cliente_id;

    insert into escolas (cliente_id, nome, cidade, estado)
    values (v_cliente_id, 'Escola Principal (Matriz)', 'São Paulo', 'SP')
    returning id into v_escola_id;

    update turmas set escola_id = v_escola_id where escola_id is null;

    insert into escola_professores (escola_id, professor_id)
    select v_escola_id, id from profiles where papel = 'teacher'
    on conflict do nothing;
  end if;
end $$;`;

    navigator.clipboard.writeText(sql);
    exibirSucesso("Script SQL da Migration 005 copiado! Cole no SQL Editor do Supabase e clique em Run.");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg tracking-tight text-white">SpeakUp A1</span>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                  Gestão Multiescolar
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Clientes ➔ Escolas ➔ Turmas ➔ Professores & Alunos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/aluno/login"
              target="_blank"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition-all"
            >
              Portal Aluno
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>

            <button
              onClick={carregarDados}
              disabled={carregando}
              title="Atualizar dados"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${carregando ? "animate-spin text-emerald-400" : ""}`} />
            </button>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        {/* Aviso se a migration 005 ainda não tiver sido rodada */}
        {!tabelasHierarquiaExistem && (
          <div className="mb-6 p-4 sm:p-5 bg-gradient-to-r from-amber-950/60 to-slate-900 border border-amber-600/40 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl animate-in fade-in">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">
                  Configuração de Banco de Dados Necessária (Migration 005)
                </h4>
                <p className="text-xs text-amber-200/90 mt-0.5 leading-relaxed">
                  As tabelas de <strong>Clientes</strong> e <strong>Escolas</strong> precisam ser criadas no seu banco Supabase. Copie o script SQL com 1 clique e execute no SQL Editor.
                </p>
              </div>
            </div>
            <button
              onClick={copiarSqlMigration005}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer shrink-0"
            >
              <Copy className="w-4 h-4" />
              Copiar SQL Migration 005
            </button>
          </div>
        )}

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5 mb-8">
          {/* Card Clientes */}
          <div
            onClick={() => setTab("clientes")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              tab === "clientes"
                ? "bg-emerald-950/40 border-emerald-500/60 shadow-lg shadow-emerald-500/10"
                : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Clientes</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-white mt-1">{clientes.length}</h3>
            <p className="text-[11px] text-emerald-400 mt-0.5">Redes / Mantenedoras</p>
          </div>

          {/* Card Escolas */}
          <div
            onClick={() => setTab("escolas")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              tab === "escolas"
                ? "bg-amber-950/40 border-amber-500/60 shadow-lg shadow-amber-500/10"
                : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Escolas</span>
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <School className="w-4 h-4" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-white mt-1">{escolas.length}</h3>
            <p className="text-[11px] text-amber-400 mt-0.5">Unidades escolares</p>
          </div>

          {/* Card Turmas */}
          <div
            onClick={() => setTab("turmas")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              tab === "turmas"
                ? "bg-indigo-950/40 border-indigo-500/60 shadow-lg shadow-indigo-500/10"
                : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Turmas</span>
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-white mt-1">{turmas.length}</h3>
            <p className="text-[11px] text-indigo-400 mt-0.5">Com código de 6 dígitos</p>
          </div>

          {/* Card Alunos */}
          <div
            onClick={() => setTab("alunos")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              tab === "alunos"
                ? "bg-sky-950/40 border-sky-500/60 shadow-lg shadow-sky-500/10"
                : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Alunos</span>
              <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
                <GraduationCap className="w-4 h-4" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-white mt-1">{alunos.length}</h3>
            <p className="text-[11px] text-sky-400 mt-0.5">Com PIN de acesso</p>
          </div>

          {/* Card Docentes */}
          <div
            onClick={() => setTab("professores")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              tab === "professores"
                ? "bg-purple-950/40 border-purple-500/60 shadow-lg shadow-purple-500/10"
                : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Docentes</span>
              <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <Shield className="w-4 h-4" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-white mt-1">{professores.length}</h3>
            <p className="text-[11px] text-purple-400 mt-0.5">Professores e Admins</p>
          </div>
        </div>

        {/* Feedback Alerts */}
        {mensagemSucesso && (
          <div className="mb-6 p-4 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-semibold text-sm">{mensagemSucesso}</span>
          </div>
        )}

        {mensagemErro && (
          <div className="mb-6 p-4 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span className="font-semibold text-sm">{mensagemErro}</span>
          </div>
        )}

        {/* Tab Selector */}
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl mb-8 w-full overflow-x-auto shadow-xl">
          <button
            onClick={() => setTab("clientes")}
            className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              tab === "clientes"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <Building2 className="w-4 h-4" />
            1. Clientes
          </button>

          <button
            onClick={() => setTab("escolas")}
            className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              tab === "escolas"
                ? "bg-amber-600 text-white shadow-lg shadow-amber-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <School className="w-4 h-4" />
            2. Escolas
          </button>

          <button
            onClick={() => setTab("turmas")}
            className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              tab === "turmas"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <Users className="w-4 h-4" />
            3. Turmas
          </button>

          <button
            onClick={() => setTab("alunos")}
            className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              tab === "alunos"
                ? "bg-sky-600 text-white shadow-lg shadow-sky-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            4. Alunos
          </button>

          <button
            onClick={() => setTab("professores")}
            className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              tab === "professores"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <Shield className="w-4 h-4" />
            Docentes
          </button>

          <button
            onClick={() => setTab("ia")}
            className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              tab === "ia"
                ? "bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <Bot className="w-4 h-4" />
            Modelo IA
          </button>
        </div>

        {/* Barra Global de Filtros em Cascata (Visível nas abas de Escolas, Turmas e Alunos) */}
        {(tab === "escolas" || tab === "turmas" || tab === "alunos") && (
          <div className="mb-6 p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-wrap items-center gap-3 text-xs">
            <span className="font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 shrink-0">
              <Filter className="w-3.5 h-3.5 text-indigo-400" />
              Filtrar por:
            </span>

            {/* Filtro Cliente */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Cliente:</span>
              <select
                value={filtroClienteId}
                onChange={(e) => {
                  setFiltroClienteId(e.target.value);
                  setFiltroEscolaId("todas");
                  setFiltroTurmaId("todas");
                }}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="todos">Todos os Clientes</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro Escola */}
            {(tab === "turmas" || tab === "alunos") && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Escola:</span>
                <select
                  value={filtroEscolaId}
                  onChange={(e) => {
                    setFiltroEscolaId(e.target.value);
                    setFiltroTurmaId("todas");
                  }}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="todas">Todas as Escolas</option>
                  {escolas
                    .filter((e) => filtroClienteId === "todos" || e.cliente_id === filtroClienteId)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nome}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Filtro Turma */}
            {tab === "alunos" && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Turma:</span>
                <select
                  value={filtroTurmaId}
                  onChange={(e) => setFiltroTurmaId(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="todas">Todas as Turmas</option>
                  {turmas
                    .filter((t) => {
                      const matchC = filtroClienteId === "todos" || t.cliente_id === filtroClienteId;
                      const matchE = filtroEscolaId === "todas" || t.escola_id === filtroEscolaId;
                      return matchC && matchE;
                    })
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome} ({t.codigo})
                      </option>
                    ))}
                </select>
              </div>
            )}

            {(filtroClienteId !== "todos" || filtroEscolaId !== "todas" || filtroTurmaId !== "todas") && (
              <button
                onClick={() => {
                  setFiltroClienteId("todos");
                  setFiltroEscolaId("todas");
                  setFiltroTurmaId("todas");
                }}
                className="ml-auto text-[11px] font-bold text-slate-400 hover:text-white underline cursor-pointer"
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 1: CLIENTES                                                           */}
        {/* ========================================================================= */}
        {tab === "clientes" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Form Cadastrar Cliente */}
            <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-slate-800">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Novo Cliente</h3>
                  <p className="text-xs text-slate-400">Cadastre a Rede de Ensino ou Mantenedora</p>
                </div>
              </div>

              <form onSubmit={handleCriarCliente} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                    Nome da Rede / Cliente
                  </label>
                  <input
                    type="text"
                    value={clienteNome}
                    onChange={(e) => setClienteNome(e.target.value)}
                    placeholder="Ex: Rede Marista de Ensino"
                    className="w-full h-11 px-3.5 text-sm font-medium bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    CNPJ ou Identificador (Opcional)
                  </label>
                  <input
                    type="text"
                    value={clienteDocumento}
                    onChange={(e) => setClienteDocumento(e.target.value)}
                    placeholder="Ex: 12.345.678/0001-90"
                    className="w-full h-11 px-3.5 text-sm font-medium bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-emerald-400" />
                    E-mail de Contato (Opcional)
                  </label>
                  <input
                    type="email"
                    value={clienteEmail}
                    onChange={(e) => setClienteEmail(e.target.value)}
                    placeholder="contato@redemarista.com.br"
                    className="w-full h-11 px-3.5 text-sm font-medium bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    Telefone (Opcional)
                  </label>
                  <input
                    type="text"
                    value={clienteTelefone}
                    onChange={(e) => setClienteTelefone(e.target.value)}
                    placeholder="(11) 98765-4321"
                    className="w-full h-11 px-3.5 text-sm font-medium bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={salvandoCliente || !clienteNome.trim()}
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed mt-2"
                >
                  {salvandoCliente ? "Cadastrando Cliente..." : "Cadastrar Cliente"}
                </button>
              </form>
            </div>

            {/* Lista de Clientes */}
            <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="font-bold text-white text-base">Clientes e Redes de Ensino</h3>
                  <p className="text-xs text-slate-400">{clientesFiltrados.length} cliente(s) cadastrados</p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar cliente ou documento..."
                    className="w-full h-10 pl-9 pr-3 text-xs bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {clientesFiltrados.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-2xl">
                  <Building2 className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-400">Nenhum cliente cadastrado</p>
                  <p className="text-xs text-slate-500 mt-1">Preencha o formulário ao lado para cadastrar o primeiro cliente.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {clientesFiltrados.map((c) => (
                    <div
                      key={c.id}
                      className="p-5 bg-slate-950/80 border border-slate-800 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition-all shadow-md"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-md font-bold">
                            {c.documento || "Cliente Ativo"}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-400">
                            {c.total_escolas} escola(s)
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-white mt-1">{c.nome}</h4>
                        {c.email_contato && (
                          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-slate-500" />
                            {c.email_contato}
                          </p>
                        )}
                        {c.telefone_contato && (
                          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-500" />
                            {c.telefone_contato}
                          </p>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <span className="text-slate-400">
                          {c.total_turmas} turma(s) • {c.total_alunos} aluno(s)
                        </span>
                        <button
                          onClick={() => {
                            setFiltroClienteId(c.id);
                            setTab("escolas");
                          }}
                          className="font-bold text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 cursor-pointer"
                        >
                          Ver Escolas
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 2: ESCOLAS                                                            */}
        {/* ========================================================================= */}
        {tab === "escolas" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Form Cadastrar Escola */}
            <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-slate-800">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Nova Escola</h3>
                  <p className="text-xs text-slate-400">Vincule a escola a um cliente</p>
                </div>
              </div>

              {clientes.length === 0 ? (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-2xl text-xs space-y-2">
                  <p className="font-bold">⚠️ Cadastre pelo menos um Cliente primeiro!</p>
                  <p className="text-slate-300">Cada escola deve pertencer a um Cliente/Rede de Ensino.</p>
                  <button
                    onClick={() => setTab("clientes")}
                    className="inline-flex items-center gap-1 font-bold text-emerald-400 hover:text-emerald-300 underline cursor-pointer mt-1"
                  >
                    Ir para aba Clientes
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCriarEscola} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-amber-400" />
                      Cliente / Rede de Ensino
                    </label>
                    <select
                      value={escolaClienteId}
                      onChange={(e) => setEscolaClienteId(e.target.value)}
                      className="w-full h-11 px-3 text-sm font-medium bg-slate-950 rounded-xl border border-slate-700 text-white focus:border-amber-500 focus:outline-none"
                      required
                    >
                      {clientes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                      <School className="w-3.5 h-3.5 text-amber-400" />
                      Nome da Escola / Unidade
                    </label>
                    <input
                      type="text"
                      value={escolaNome}
                      onChange={(e) => setEscolaNome(e.target.value)}
                      placeholder="Ex: Escola Municipal Ayrton Senna"
                      className="w-full h-11 px-3.5 text-sm font-medium bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Código INEP / MEC (Opcional)
                    </label>
                    <input
                      type="text"
                      value={escolaInep}
                      onChange={(e) => setEscolaInep(e.target.value)}
                      placeholder="Ex: 35012345"
                      className="w-full h-11 px-3.5 text-sm font-medium bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-amber-400" />
                        Cidade
                      </label>
                      <input
                        type="text"
                        value={escolaCidade}
                        onChange={(e) => setEscolaCidade(e.target.value)}
                        placeholder="Ex: Campinas"
                        className="w-full h-11 px-3 text-sm font-medium bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        UF
                      </label>
                      <input
                        type="text"
                        maxLength={2}
                        value={escolaEstado}
                        onChange={(e) => setEscolaEstado(e.target.value.toUpperCase())}
                        placeholder="SP"
                        className="w-full h-11 px-3 text-sm font-medium uppercase bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none text-center font-bold"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={salvandoEscola || !escolaNome.trim() || !escolaClienteId}
                    className="w-full h-12 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-lg shadow-amber-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed mt-2"
                  >
                    {salvandoEscola ? "Cadastrando Escola..." : "Cadastrar Escola"}
                  </button>
                </form>
              )}
            </div>

            {/* Lista de Escolas */}
            <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="font-bold text-white text-base">Escolas Cadastradas</h3>
                  <p className="text-xs text-slate-400">{escolasFiltradas.length} escola(s) listadas</p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar escola, cliente ou cidade..."
                    className="w-full h-10 pl-9 pr-3 text-xs bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {escolasFiltradas.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-2xl">
                  <School className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-400">Nenhuma escola encontrada</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Preencha o formulário ao lado para cadastrar a primeira escola vinculada a um cliente.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {escolasFiltradas.map((e) => (
                    <div
                      key={e.id}
                      className="p-5 bg-slate-950/80 border border-slate-800 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition-all shadow-md"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-xs text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 rounded-md font-bold">
                            {e.cliente_nome}
                          </span>
                          {e.cidade && (
                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-amber-400" />
                              {e.cidade}{e.estado ? `/${e.estado}` : ""}
                            </span>
                          )}
                        </div>
                        <h4 className="text-base font-bold text-white mt-1">{e.nome}</h4>
                        {e.codigo_inep && (
                          <p className="text-xs text-slate-400 mt-1 font-mono">INEP: {e.codigo_inep}</p>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <span className="text-slate-400">
                          {e.total_turmas} turma(s) • {e.total_alunos} aluno(s)
                        </span>
                        <button
                          onClick={() => {
                            setFiltroEscolaId(e.id);
                            setTab("turmas");
                          }}
                          className="font-bold text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 cursor-pointer"
                        >
                          Ver Turmas
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 3: TURMAS                                                             */}
        {/* ========================================================================= */}
        {tab === "turmas" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Form Criar Turma */}
            <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-slate-800">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Criar Nova Turma</h3>
                  <p className="text-xs text-slate-400">Dentro da Escola com código de 6 dígitos</p>
                </div>
              </div>

              {professores.length === 0 ? (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-2xl text-xs">
                  ⚠️ Cadastre pelo menos um <strong>Professor</strong> antes de criar turmas!
                </div>
              ) : (
                <form onSubmit={handleCriarTurma} className="space-y-4">
                  {escolas.length > 0 && (
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                        <School className="w-3.5 h-3.5 text-indigo-400" />
                        Escola Pertencente
                      </label>
                      <select
                        value={turmaEscolaId}
                        onChange={(e) => setTurmaEscolaId(e.target.value)}
                        className="w-full h-11 px-3 text-sm font-medium bg-slate-950 rounded-xl border border-slate-700 text-white focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="">Sem escola vinculada</option>
                        {escolas.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.nome} ({e.cliente_nome})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-indigo-400" />
                      Nome da Turma
                    </label>
                    <input
                      type="text"
                      value={turmaNome}
                      onChange={(e) => setTurmaNome(e.target.value)}
                      placeholder="Ex: 5º Ano C - Matutino"
                      className="w-full h-11 px-3.5 text-sm font-medium bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-indigo-400" />
                        Código de Acesso (6 caracteres)
                      </label>
                      <button
                        type="button"
                        onClick={gerarCodigoTurma}
                        className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Dices className="w-3.5 h-3.5" />
                        Gerar aleatório
                      </button>
                    </div>
                    <input
                      type="text"
                      maxLength={6}
                      value={turmaCodigo}
                      onChange={(e) => setTurmaCodigo(e.target.value.toUpperCase())}
                      placeholder="Ex: DEMO01"
                      className="w-full h-11 px-3.5 text-center font-mono text-lg font-black tracking-widest uppercase bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
                      Professor Responsável
                    </label>
                    <select
                      value={turmaProfId}
                      onChange={(e) => setTurmaProfId(e.target.value)}
                      className="w-full h-11 px-3 text-sm font-medium bg-slate-950 rounded-xl border border-slate-700 text-white focus:border-indigo-500 focus:outline-none"
                      required
                    >
                      {professores.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome} ({p.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={salvandoTurma || !turmaNome || turmaCodigo.length !== 6}
                    className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed mt-2"
                  >
                    {salvandoTurma ? "Criando Turma..." : "Criar Turma"}
                  </button>
                </form>
              )}
            </div>

            {/* Lista de Turmas */}
            <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="font-bold text-white text-base">Turmas no Sistema</h3>
                  <p className="text-xs text-slate-400">{turmasFiltradas.length} turma(s) listadas</p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar turma, escola ou docente..."
                    className="w-full h-10 pl-9 pr-3 text-xs bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {turmasFiltradas.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-2xl">
                  <School className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-400">Nenhuma turma cadastrada</p>
                  <p className="text-xs text-slate-500 mt-1">Crie a sua primeira turma usando o formulário ao lado.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {turmasFiltradas.map((t) => (
                    <div
                      key={t.id}
                      className="p-5 bg-slate-950/80 border border-slate-800 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition-all shadow-md"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-sm font-black tracking-widest text-indigo-300 bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-1 rounded-lg">
                            {t.codigo}
                          </span>
                          <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-blue-400" />
                            {t.total_alunos} aluno(s)
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-white mt-1">{t.nome}</h4>
                        <p className="text-xs text-amber-300/90 mt-1 flex items-center gap-1">
                          <School className="w-3.5 h-3.5 text-amber-400" />
                          <span>{t.escola_nome}</span>
                          {t.cliente_nome && t.cliente_nome !== "Cliente não vinculado" && (
                            <span className="text-slate-500">({t.cliente_nome})</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                          <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
                          Docente: <span className="text-slate-200">{t.professor_nome}</span>
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                        <button
                          onClick={() => {
                            setFiltroTurmaId(t.id);
                            setTab("alunos");
                          }}
                          className="font-bold text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 cursor-pointer"
                        >
                          Ver Alunos
                          <ArrowRight className="w-3 h-3" />
                        </button>
                        <Link
                          href={`/aluno/login`}
                          target="_blank"
                          className="text-slate-400 hover:text-white inline-flex items-center gap-1"
                        >
                          Portal Aluno
                          <ChevronRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 4: ALUNOS                                                             */}
        {/* ========================================================================= */}
        {tab === "alunos" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Form Cadastrar Aluno */}
            <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-slate-800">
                <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Matricular Novo Aluno</h3>
                  <p className="text-xs text-slate-400">Gere o acesso do estudante com PIN</p>
                </div>
              </div>

              {turmas.length === 0 ? (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-2xl text-xs">
                  ⚠️ Cadastre pelo menos uma <strong>Turma</strong> antes de matricular alunos!
                </div>
              ) : (
                <form onSubmit={handleCriarAluno} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-sky-400" />
                      Nome Completo do Aluno
                    </label>
                    <input
                      type="text"
                      value={alunoNome}
                      onChange={(e) => setAlunoNome(e.target.value)}
                      placeholder="Ex: Mariana Castro"
                      className="w-full h-11 px-3.5 text-sm font-medium bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                      <School className="w-3.5 h-3.5 text-sky-400" />
                      Turma & Escola
                    </label>
                    <select
                      value={alunoTurmaId}
                      onChange={(e) => setAlunoTurmaId(e.target.value)}
                      className="w-full h-11 px-3 text-sm font-medium bg-slate-950 rounded-xl border border-slate-700 text-white focus:border-sky-500 focus:outline-none"
                      required
                    >
                      {turmas.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nome} ({t.codigo}) — {t.escola_nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-sky-400" />
                        PIN de Acesso (6 números)
                      </label>
                      <button
                        type="button"
                        onClick={gerarPinAleatorio}
                        className="text-[11px] font-bold text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Dices className="w-3.5 h-3.5" />
                        Gerar aleatório
                      </button>
                    </div>
                    <input
                      type="text"
                      maxLength={6}
                      value={alunoPin}
                      onChange={(e) => setAlunoPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="Ex: 582910"
                      className="w-full h-11 px-3.5 text-center font-mono text-lg font-black tracking-widest bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-600 focus:border-sky-500 focus:outline-none"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={salvandoAluno || !alunoNome || alunoPin.length !== 6}
                    className="w-full h-12 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-lg shadow-sky-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed mt-2"
                  >
                    {salvandoAluno ? "Matriculando Aluno..." : "Matricular Aluno"}
                  </button>
                </form>
              )}
            </div>

            {/* Lista de Alunos */}
            <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="font-bold text-white text-base">Alunos Cadastrados</h3>
                  <p className="text-xs text-slate-400">{alunosFiltrados.length} aluno(s) listados</p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar aluno, turma ou escola..."
                    className="w-full h-10 pl-9 pr-3 text-xs bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              {alunosFiltrados.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-2xl">
                  <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-400">Nenhum aluno encontrado</p>
                  <p className="text-xs text-slate-500 mt-1">Preencha o formulário ao lado para cadastrar.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                        <th className="pb-3 px-3">Nome do Aluno</th>
                        <th className="pb-3 px-3">Escola / Rede</th>
                        <th className="pb-3 px-3">Turma</th>
                        <th className="pb-3 px-3 text-center">Código</th>
                        <th className="pb-3 px-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {alunosFiltrados.map((aluno) => (
                        <tr key={aluno.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center text-xs font-black">
                              {aluno.nome.charAt(0)}
                            </div>
                            {aluno.nome}
                          </td>
                          <td className="py-3 px-3 text-slate-300">
                            <div>{aluno.escola_nome}</div>
                            {aluno.cliente_nome && aluno.cliente_nome !== "Cliente não vinculado" && (
                              <div className="text-[10px] text-slate-500">{aluno.cliente_nome}</div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-300">{aluno.turma_nome}</td>
                          <td className="py-3 px-3 text-center">
                            <span className="font-mono font-black text-indigo-300 bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 rounded-md">
                              {aluno.turma_codigo}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => copiarCartao(aluno)}
                              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
                              title="Copiar dados para enviar ao aluno"
                            >
                              {copiadoId === aluno.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="text-emerald-400">Copiado!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Cartão</span>
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 5: PROFESSORES / ADMINS                                               */}
        {/* ========================================================================= */}
        {tab === "professores" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Form Cadastrar Professor */}
            <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-slate-800">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Novo Docente / Admin</h3>
                  <p className="text-xs text-slate-400">Cadastre usuários com acesso ao painel</p>
                </div>
              </div>

              <form onSubmit={handleCriarProfessor} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-purple-400" />
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    value={profNome}
                    onChange={(e) => setProfNome(e.target.value)}
                    placeholder="Ex: Carlos Eduardo"
                    className="w-full h-11 px-3.5 text-sm font-medium bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-purple-400" />
                    E-mail de Acesso
                  </label>
                  <input
                    type="email"
                    value={profEmail}
                    onChange={(e) => setProfEmail(e.target.value)}
                    placeholder="carlos@escola.com"
                    className="w-full h-11 px-3.5 text-sm font-medium bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-purple-400" />
                    Senha Provisória
                  </label>
                  <input
                    type="password"
                    value={profSenha}
                    onChange={(e) => setProfSenha(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full h-11 px-3.5 text-sm font-medium bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                    required
                    minLength={6}
                  />
                </div>

                {escolas.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                      <School className="w-3.5 h-3.5 text-purple-400" />
                      Vincular à Escola (Opcional)
                    </label>
                    <select
                      value={profEscolaId}
                      onChange={(e) => setProfEscolaId(e.target.value)}
                      className="w-full h-11 px-3 text-sm font-medium bg-slate-950 rounded-xl border border-slate-700 text-white focus:border-purple-500 focus:outline-none"
                    >
                      <option value="">Nenhuma escola específica</option>
                      {escolas.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.nome} ({e.cliente_nome})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-purple-400" />
                    Tipo de Acesso (Papel)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setProfPapel("teacher")}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        profPapel === "teacher"
                          ? "bg-purple-600 border-purple-500 text-white"
                          : "bg-slate-950 border-slate-700 text-slate-400 hover:text-white"
                      }`}
                    >
                      Professor
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfPapel("admin")}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        profPapel === "admin"
                          ? "bg-purple-600 border-purple-500 text-white"
                          : "bg-slate-950 border-slate-700 text-slate-400 hover:text-white"
                      }`}
                    >
                      Administrador
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={salvandoProf || !profNome || !profEmail || profSenha.length < 6}
                  className="w-full h-12 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed mt-2"
                >
                  {salvandoProf ? "Cadastrando Docente..." : "Cadastrar Docente"}
                </button>
              </form>
            </div>

            {/* Lista de Professores */}
            <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="mb-6">
                <h3 className="font-bold text-white text-base">Docentes e Administradores</h3>
                <p className="text-xs text-slate-400">{professores.length} usuário(s) com acesso ao sistema</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {professores.map((prof) => (
                  <div
                    key={prof.id}
                    className="p-5 bg-slate-950/80 border border-slate-800 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition-all shadow-md"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${
                            prof.papel === "admin"
                              ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                              : "bg-purple-500/15 text-purple-400 border-purple-500/30"
                          }`}
                        >
                          {prof.papel === "admin" ? "Administrador" : "Professor"}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {new Date(prof.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-white mt-1">{prof.nome}</h4>
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 font-mono">
                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                        {prof.email}
                      </p>
                      {prof.escolas && prof.escolas.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {prof.escolas.map((esc) => (
                            <span
                              key={esc.id}
                              className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded"
                            >
                              {esc.nome}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 6: MODELO IA                                                          */}
        {/* ========================================================================= */}
        {tab === "ia" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Painel Esquerdo: Status */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-800">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-fuchsia-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-fuchsia-500/20">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Status do Motor IA</h3>
                    <p className="text-xs text-slate-400">Google Gemini & Supabase</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Chave de API</p>
                      <p className="text-sm font-semibold text-slate-200 mt-0.5">GOOGLE_GENERATIVE_AI_API_KEY</p>
                    </div>
                    {temApiKey ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <Check className="w-3.5 h-3.5" />
                        Configurada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Ausente
                      </span>
                    )}
                  </div>

                  <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Modelo Ativo no Momento</p>
                    <p className="text-base font-black text-fuchsia-400 font-mono mt-1 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-fuchsia-400 shrink-0" />
                      {modeloIa}
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Persistência no Banco</p>
                      <p className="text-xs text-slate-400 mt-0.5">Tabela Supabase &apos;configuracoes&apos;</p>
                    </div>
                    {tabelaConfigExiste ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        Ativa
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        Criar Tabela
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Painel Direito: Configuração e Teste */}
            <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
              <div className="mb-6 pb-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="font-bold text-white text-lg flex items-center gap-2">
                    <Bot className="w-5 h-5 text-fuchsia-400" />
                    Configurar Modelo de Inteligência Artificial
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Defina qual versão do Google Gemini processará as avaliações de pronúncia e feedback dos alunos.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSalvarModelo} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Modelos Recomendados (Clique para selecionar)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {modelosRecomendados.map((mod) => {
                      const selecionado = modeloIa === mod.id;
                      return (
                        <button
                          key={mod.id}
                          type="button"
                          onClick={() => {
                            setModeloIa(mod.id);
                            setResultadoTeste(null);
                          }}
                          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative ${
                            selecionado
                              ? "bg-fuchsia-950/40 border-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/10 ring-1 ring-fuchsia-500/50"
                              : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-950"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-bold text-sm text-white">{mod.nome}</span>
                            {selecionado && (
                              <span className="w-5 h-5 rounded-full bg-fuchsia-500 text-white flex items-center justify-center">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">{mod.descricao}</p>
                          <span className="inline-block mt-2 font-mono text-[11px] text-fuchsia-300/80 bg-fuchsia-500/10 px-2 py-0.5 rounded-md border border-fuchsia-500/20">
                            {mod.id}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Identificador do Modelo (ID exato da API Google)
                  </label>
                  <input
                    type="text"
                    value={modeloIa}
                    onChange={(e) => {
                      setModeloIa(e.target.value);
                      setResultadoTeste(null);
                    }}
                    placeholder="ex: gemini-3.8-flash"
                    className="w-full h-12 px-4 text-sm font-mono bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-500 focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                    required
                  />
                </div>

                {resultadoTeste && (
                  <div
                    className={`p-4 rounded-2xl border text-xs flex items-start gap-3 animate-in fade-in slide-in-from-top-2 ${
                      resultadoTeste.sucesso
                        ? "bg-emerald-950/50 border-emerald-800 text-emerald-200"
                        : "bg-rose-950/50 border-rose-800 text-rose-200"
                    }`}
                  >
                    {resultadoTeste.sucesso ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <span className="font-semibold leading-relaxed">{resultadoTeste.mensagem}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleTestarModelo}
                    disabled={testandoModelo || !modeloIa.trim()}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:border-slate-600"
                  >
                    {testandoModelo ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-fuchsia-400" />
                        Testando Conexão...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 text-amber-400" />
                        Testar Modelo em Tempo Real
                      </>
                    )}
                  </button>

                  <button
                    type="submit"
                    disabled={salvandoModelo || !modeloIa.trim()}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-fuchsia-600/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
                  >
                    {salvandoModelo ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Salvando Configuração...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Salvar e Ativar Modelo
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500">
        SpeakUp A1 — Console de Administração Multiescolar • Next.js & Supabase
      </footer>
    </div>
  );
}

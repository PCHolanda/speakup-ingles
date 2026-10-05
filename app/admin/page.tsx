"use client";

import { useEffect, useState, useTransition } from "react";
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
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Professor {
  id: string;
  nome: string;
  email: string;
  papel: string;
  created_at: string;
}

interface Turma {
  id: string;
  nome: string;
  codigo: string;
  professor_id: string;
  professor_nome: string;
  total_alunos: number;
  created_at: string;
}

interface Aluno {
  id: string;
  nome: string;
  turma_id: string;
  turma_nome: string;
  turma_codigo: string;
  created_at: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"turmas" | "alunos" | "professores">("alunos");
  
  // Dados do sistema
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");

  // Mensagens
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  // Formulário: Novo Aluno
  const [alunoNome, setAlunoNome] = useState("");
  const [alunoTurmaId, setAlunoTurmaId] = useState("");
  const [alunoPin, setAlunoPin] = useState("");
  const [salvandoAluno, setSalvandoAluno] = useState(false);

  // Formulário: Nova Turma
  const [turmaNome, setTurmaNome] = useState("");
  const [turmaCodigo, setTurmaCodigo] = useState("");
  const [turmaProfId, setTurmaProfId] = useState("");
  const [salvandoTurma, setSalvandoTurma] = useState(false);

  // Formulário: Novo Professor
  const [profNome, setProfNome] = useState("");
  const [profEmail, setProfEmail] = useState("");
  const [profSenha, setProfSenha] = useState("");
  const [profPapel, setProfPapel] = useState<"teacher" | "admin">("teacher");
  const [salvandoProf, setSalvandoProf] = useState(false);

  // Carregar dados
  const carregarDados = async () => {
    setCarregando(true);
    setMensagemErro(null);
    try {
      const res = await fetch("/api/admin/dados");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao buscar dados");
      setProfessores(data.professores || []);
      setTurmas(data.turmas || []);
      setAlunos(data.alunos || []);
      
      // Auto-selecionar primeiro professor e turma se vazios
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

  // Notificação temporária
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
    const texto = `🎓 SpeakUp A1 - Cartão de Acesso:\nTurma: ${aluno.turma_nome} (${aluno.turma_codigo})\nAluno: ${aluno.nome}\nPIN: ${pinFallback}\nSite: ${window.location.origin}/aluno/login`;
    navigator.clipboard.writeText(texto);
    setCopiadoId(aluno.id);
    setTimeout(() => setCopiadoId(null), 2500);
  };

  // Logout
  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/professor/login");
  };

  // 1. Submeter Aluno
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

      exibirSucesso(`Aluno "${data.aluno.nome}" cadastrado com sucesso com PIN ${data.aluno.pin}!`);
      setAlunoNome("");
      setAlunoPin("");
      carregarDados();
    } catch (err: unknown) {
      setMensagemErro(err instanceof Error ? err.message : "Erro ao cadastrar");
    } finally {
      setSalvandoAluno(false);
    }
  };

  // 2. Submeter Turma
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

  // 3. Submeter Professor
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
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao criar docente");

      exibirSucesso(`${profPapel === "admin" ? "Administrador" : "Professor"} "${data.professor.nome}" cadastrado com sucesso!`);
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

  // Filtro de Alunos
  const alunosFiltrados = alunos.filter(
    (a) =>
      a.nome.toLowerCase().includes(busca.toLowerCase()) ||
      a.turma_nome.toLowerCase().includes(busca.toLowerCase()) ||
      a.turma_codigo.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
              <School className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg tracking-tight text-white">SpeakUp A1</span>
                <span className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                  Painel Admin
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Gerenciamento Escolar de Turmas e Alunos</p>
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
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${carregando ? "animate-spin text-indigo-400" : ""}`} />
            </button>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 px-3 py-1.5 rounded-lg transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {/* Card Alunos */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-900/60 border border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-xl">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total de Alunos</p>
              <h3 className="text-3xl font-black text-white mt-1">{alunos.length}</h3>
              <p className="text-xs text-blue-400 mt-1 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                Matriculados no sistema
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </div>

          {/* Card Turmas */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-900/60 border border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-xl">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Turmas Ativas</p>
              <h3 className="text-3xl font-black text-white mt-1">{turmas.length}</h3>
              <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                <School className="w-3.5 h-3.5" />
                Com códigos de 6 dígitos
              </p>
            </div>
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center">
              <School className="w-6 h-6" />
            </div>
          </div>

          {/* Card Docentes */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-900/60 border border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-xl">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Professores & Admins</p>
              <h3 className="text-3xl font-black text-white mt-1">{professores.length}</h3>
              <p className="text-xs text-indigo-400 mt-1 flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5" />
                Com acesso ao painel
              </p>
            </div>
            <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center">
              <GraduationCap className="w-6 h-6" />
            </div>
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
        <div className="flex items-center gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl mb-8 w-full max-w-md mx-auto sm:mx-0">
          <button
            onClick={() => setTab("alunos")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              tab === "alunos"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Users className="w-4 h-4" />
            Alunos
          </button>

          <button
            onClick={() => setTab("turmas")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              tab === "turmas"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <School className="w-4 h-4" />
            Turmas
          </button>

          <button
            onClick={() => setTab("professores")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              tab === "professores"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            Docentes
          </button>
        </div>

        {/* ========================================================================= */}
        {/* ABA 1: ALUNOS                                                             */}
        {/* ========================================================================= */}
        {tab === "alunos" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Form Cadastrar Aluno */}
            <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-slate-800">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Cadastrar Novo Aluno</h3>
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
                      <User className="w-3.5 h-3.5 text-blue-400" />
                      Nome Completo do Aluno
                    </label>
                    <input
                      type="text"
                      value={alunoNome}
                      onChange={(e) => setAlunoNome(e.target.value)}
                      placeholder="Ex: Mariana Castro"
                      className="w-full h-11 px-3.5 text-sm font-medium bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                      <School className="w-3.5 h-3.5 text-blue-400" />
                      Turma
                    </label>
                    <select
                      value={alunoTurmaId}
                      onChange={(e) => setAlunoTurmaId(e.target.value)}
                      className="w-full h-11 px-3 text-sm font-medium bg-slate-950 rounded-xl border border-slate-700 text-white focus:border-blue-500 focus:outline-none"
                      required
                    >
                      {turmas.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nome} ({t.codigo})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-blue-400" />
                        PIN de Acesso (6 números)
                      </label>
                      <button
                        type="button"
                        onClick={gerarPinAleatorio}
                        className="text-[11px] font-bold text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 cursor-pointer"
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
                      className="w-full h-11 px-3.5 text-center font-mono text-lg font-black tracking-widest bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={salvandoAluno || !alunoNome || alunoPin.length !== 6}
                    className="w-full h-12 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed mt-2"
                  >
                    {salvandoAluno ? "Cadastrando Aluno..." : "Matricular Aluno"}
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
                    placeholder="Buscar aluno ou turma..."
                    className="w-full h-10 pl-9 pr-3 text-xs bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
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
                        <th className="pb-3 px-3">Turma</th>
                        <th className="pb-3 px-3 text-center">Código Turma</th>
                        <th className="pb-3 px-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {alunosFiltrados.map((aluno) => (
                        <tr key={aluno.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center text-xs font-black">
                              {aluno.nome.charAt(0)}
                            </div>
                            {aluno.nome}
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
        {/* ABA 2: TURMAS                                                             */}
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
                  <p className="text-xs text-slate-400">Defina o código de acesso dos alunos</p>
                </div>
              </div>

              {professores.length === 0 ? (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-2xl text-xs">
                  ⚠️ Cadastre pelo menos um <strong>Professor</strong> antes de criar turmas!
                </div>
              ) : (
                <form onSubmit={handleCriarTurma} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                      <School className="w-3.5 h-3.5 text-indigo-400" />
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
              <div className="mb-6">
                <h3 className="font-bold text-white text-base">Turmas no Sistema</h3>
                <p className="text-xs text-slate-400">{turmas.length} turma(s) cadastradas</p>
              </div>

              {turmas.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-2xl">
                  <School className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-400">Nenhuma turma cadastrada</p>
                  <p className="text-xs text-slate-500 mt-1">Crie a sua primeira turma usando o formulário ao lado.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {turmas.map((t) => (
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
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                          <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
                          Docente: <span className="text-slate-200">{t.professor_nome}</span>
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Cadastrada em {new Date(t.created_at).toLocaleDateString("pt-BR")}</span>
                        <Link
                          href={`/aluno/login`}
                          target="_blank"
                          className="font-bold text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
                        >
                          Entrar como Aluno
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
        {/* ABA 3: PROFESSORES / ADMINS                                               */}
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
                    E-mail Institucional
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
                    Senha de Acesso (mín. 6 caracteres)
                  </label>
                  <input
                    type="password"
                    value={profSenha}
                    onChange={(e) => setProfSenha(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 px-3.5 text-sm font-medium bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                    Papel de Acesso
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setProfPapel("teacher")}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                        profPapel === "teacher"
                          ? "bg-purple-600 border-purple-500 text-white"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      Professor
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfPapel("admin")}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                        profPapel === "admin"
                          ? "bg-purple-600 border-purple-500 text-white"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
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

            {/* Lista de Docentes */}
            <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="mb-6">
                <h3 className="font-bold text-white text-base">Equipe Docente e Administrativa</h3>
                <p className="text-xs text-slate-400">{professores.length} profissional(is) cadastrado(s)</p>
              </div>

              <div className="divide-y divide-slate-800/80">
                {professores.map((prof) => (
                  <div key={prof.id} className="py-4 flex items-center justify-between first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold text-sm">
                        {prof.nome.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-sm">{prof.nome}</h4>
                          <span
                            className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                              prof.papel === "admin"
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                : "bg-purple-500/20 text-purple-300 border-purple-500/30"
                            }`}
                          >
                            {prof.papel === "admin" ? "Administrador" : "Professor"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1 font-mono">
                          <Mail className="w-3 h-3 text-slate-500" />
                          {prof.email}
                        </p>
                      </div>
                    </div>

                    <div className="text-right text-[11px] text-slate-500">
                      Cadastrado em {new Date(prof.created_at).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500">
        SpeakUp A1 — Console de Administração Docente • Next.js & Supabase
      </footer>
    </div>
  );
}

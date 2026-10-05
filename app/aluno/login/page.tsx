"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mic, ArrowLeft, Loader2, KeyRound, School, User, AlertCircle } from "lucide-react";

interface AlunoOption {
  id: string;
  nome: string;
}

export default function AlunoLoginPage() {
  const router = useRouter();

  // Estados
  const [codigoTurma, setCodigoTurma] = useState("");
  const [turmaNome, setTurmaNome] = useState<string | null>(null);
  const [alunos, setAlunos] = useState<AlunoOption[]>([]);
  const [alunoSelecionado, setAlunoSelecionado] = useState<string>("");
  const [pin, setPin] = useState("");
  
  const [carregandoTurma, setCarregandoTurma] = useState(false);
  const [carregandoLogin, setCarregandoLogin] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Buscar turma por código
  const handleBuscarTurma = async (codigo: string) => {
    const limpo = codigo.trim().toUpperCase();
    setCodigoTurma(limpo);
    setErro(null);

    if (limpo.length !== 6) {
      setTurmaNome(null);
      setAlunos([]);
      setAlunoSelecionado("");
      return;
    }

    setCarregandoTurma(true);
    try {
      const res = await fetch(`/api/aluno/turmas/${limpo}`);
      const data = await res.json();

      if (!res.ok) {
        setErro(data.error || "Código da turma não encontrado.");
        setTurmaNome(null);
        setAlunos([]);
      } else {
        setTurmaNome(data.turma.nome);
        setAlunos(data.alunos || []);
        if (data.alunos?.length === 1) {
          setAlunoSelecionado(data.alunos[0].id);
        }
      }
    } catch {
      setErro("Falha de conexão ao buscar turma. Verifique sua internet.");
    } finally {
      setCarregandoTurma(false);
    }
  };

  // Submeter Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!codigoTurma || codigoTurma.length !== 6) {
      setErro("Digite o código de 6 letras ou números da sua turma.");
      return;
    }

    if (!alunoSelecionado) {
      setErro("Selecione o seu nome na lista de alunos.");
      return;
    }

    if (!pin || pin.length !== 6) {
      setErro("O PIN deve ter exatamente 6 números.");
      return;
    }

    setCarregandoLogin(true);
    try {
      const res = await fetch("/api/aluno/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turma_codigo: codigoTurma,
          aluno_id: alunoSelecionado,
          pin,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErro(data.error || "Não foi possível entrar. Verifique seu PIN.");
      } else {
        router.push(data.redirectUrl || "/aluno/consentimento");
      }
    } catch {
      setErro("Erro de comunicação com o servidor.");
    } finally {
      setCarregandoLogin(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-500 via-blue-600 to-indigo-700 flex flex-col justify-between p-4 sm:p-6">
      {/* Top Header */}
      <header className="w-full max-w-md mx-auto flex items-center justify-between text-white py-2">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-bold bg-white/15 hover:bg-white/25 px-3.5 py-2 rounded-xl backdrop-blur transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Link>
        <span className="text-xs font-black tracking-widest uppercase bg-white/20 px-3 py-1 rounded-full">
          Aluno SpeakUp
        </span>
      </header>

      {/* Main Login Card */}
      <main className="w-full max-w-md mx-auto my-auto bg-white rounded-3xl p-6 sm:p-8 shadow-2xl shadow-blue-900/40">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
            <Mic className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Entrar na Atividade</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Preencha os dados do seu cartão de acesso
          </p>
        </div>

        {erro && (
          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-sm font-semibold flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
            <span>{erro}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          {/* 1. Código da Turma */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
              <School className="w-4 h-4 text-blue-600" />
              1. Código da Turma (6 dígitos)
            </label>
            <div className="relative">
              <input
                type="text"
                maxLength={6}
                value={codigoTurma}
                onChange={(e) => handleBuscarTurma(e.target.value)}
                placeholder="Ex: DEMO01"
                className="w-full h-14 px-4 text-center font-mono text-xl font-black tracking-widest uppercase rounded-2xl border-2 border-slate-200 focus:border-blue-600 focus:outline-none transition-all"
                autoComplete="off"
                required
              />
              {carregandoTurma && (
                <div className="absolute right-4 top-4 text-blue-600 animate-spin">
                  <Loader2 className="w-6 h-6" />
                </div>
              )}
            </div>
            {turmaNome && (
              <p className="text-xs font-bold text-emerald-600 mt-1.5 flex items-center gap-1">
                ✓ Turma: <span className="underline">{turmaNome}</span>
              </p>
            )}
          </div>

          {/* 2. Seleção do Aluno */}
          {turmaNome && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
                <User className="w-4 h-4 text-blue-600" />
                2. Selecione o seu Nome
              </label>
              <select
                value={alunoSelecionado}
                onChange={(e) => setAlunoSelecionado(e.target.value)}
                className="w-full h-14 px-4 text-base font-bold text-slate-800 rounded-2xl border-2 border-slate-200 focus:border-blue-600 focus:outline-none bg-white transition-all"
                required
              >
                <option value="">-- Escolha o seu nome --</option>
                {alunos.map((aluno) => (
                  <option key={aluno.id} value={aluno.id}>
                    {aluno.nome}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 3. PIN de 6 Dígitos */}
          {alunoSelecionado && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-blue-600" />
                3. Digite seu PIN (6 números)
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="••••••"
                className="w-full h-14 px-4 text-center font-mono text-2xl font-black tracking-widest rounded-2xl border-2 border-slate-200 focus:border-blue-600 focus:outline-none transition-all"
                required
              />
            </div>
          )}

          {/* Botão de Entrar */}
          <button
            type="submit"
            disabled={carregandoLogin || !codigoTurma || !alunoSelecionado || pin.length !== 6}
            className="w-full min-h-[56px] bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-black text-lg rounded-2xl shadow-lg shadow-blue-600/30 hover:shadow-blue-600/40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {carregandoLogin ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Verificando...
              </>
            ) : (
              "Entrar na Aula"
            )}
          </button>
        </form>
      </main>

      {/* Footer Info */}
      <footer className="w-full max-w-md mx-auto text-center text-white/80 text-xs py-2 font-medium">
        Não sabe seu PIN ou código? Peça ajuda ao seu professor de inglês.
      </footer>
    </div>
  );
}

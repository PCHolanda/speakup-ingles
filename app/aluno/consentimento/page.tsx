"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  FileText,
  UserCheck,
  Mic,
  Lock,
  ArrowRight,
  LogOut,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Info,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function AlunoConsentimentoPage() {
  const router = useRouter();

  const [nomeAluno, setNomeAluno] = useState<string>("");
  const [responsavelNome, setResponsavelNome] = useState("");
  const [concordoTermos, setConcordoTermos] = useState(false);

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Verificar status do consentimento
  useEffect(() => {
    async function verificar() {
      try {
        const res = await fetch("/api/aluno/consentimento");
        if (res.status === 401) {
          router.push("/aluno/login");
          return;
        }

        const data = await res.json();
        if (data.aluno?.nome) {
          setNomeAluno(data.aluno.nome);
        }

        // Se já tiver consentimento registrado, vai direto para atividades
        if (data.temConsentimento) {
          router.replace("/aluno/atividades");
          return;
        }
      } catch {
        setErro("Não foi possível carregar as informações. Tente recarregar a página.");
      } finally {
        setCarregando(false);
      }
    }

    verificar();
  }, [router]);

  // Logout
  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/aluno/login");
  };

  // Submeter Consentimento
  const handleConfirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!responsavelNome.trim()) {
      setErro("Por favor, informe o nome completo do responsável legal.");
      return;
    }

    if (!concordoTermos) {
      setErro("É necessário marcar o aceite do termo de consentimento para continuar.");
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch("/api/aluno/consentimento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responsavel_nome: responsavelNome }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao registrar consentimento");
      }

      router.push("/aluno/atividades");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar termo.";
      setErro(msg);
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
        <p className="text-sm font-semibold text-slate-400">Carregando termo de consentimento...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans">
      {/* Top Header */}
      <header className="w-full max-w-2xl mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <span className="font-black text-sm tracking-tight text-white block">SpeakUp A1</span>
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
              Área do Estudante
            </span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 transition-all cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sair
        </button>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-2xl mx-auto my-6 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/60">
        {/* Title & Badge */}
        <div className="flex items-center gap-3 mb-6 pb-5 border-b border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white">Termo de Consentimento</h1>
              <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                LGPD
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Autorização para participação em avaliação oral e prática de pronúncia
            </p>
          </div>
        </div>

        {/* Student identification callout */}
        <div className="mb-6 p-4 bg-blue-950/40 border border-blue-800/40 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-black text-base">
              {nomeAluno ? nomeAluno.charAt(0) : "A"}
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-300">Aluno Matriculado</p>
              <h3 className="text-base font-bold text-white">{nomeAluno || "Aluno"}</h3>
            </div>
          </div>
          <span className="text-xs font-semibold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-lg">
            Nível A1
          </span>
        </div>

        {erro && (
          <div className="mb-6 p-4 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
            <span>{erro}</span>
          </div>
        )}

        {/* Term content highlights */}
        <div className="space-y-3 mb-6 text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-4 sm:p-5 rounded-2xl border border-slate-800/80">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p>
              <strong className="text-white">Finalidade Pedagógica:</strong> A plataforma SpeakUp A1 realiza atividades orais de inglês para treinar a fala e a pronúncia do aluno, oferecendo dicas pedagógicas imediatas.
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p>
              <strong className="text-white">Gravação de Voz:</strong> O microfone será utilizado apenas durante os exercícios de resposta oral para que a inteligência pedagógica e o professor possam analisar o progresso.
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p>
              <strong className="text-white">Privacidade e Proteção (LGPD):</strong> Em estrita conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), os áudios e respostas são restritos ao professor responsável e à escola, não sendo compartilhados com terceiros nem usados para fins comerciais.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleConfirmar} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-blue-400" />
              Nome Completo do Responsável Legal (Pai, Mãe ou Tutor)
            </label>
            <input
              type="text"
              value={responsavelNome}
              onChange={(e) => setResponsavelNome(e.target.value)}
              placeholder="Ex: Maria das Graças Silva"
              className="w-full h-12 px-4 text-sm font-medium bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none transition-all"
              required
            />
          </div>

          <div className="p-3.5 bg-slate-950/40 border border-slate-800 rounded-xl">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={concordoTermos}
                onChange={(e) => setConcordoTermos(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900 cursor-pointer"
              />
              <span className="text-xs text-slate-300 font-medium leading-snug">
                Declaro que sou o pai, mãe ou responsável legal pelo aluno e autorizo sua participação nas atividades de prática oral e a gravação de áudio pedagógica, conforme os termos acima descritos.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={salvando || !responsavelNome.trim() || !concordoTermos}
            className="w-full h-13 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {salvando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Registrando Consentimento...
              </>
            ) : (
              <>
                Confirmar e Liberar Atividades
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-2xl mx-auto text-center text-[11px] text-slate-500 py-2">
        SpeakUp A1 — Ambiente Escolar Seguro e em Conformidade com a LGPD
      </footer>
    </div>
  );
}

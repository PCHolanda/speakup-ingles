"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Mic,
  Volume2,
  GraduationCap,
  Sparkles,
  Play,
  CheckCircle2,
  LogOut,
  School,
  Clock,
  ChevronRight,
  Headphones,
  Award,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Atividade {
  id: string;
  titulo: string;
  nivel: string;
  total_perguntas: number;
  concluida: boolean;
  sessao_id: string | null;
}

interface TurmaInfo {
  id: string;
  nome: string;
  codigo: string;
}

interface AlunoInfo {
  id: string;
  nome: string;
  papel: string;
}

export default function AlunoAtividadesPage() {
  const router = useRouter();

  const [aluno, setAluno] = useState<AlunoInfo | null>(null);
  const [turma, setTurma] = useState<TurmaInfo | null>(null);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      try {
        const res = await fetch("/api/aluno/atividades");
        if (res.status === 401) {
          router.push("/aluno/login");
          return;
        }

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro ao carregar");

        setAluno(data.aluno);
        setTurma(data.turma);
        setAtividades(data.atividades || []);
      } catch (err: unknown) {
        setErro(err instanceof Error ? err.message : "Erro ao carregar dados.");
      } finally {
        setCarregando(false);
      }
    }

    carregar();
  }, [router]);

  // Logout
  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/aluno/login");
  };

  if (carregando) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
        <p className="text-sm font-semibold text-slate-400">Carregando suas atividades...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <span className="font-black text-base tracking-tight text-white block">SpeakUp A1</span>
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                Portal do Aluno
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {turma && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
                <School className="w-3.5 h-3.5 text-blue-400" />
                <span>{turma.nome}</span>
                <span className="font-mono text-indigo-300 font-bold ml-1">({turma.codigo})</span>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 w-full flex-1">
        {/* Welcome Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 p-6 sm:p-8 text-white shadow-2xl mb-8">
          <div className="relative z-10 max-w-xl">
            <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Prática de Conversação
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
              Hello, {aluno?.nome || "Aluno"}! 👋
            </h1>
            <p className="text-sm text-blue-100 mt-2 font-medium leading-relaxed">
              Pronto para praticar sua pronúncia em inglês? Ouça as perguntas com atenção e responda falando no microfone.
            </p>
          </div>

          <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        </div>

        {erro && (
          <div className="mb-6 p-4 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-2xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span className="font-semibold text-sm">{erro}</span>
          </div>
        )}

        {/* Section Title */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-blue-400" />
              Suas Avaliações Orais
            </h2>
            <p className="text-xs text-slate-400">Selecione uma atividade para iniciar a prática</p>
          </div>
          <span className="text-xs font-bold text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1 rounded-full">
            {atividades.length} atividade(s)
          </span>
        </div>

        {/* Activities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          {atividades.map((ativ) => (
            <div
              key={ativ.id}
              className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between hover:border-slate-700 transition-all shadow-xl group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[11px] font-black uppercase tracking-wider bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2.5 py-0.5 rounded-full">
                    Nível {ativ.nivel || "A1"}
                  </span>

                  {ativ.concluida ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      Concluída
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                      Pendente
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-bold text-white group-hover:text-blue-300 transition-colors">
                  {ativ.titulo}
                </h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Avaliação interativa com {ativ.total_perguntas} perguntas faladas: apresentação pessoal, rotina, família e vocabulário básico.
                </p>

                <div className="flex items-center gap-4 mt-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-blue-400" />
                    {ativ.total_perguntas} perguntas
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    ~10 minutos
                  </span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800">
                <Link
                  href={`/aluno/atividades/${ativ.id}`}
                  className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-current" />
                  {ativ.concluida ? "Praticar Novamente" : "Iniciar Avaliação Oral"}
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Audio Tips Callout */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Dicas para uma boa gravação</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Fique em um ambiente silencioso, fale com voz clara e ouça a pergunta quantas vezes precisar.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full text-center text-xs text-slate-500 py-4 border-t border-slate-900">
        SpeakUp A1 — Plataforma Educacional de Avaliação Oral
      </footer>
    </div>
  );
}

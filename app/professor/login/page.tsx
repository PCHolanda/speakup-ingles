"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GraduationCap, ArrowLeft, Loader2, Mail, Lock, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ProfessorLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      });

      if (error || !data.user) {
        setErro("E-mail ou senha incorretos. Verifique suas credenciais.");
        setCarregando(false);
        return;
      }

      // Validar se é professor
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("papel")
        .eq("id", data.user.id)
        .single();

      if (profileError || (profile?.papel !== "teacher" && profile?.papel !== "admin")) {
        await supabase.auth.signOut();
        setErro("Acesso não autorizado. Esta conta não possui perfil de professor ou administrador.");
        setCarregando(false);
        return;
      }

      router.push("/admin");
    } catch {
      setErro("Falha de conexão ao autenticar. Tente novamente.");
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-between p-4 sm:p-6 text-slate-100">
      {/* Top Header */}
      <header className="w-full max-w-md mx-auto flex items-center justify-between py-2">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl border border-slate-700 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Início
        </Link>
        <span className="text-xs font-black tracking-widest uppercase bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-3 py-1 rounded-full">
          Portal Docente
        </span>
      </header>

      {/* Main Login Card */}
      <main className="w-full max-w-md mx-auto my-auto bg-slate-800 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/50">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-white">Login do Professor</h1>
          <p className="text-sm font-medium text-slate-400 mt-1">
            Gerencie suas turmas e analise as gravações dos alunos
          </p>
        </div>

        {erro && (
          <div className="mb-5 p-3.5 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-2xl text-sm font-semibold flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            <span>{erro}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-indigo-400" />
              E-mail Institucional
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="professor@escola.com"
              className="w-full h-13 px-4 text-base font-semibold bg-slate-900/80 rounded-2xl border border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-indigo-400" />
              Senha
            </label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              className="w-full h-13 px-4 text-base font-semibold bg-slate-900/80 rounded-2xl border border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none transition-all"
              required
            />
          </div>

          <button
            type="submit"
            disabled={carregando || !email || !senha}
            className="w-full min-h-[52px] mt-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-black text-base rounded-2xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {carregando ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Acessando painel...
              </>
            ) : (
              "Entrar no Painel"
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-700 text-center">
          <p className="text-xs text-slate-400">
            Acesso demo: <span className="font-mono text-indigo-300">professor@demo.com</span>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-md mx-auto text-center text-slate-500 text-xs py-2">
        SpeakUp A1 • Plataforma Docente
      </footer>
    </div>
  );
}

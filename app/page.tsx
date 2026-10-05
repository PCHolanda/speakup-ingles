import Link from "next/link";
import { Sparkles, GraduationCap, Mic, Volume2, ShieldCheck, ArrowRight, Award } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-sky-50 flex flex-col justify-between">
      {/* Top Navigation */}
      <header className="w-full max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
            <Mic className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-blue-950 flex items-center gap-2">
              SpeakUp <span className="bg-blue-600 text-white text-xs px-2.5 py-1 rounded-full font-bold">A1</span>
            </h1>
            <p className="text-xs font-semibold text-slate-500">Avaliação Oral Inteligente de Inglês</p>
          </div>
        </div>

        <Link
          href="/professor/login"
          className="text-sm font-bold text-blue-700 hover:text-blue-800 bg-blue-100/60 hover:bg-blue-100 px-4 py-2 rounded-xl transition-all"
        >
          Acesso Professor
        </Link>
      </header>

      {/* Hero Section */}
      <section className="w-full max-w-5xl mx-auto px-4 py-10 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 text-sm font-bold px-4 py-1.5 rounded-full mb-6">
          <Sparkles className="w-4 h-4 text-blue-600" />
          Inteligência Artificial pedagógica para nível iniciante
        </div>

        <h2 className="text-4xl md:text-6xl font-black text-slate-900 leading-tight tracking-tight max-w-3xl mb-6">
          Fale inglês com confiança e receba feedback em segundos!
        </h2>

        <p className="text-lg md:text-xl text-slate-600 max-w-2xl mb-10 font-medium">
          Avaliação de pronúncia, vocabulário, fluência e frases completas feita sob medida para crianças e jovens em aprendizagem.
        </p>

        {/* Action Choice Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
          {/* Aluno Card */}
          <Link
            href="/aluno/login"
            className="group relative bg-white border-2 border-blue-200 hover:border-blue-600 rounded-3xl p-8 text-left shadow-xl shadow-blue-500/5 hover:shadow-blue-500/20 transition-all duration-300 transform hover:-translate-y-1"
          >
            <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center mb-6 shadow-md shadow-blue-600/30 group-hover:scale-110 transition-transform">
              <Mic className="w-8 h-8" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
              Espaço do Aluno
            </span>
            <h3 className="text-2xl font-black text-slate-900 mt-3 mb-2 flex items-center justify-between">
              Começar Avaliação
              <ArrowRight className="w-6 h-6 text-blue-600 group-hover:translate-x-1 transition-transform" />
            </h3>
            <p className="text-slate-600 text-sm font-medium">
              Entre com o código da sua turma e seu PIN de 6 dígitos para praticar sua pronúncia.
            </p>
          </Link>

          {/* Professor Card */}
          <Link
            href="/professor/login"
            className="group relative bg-white border-2 border-slate-200 hover:border-indigo-600 rounded-3xl p-8 text-left shadow-xl shadow-slate-500/5 hover:shadow-indigo-500/20 transition-all duration-300 transform hover:-translate-y-1"
          >
            <div className="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center mb-6 shadow-md shadow-indigo-600/30 group-hover:scale-110 transition-transform">
              <GraduationCap className="w-8 h-8" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
              Espaço do Professor
            </span>
            <h3 className="text-2xl font-black text-slate-900 mt-3 mb-2 flex items-center justify-between">
              Painel Docente
              <ArrowRight className="w-6 h-6 text-indigo-600 group-hover:translate-x-1 transition-transform" />
            </h3>
            <p className="text-slate-600 text-sm font-medium">
              Crie turmas, acompanhe o mapa de calor de erros fonológicos e exporte notas para Excel.
            </p>
          </Link>
        </div>

        {/* Badges / Features */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 max-w-4xl w-full">
          <div className="bg-white/80 backdrop-blur rounded-2xl p-4 border border-slate-200/80 flex items-center gap-3">
            <Volume2 className="w-6 h-6 text-blue-600 shrink-0" />
            <span className="text-xs font-bold text-slate-700 text-left">Voz nativa e feedback fonético</span>
          </div>
          <div className="bg-white/80 backdrop-blur rounded-2xl p-4 border border-slate-200/80 flex items-center gap-3">
            <Award className="w-6 h-6 text-emerald-600 shrink-0" />
            <span className="text-xs font-bold text-slate-700 text-left">Rubrica A1 (1 a 4 estrelas)</span>
          </div>
          <div className="bg-white/80 backdrop-blur rounded-2xl p-4 border border-slate-200/80 flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-purple-600 shrink-0" />
            <span className="text-xs font-bold text-slate-700 text-left">LGPD e retenção segura</span>
          </div>
          <div className="bg-white/80 backdrop-blur rounded-2xl p-4 border border-slate-200/80 flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-amber-500 shrink-0" />
            <span className="text-xs font-bold text-slate-700 text-left">Dicas pedagógicas inteligentes</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200 py-6 text-center text-xs text-slate-500 font-medium">
        SpeakUp A1 — Plataforma Educacional de Avaliação Oral • Feito para o aprendizado de inglês no Brasil
      </footer>
    </main>
  );
}

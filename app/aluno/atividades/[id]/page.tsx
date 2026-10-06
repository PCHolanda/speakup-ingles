"use client";

import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Mic,
  Square,
  Play,
  RotateCcw,
  Volume2,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Trophy,
  Loader2,
  AlertCircle,
  Home,
} from "lucide-react";

interface Pergunta {
  id: string;
  secao: string;
  ordem: number;
  tipo: string;
  enunciado: string;
  instrucao_pt: string | null;
  dicas: string[] | null;
}

interface Atividade {
  id: string;
  titulo: string;
  nivel: string;
}

export default function AlunoAtividadePlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const atividadeId = resolvedParams.id;

  const [atividade, setAtividade] = useState<Atividade | null>(null);
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [indiceAtual, setIndiceAtual] = useState(0);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Estados de Áudio e Gravação
  const [falando, setFalando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [tempoGravacao, setTempoGravacao] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [mostrarDica, setMostrarDica] = useState(false);
  const [concluido, setConcluido] = useState(false);

  // Respostas gravadas
  const [respostasGravadas, setRespostasGravadas] = useState<Record<number, string>>({});

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Carregar dados da atividade
  useEffect(() => {
    async function carregar() {
      try {
        const res = await fetch(`/api/aluno/atividades/${atividadeId}`);
        if (res.status === 401) {
          router.push("/aluno/login");
          return;
        }

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro ao carregar atividade");

        setAtividade(data.atividade);
        setPerguntas(data.perguntas || []);
      } catch (err: unknown) {
        setErro(err instanceof Error ? err.message : "Erro de conexão");
      } finally {
        setCarregando(false);
      }
    }

    carregar();
  }, [atividadeId, router]);

  const perguntaAtual = perguntas[indiceAtual];

  // Falar o enunciado da pergunta (TTS)
  const falarPergunta = (texto: string) => {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = "en-US";
    utterance.rate = 0.9; // Levemente pausado para nível A1

    setFalando(true);
    utterance.onend = () => setFalando(false);
    utterance.onerror = () => setFalando(false);

    window.speechSynthesis.speak(utterance);
  };

  // Iniciar Gravação de Áudio
  const iniciarGravacao = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        setRespostasGravadas((prev) => ({ ...prev, [indiceAtual]: url }));

        // Parar faixas de microfone
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setGravando(true);
      setTempoGravacao(0);
      setAudioUrl(null);

      timerRef.current = setInterval(() => {
        setTempoGravacao((prev) => prev + 1);
      }, 1000);
    } catch {
      alert("Por favor, permita o acesso ao microfone no seu navegador para gravar a resposta.");
    }
  };

  // Parar Gravação
  const pararGravacao = () => {
    if (mediaRecorderRef.current && gravando) {
      mediaRecorderRef.current.stop();
      setGravando(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  // Avançar Pergunta
  const proximaPergunta = () => {
    if (indiceAtual < perguntas.length - 1) {
      setIndiceAtual((prev) => prev + 1);
      setAudioUrl(respostasGravadas[indiceAtual + 1] || null);
      setMostrarDica(false);
    } else {
      setConcluido(true);
    }
  };

  // Voltar Pergunta
  const perguntaAnterior = () => {
    if (indiceAtual > 0) {
      setIndiceAtual((prev) => prev - 1);
      setAudioUrl(respostasGravadas[indiceAtual - 1] || null);
      setMostrarDica(false);
    }
  };

  if (carregando) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
        <p className="text-sm font-semibold text-slate-400">Preparando sua avaliação oral...</p>
      </div>
    );
  }

  if (erro || !perguntaAtual) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">Ops! Algo deu errado</h2>
        <p className="text-sm text-slate-400 mb-6">{erro || "Pergunta não encontrada."}</p>
        <Link
          href="/aluno/atividades"
          className="bg-blue-600 hover:bg-blue-500 px-6 py-2.5 rounded-xl font-bold text-sm"
        >
          Voltar às Atividades
        </Link>
      </div>
    );
  }

  // TELA DE CONCLUSÃO
  if (concluido) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/10">
            <Trophy className="w-10 h-10 animate-bounce" />
          </div>

          <div className="inline-flex items-center gap-1.5 bg-emerald-500/15 text-emerald-400 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            Parabéns! Good Job!
          </div>

          <h1 className="text-2xl font-black text-white">Avaliação Concluída!</h1>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            Você respondeu às {perguntas.length} perguntas orais de nível A1. Suas respostas foram salvas para revisão do seu professor.
          </p>

          <div className="my-6 p-4 bg-slate-950 rounded-2xl border border-slate-800 text-left">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-2">
              <span>Perguntas respondidas:</span>
              <span className="text-emerald-400">{Object.keys(respostasGravadas).length} de {perguntas.length}</span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all"
                style={{ width: `${(Object.keys(respostasGravadas).length / perguntas.length) * 100}%` }}
              />
            </div>
          </div>

          <Link
            href="/aluno/atividades"
            className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            Voltar para Atividades
          </Link>
        </div>
      </div>
    );
  }

  const progresso = ((indiceAtual + 1) / perguntas.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col justify-between font-sans selection:bg-blue-600">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/aluno/atividades"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Sair
          </Link>

          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-slate-300">
              Pergunta {indiceAtual + 1} de {perguntas.length}
            </span>
            <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">
              {perguntaAtual.secao}
            </span>
          </div>

          <div className="text-xs font-mono font-black text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700">
            {Math.round(progresso)}%
          </div>
        </div>

        {/* Barra de Progresso */}
        <div className="w-full bg-slate-800 h-1">
          <div
            className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-300"
            style={{ width: `${progresso}%` }}
          />
        </div>
      </header>

      {/* Card da Pergunta */}
      <main className="max-w-2xl mx-auto px-4 py-8 w-full flex-1 flex flex-col justify-center">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
          {/* Seção */}
          <div className="flex items-center justify-between gap-2 mb-4">
            <span className="text-[11px] font-black uppercase tracking-wider bg-blue-500/15 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-full">
              {perguntaAtual.secao}
            </span>

            <button
              onClick={() => falarPergunta(perguntaAtual.enunciado)}
              disabled={falando}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
            >
              <Volume2 className={`w-4 h-4 ${falando ? "animate-pulse" : ""}`} />
              {falando ? "Falando..." : "Ouvir em Inglês"}
            </button>
          </div>

          {/* Enunciado da Pergunta */}
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
            "{perguntaAtual.enunciado}"
          </h2>

          {/* Instrução em Português */}
          {perguntaAtual.instrucao_pt && (
            <p className="text-sm font-medium text-slate-400 mb-6">
              💡 {perguntaAtual.instrucao_pt}
            </p>
          )}

          {/* Dica Pedagógica Expansível */}
          {perguntaAtual.dicas && perguntaAtual.dicas.length > 0 && (
            <div className="mb-6">
              <button
                onClick={() => setMostrarDica(!mostrarDica)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                {mostrarDica ? "Ocultar Dica" : "Precisa de ajuda? Ver Dica"}
              </button>

              {mostrarDica && (
                <div className="mt-2 p-3.5 bg-indigo-950/40 border border-indigo-800/60 rounded-xl text-xs text-indigo-200 animate-in fade-in">
                  {perguntaAtual.dicas[0]}
                </div>
              )}
            </div>
          )}

          {/* Área de Gravação do Microfone */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 text-center flex flex-col items-center justify-center my-4">
            {!gravando && !audioUrl && (
              <div>
                <button
                  onClick={iniciarGravacao}
                  className="w-20 h-20 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-xl shadow-rose-600/30 hover:scale-105 transition-all mx-auto cursor-pointer"
                  title="Clique para Gravar"
                >
                  <Mic className="w-9 h-9" />
                </button>
                <p className="text-xs font-bold text-slate-300 mt-3">
                  Clique no microfone para falar sua resposta
                </p>
              </div>
            )}

            {gravando && (
              <div className="flex flex-col items-center animate-in fade-in">
                <button
                  onClick={pararGravacao}
                  className="w-20 h-20 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-xl shadow-rose-600/50 animate-pulse cursor-pointer"
                  title="Clique para Parar"
                >
                  <Square className="w-7 h-7 fill-current" />
                </button>
                <p className="text-xs font-bold text-rose-400 mt-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  Gravando... ({tempoGravacao}s) — Fale agora!
                </p>
                <p className="text-[11px] text-slate-500 mt-1">Clique no quadrado para finalizar.</p>
              </div>
            )}

            {!gravando && audioUrl && (
              <div className="w-full flex flex-col items-center animate-in fade-in">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-emerald-400 mb-3">
                  Resposta Gravada com Sucesso!
                </p>
                <audio controls src={audioUrl} className="w-full max-w-sm mb-4 h-10" />
                <button
                  onClick={iniciarGravacao}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Gravar Novamente
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Botões de Navegação */}
        <div className="flex items-center justify-between gap-4 mt-6">
          <button
            onClick={perguntaAnterior}
            disabled={indiceAtual === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Anterior
          </button>

          <button
            onClick={proximaPergunta}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/30 transition-all cursor-pointer ml-auto"
          >
            {indiceAtual === perguntas.length - 1 ? "Concluir Avaliação" : "Próxima Pergunta"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full text-center text-xs text-slate-600 py-4 border-t border-slate-900">
        SpeakUp A1 — Avaliação Oral Interativa
      </footer>
    </div>
  );
}

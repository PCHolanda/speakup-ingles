"use client";

import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Mic,
  Square,
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
  ThumbsUp,
  Target,
} from "lucide-react";
import { GravadorWav } from "@/lib/audio/wav-recorder";
import type { ResultadoQualidade } from "@/lib/audio/qualidade";

interface Gravacao {
  url: string;
  wav: Blob;
  qualidade: ResultadoQualidade;
}

interface PalavraAnalise {
  palavra: string;
  status: "ok" | "atencao" | "erro";
  codigo_erro: string | null;
  dica: string | null;
}

interface Analise {
  transcricao: string;
  respondeu_pergunta: boolean;
  nota_pronuncia: number;
  nota_fluencia: number;
  nota_vocabulario: number;
  nota_estrutura: number;
  resultado: "good_job" | "try_again";
  ponto_forte: string;
  ponto_melhorar: string;
  palavras: PalavraAnalise[];
  frase_modelo: string;
}

const CRITERIOS: { chave: keyof Analise; rotulo: string }[] = [
  { chave: "nota_pronuncia", rotulo: "Pronúncia" },
  { chave: "nota_fluencia", rotulo: "Fluência" },
  { chave: "nota_vocabulario", rotulo: "Vocabulário" },
  { chave: "nota_estrutura", rotulo: "Estrutura" },
];

const COR_NOTA = ["", "bg-rose-500", "bg-amber-500", "bg-sky-500", "bg-emerald-500"];

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

  const [sessaoId, setSessaoId] = useState<string | null>(null);

  // Estados de Áudio e Gravação
  const [falando, setFalando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [tempoGravacao, setTempoGravacao] = useState(0);
  const [nivelMic, setNivelMic] = useState(0);
  const [mostrarDica, setMostrarDica] = useState(false);
  const [concluido, setConcluido] = useState(false);

  // Respostas gravadas e análises, por índice da pergunta
  const [respostasGravadas, setRespostasGravadas] = useState<Record<number, Gravacao>>({});
  const [analises, setAnalises] = useState<Record<number, Analise>>({});
  const [errosAnalise, setErrosAnalise] = useState<Record<number, string>>({});
  const [analisando, setAnalisando] = useState(false);
  const [avisoAnalise, setAvisoAnalise] = useState(false);

  const gravadorRef = useRef<GravadorWav | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const gravacaoAtual = respostasGravadas[indiceAtual];
  const audioUrl = gravacaoAtual?.url ?? null;
  const analiseAtual = analises[indiceAtual];
  const erroAnaliseAtual = errosAnalise[indiceAtual];

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
        setSessaoId(data.sessaoId || null);
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

  // Limpa o resultado da pergunta atual (nova gravação = nova análise)
  const limparAnalise = (indice: number) => {
    setAnalises(({ [indice]: _a, ...resto }) => resto);
    setErrosAnalise(({ [indice]: _e, ...resto }) => resto);
    setAvisoAnalise(false);
  };

  // Iniciar Gravação de Áudio (WAV 16 kHz, formato aceito pela IA)
  const iniciarGravacao = async () => {
    if (!GravadorWav.suportado()) {
      alert("Seu navegador não permite gravar áudio. Tente pelo Chrome.");
      return;
    }
    try {
      const gravador = new GravadorWav();
      gravadorRef.current = gravador;
      await gravador.iniciar((n) => setNivelMic(Math.min(1, n.rms * 8)));

      limparAnalise(indiceAtual);
      setRespostasGravadas(({ [indiceAtual]: antiga, ...resto }) => {
        if (antiga) URL.revokeObjectURL(antiga.url);
        return resto;
      });
      setGravando(true);
      setTempoGravacao(0);

      timerRef.current = setInterval(() => {
        setTempoGravacao((prev) => prev + 1);
      }, 1000);
    } catch {
      gravadorRef.current = null;
      alert("Por favor, permita o acesso ao microfone no seu navegador para gravar a resposta.");
    }
  };

  // Parar Gravação
  const pararGravacao = async () => {
    const gravador = gravadorRef.current;
    if (!gravador || !gravando) return;

    setGravando(false);
    setNivelMic(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const indice = indiceAtual;
    const final = await gravador.parar();
    gravadorRef.current = null;
    setRespostasGravadas((prev) => ({
      ...prev,
      [indice]: { url: URL.createObjectURL(final.wav), wav: final.wav, qualidade: final.qualidade },
    }));
  };

  // Enviar para análise de pronúncia
  const analisarPronuncia = async () => {
    const indice = indiceAtual;
    const gravacao = respostasGravadas[indice];
    if (!gravacao || analisando) return;

    if (!sessaoId) {
      setErrosAnalise((p) => ({ ...p, [indice]: "Sua matrícula na turma não foi encontrada. Avise seu professor." }));
      return;
    }

    const perguntaId = perguntas[indice]?.id;
    if (!perguntaId) {
      setErrosAnalise((p) => ({ ...p, [indice]: "Identificador da pergunta não encontrado." }));
      return;
    }

    if (!gravacao.wav || gravacao.wav.size === 0) {
      setErrosAnalise((p) => ({ ...p, [indice]: "O áudio gravado está vazio. Por favor, grave novamente." }));
      return;
    }

    setAnalisando(true);
    setAvisoAnalise(false);
    setErrosAnalise(({ [indice]: _e, ...resto }) => resto);

    try {
      const form = new FormData();
      form.append("audio", gravacao.wav, "resposta.wav");
      form.append("sessao_id", sessaoId);
      form.append("pergunta_id", perguntaId);

      const res = await fetch("/api/aluno/respostas/analisar", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Erro ${res.status}: Não foi possível analisar.`);
      }

      setAnalises((p) => ({ ...p, [indice]: data.analise }));
    } catch (err: unknown) {
      setErrosAnalise((p) => ({
        ...p,
        [indice]: err instanceof Error ? err.message : "Erro de conexão.",
      }));
    } finally {
      setAnalisando(false);
    }
  };

  // Toda resposta gravada precisa ser analisada antes de seguir
  // (exceto se a análise falhar, para o aluno não ficar travado)
  const precisaAnalisar = !!audioUrl && !analiseAtual && !erroAnaliseAtual;

  const mudarPergunta = (novoIndice: number) => {
    setIndiceAtual(novoIndice);
    setMostrarDica(false);
    setAvisoAnalise(false);
  };

  // Avançar Pergunta
  const proximaPergunta = () => {
    if (gravando) return;
    if (precisaAnalisar) {
      setAvisoAnalise(true);
      return;
    }
    if (indiceAtual < perguntas.length - 1) {
      mudarPergunta(indiceAtual + 1);
    } else {
      setConcluido(true);
    }
  };

  // Voltar Pergunta
  const perguntaAnterior = () => {
    if (indiceAtual > 0 && !gravando) {
      mudarPergunta(indiceAtual - 1);
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
            &ldquo;{perguntaAtual.enunciado}&rdquo;
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
                {/* Medidor de volume do microfone */}
                <div className="w-40 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-rose-500 transition-[width] duration-75"
                    style={{ width: `${Math.round(nivelMic * 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Clique no quadrado para finalizar.</p>
              </div>
            )}

            {!gravando && gravacaoAtual && (
              <div className="w-full flex flex-col items-center animate-in fade-in">
                {gravacaoAtual.qualidade.ok ? (
                  <>
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-bold text-emerald-400 mb-3">Resposta Gravada com Sucesso!</p>
                  </>
                ) : (
                  <div className="w-full max-w-sm mb-3 p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-semibold flex items-start gap-2 text-left">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{gravacaoAtual.qualidade.mensagem} Grave novamente.</span>
                  </div>
                )}
                <audio controls src={gravacaoAtual.url} className="w-full max-w-sm mb-4 h-10" />

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    id="btn-gravar-novamente"
                    onClick={iniciarGravacao}
                    disabled={analisando}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Gravar Novamente
                  </button>

                  <button
                    id="btn-analisar-pronuncia"
                    onClick={analisarPronuncia}
                    disabled={analisando || !gravacaoAtual.qualidade.ok}
                    className={`inline-flex items-center gap-1.5 text-xs font-bold text-white px-4 py-2 rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 shadow-lg shadow-violet-600/30 ${
                      avisoAnalise ? "ring-2 ring-amber-400 animate-pulse" : ""
                    }`}
                  >
                    {analisando ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Analisando...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        {analiseAtual ? "Analisar de Novo" : "Analisar Pronúncia"}
                      </>
                    )}
                  </button>
                </div>

                {avisoAnalise && (
                  <p className="text-[11px] font-bold text-amber-400 mt-3">
                    Antes de continuar, clique em &quot;Analisar Pronúncia&quot;.
                  </p>
                )}

                {erroAnaliseAtual && (
                  <div className="w-full max-w-sm mt-3 p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs font-semibold flex items-start gap-2 text-left">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{erroAnaliseAtual}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Resultado da Análise de Pronúncia */}
          {!gravando && analiseAtual && (
            <section
              id="resultado-pronuncia"
              className="mt-2 bg-slate-950/80 border border-slate-800 rounded-2xl p-5 animate-in fade-in slide-in-from-bottom-2"
            >
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="text-sm font-black text-white">Análise da Pronúncia</h3>
                {analiseAtual.resultado === "good_job" ? (
                  <span className="inline-flex items-center gap-1.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider">
                    <Trophy className="w-3.5 h-3.5" />
                    Good Job!
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 bg-amber-500/15 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider">
                    <RotateCcw className="w-3.5 h-3.5" />
                    Try Again!
                  </span>
                )}
              </div>

              {/* O que foi entendido, com palavras coloridas */}
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">O que entendemos</p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {analiseAtual.palavras.length > 0 ? (
                  analiseAtual.palavras.map((p, i) => (
                    <span
                      key={`${p.palavra}-${i}`}
                      title={p.dica ?? undefined}
                      className={`px-2 py-1 rounded-lg text-sm font-bold border ${
                        p.status === "ok"
                          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                          : p.status === "atencao"
                            ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                            : "bg-rose-500/10 text-rose-300 border-rose-500/30 underline decoration-wavy decoration-rose-400"
                      }`}
                    >
                      {p.palavra}
                    </span>
                  ))
                ) : (
                  <span className="text-sm italic text-slate-500">{analiseAtual.transcricao || "(nada compreendido)"}</span>
                )}
              </div>

              {/* Notas 1–4 */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-4">
                {CRITERIOS.map(({ chave, rotulo }) => {
                  const valor = analiseAtual[chave] as number;
                  return (
                    <div key={chave}>
                      <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                        <span className="text-slate-400">{rotulo}</span>
                        <span className="text-slate-200">{valor}/4</span>
                      </div>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((n) => (
                          <div
                            key={n}
                            className={`h-1.5 flex-1 rounded-full ${n <= valor ? COR_NOTA[valor] : "bg-slate-800"}`}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Feedback */}
              <div className="space-y-2 mb-4">
                <div className="p-3 bg-emerald-950/40 border border-emerald-900/60 rounded-xl text-xs text-emerald-200 flex items-start gap-2">
                  <ThumbsUp className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{analiseAtual.ponto_forte}</span>
                </div>
                <div className="p-3 bg-amber-950/30 border border-amber-900/60 rounded-xl text-xs text-amber-200 flex items-start gap-2">
                  <Target className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>{analiseAtual.ponto_melhorar}</span>
                </div>
              </div>

              {/* Dicas por palavra */}
              {analiseAtual.palavras.some((p) => p.status !== "ok" && p.dica) && (
                <div className="mb-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Dicas de pronúncia</p>
                  <ul className="space-y-1.5">
                    {analiseAtual.palavras
                      .filter((p) => p.status !== "ok" && p.dica)
                      .map((p, i) => (
                        <li key={`dica-${p.palavra}-${i}`} className="text-xs text-slate-300 flex items-start gap-2">
                          <button
                            onClick={() => falarPergunta(p.palavra)}
                            title={`Ouvir "${p.palavra}"`}
                            className="shrink-0 inline-flex items-center gap-1 font-black text-violet-300 bg-violet-500/10 border border-violet-500/30 px-1.5 py-0.5 rounded-md hover:bg-violet-500/20 cursor-pointer"
                          >
                            <Volume2 className="w-3 h-3" />
                            {p.palavra}
                          </button>
                          <span className="pt-0.5">{p.dica}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              {/* Frase modelo */}
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Exemplo de resposta</p>
                  <p className="text-sm font-bold text-white mt-0.5">&quot;{analiseAtual.frase_modelo}&quot;</p>
                </div>
                <button
                  onClick={() => falarPergunta(analiseAtual.frase_modelo)}
                  disabled={falando}
                  className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                >
                  <Volume2 className="w-4 h-4" />
                  Ouvir
                </button>
              </div>
            </section>
          )}
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

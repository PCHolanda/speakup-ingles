"use client";

import { useEffect, useRef, useState } from "react";
import {
  PlusCircle,
  Edit3,
  Trash2,
  Mic,
  Square,
  Volume2,
  Image as ImageIcon,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  X,
  ArrowUp,
  ArrowDown,
  FileText,
  Sparkles,
  Upload,
  RotateCcw,
} from "lucide-react";
import { GravadorWav } from "@/lib/audio/wav-recorder";

export interface PerguntaAdmin {
  id: string;
  atividade_id: string;
  secao: string;
  ordem: number;
  tipo: "oral" | "imagem" | "comparacao";
  tem_imagem: boolean;
  enunciado: string;
  instrucao_pt: string;
  imagem_path: string | null;
  imagem_url: string | null;
  respostas_esperadas: string[];
  texto_referencia: string;
  foco_avaliacao: string[];
  dicas: string[];
  tempo_gravacao_s: 5 | 10 | 20;
  audio_modelo_professor_path: string | null;
  audio_modelo_professor_url: string | null;
}

export interface AtividadeAdmin {
  id: string;
  professor_id: string | null;
  titulo: string;
  nivel: string;
  publicada: boolean;
  created_at: string;
  total_perguntas: number;
  perguntas: PerguntaAdmin[];
}

export default function GerenciadorAvaliacoes() {
  const [atividades, setAtividades] = useState<AtividadeAdmin[]>([]);
  const [atividadeSelecionadaId, setAtividadeSelecionadaId] = useState<string>("");
  const [carregando, setCarregando] = useState(true);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);

  // Estado de Nova / Editar Avaliação
  const [mostrarFormAtividade, setMostrarFormAtividade] = useState(false);
  const [editandoAtividadeId, setEditandoAtividadeId] = useState<string | null>(null);
  const [tituloAtividade, setTituloAtividade] = useState("");
  const [nivelAtividade, setNivelAtividade] = useState("A1");
  const [publicadaAtividade, setPublicadaAtividade] = useState(true);
  const [salvandoAtividade, setSalvandoAtividade] = useState(false);

  // Estado de Nova / Editar Questão
  const [mostrarFormPergunta, setMostrarFormPergunta] = useState(false);
  const [editandoPerguntaId, setEditandoPerguntaId] = useState<string | null>(null);
  const [secao, setSecao] = useState("Apresentação pessoal");
  const [ordem, setOrdem] = useState(1);
  const [temImagem, setTemImagem] = useState(false);
  const [tipoImagem, setTipoImagem] = useState<"imagem" | "comparacao">("imagem");
  const [enunciado, setEnunciado] = useState("");
  const [instrucaoPt, setInstrucaoPt] = useState("");
  const [respostasEsperadasTxt, setRespostasEsperadasTxt] = useState("");
  const [dicasTxt, setDicasTxt] = useState("");
  const [tempoGravacaoS, setTempoGravacaoS] = useState<5 | 10 | 20>(10);

  // Imagem da questão
  const [imagemPathAtual, setImagemPathAtual] = useState<string | null>(null);
  const [imagemPreviewUrl, setImagemPreviewUrl] = useState<string | null>(null);
  const [imagemFile, setImagemFile] = useState<File | null>(null);

  // Áudio da versão correta gravada pelo professor
  const [audioProfessorUrlAtual, setAudioProfessorUrlAtual] = useState<string | null>(null);
  const [audioProfessorBlob, setAudioProfessorBlob] = useState<Blob | null>(null);
  const [audioProfessorPreviewUrl, setAudioProfessorPreviewUrl] = useState<string | null>(null);
  const [removerAudioProfessor, setRemoverAudioProfessor] = useState(false);
  const [gravandoAudioProf, setGravandoAudioProf] = useState(false);
  const [tempoGravandoProf, setTempoGravandoProf] = useState(0);
  const [nivelMicProf, setNivelMicProf] = useState(0);
  const [salvandoPergunta, setSalvandoPergunta] = useState(false);

  const gravadorProfRef = useRef<GravadorWav | null>(null);
  const timerProfRef = useRef<NodeJS.Timeout | null>(null);

  const carregarAtividades = async (manterSelecaoId?: string) => {
    setCarregando(true);
    setMensagemErro(null);
    try {
      const res = await fetch("/api/admin/atividades");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao carregar avaliações");

      const lista: AtividadeAdmin[] = data.atividades || [];
      setAtividades(lista);

      const alvoId = manterSelecaoId || atividadeSelecionadaId;
      if (alvoId && lista.some((a) => a.id === alvoId)) {
        setAtividadeSelecionadaId(alvoId);
      } else if (lista.length > 0) {
        setAtividadeSelecionadaId(lista[0].id);
      } else {
        setAtividadeSelecionadaId("");
      }
    } catch (err: any) {
      setMensagemErro(err?.message || "Erro ao carregar avaliações.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarAtividades();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const atividadeAtual = atividades.find((a) => a.id === atividadeSelecionadaId) || null;

  // Abrir formulário de Nova Avaliação
  const abrirNovaAtividade = () => {
    setEditandoAtividadeId(null);
    setTituloAtividade("");
    setNivelAtividade("A1");
    setPublicadaAtividade(true);
    setMostrarFormAtividade(true);
  };

  // Abrir formulário para Editar Avaliação atual
  const abrirEditarAtividade = (ativ: AtividadeAdmin) => {
    setEditandoAtividadeId(ativ.id);
    setTituloAtividade(ativ.titulo);
    setNivelAtividade(ativ.nivel || "A1");
    setPublicadaAtividade(ativ.publicada);
    setMostrarFormAtividade(true);
  };

  const salvarAtividade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tituloAtividade.trim()) return;
    setSalvandoAtividade(true);
    setMensagemErro(null);
    setMensagemSucesso(null);

    try {
      const metodo = editandoAtividadeId ? "PATCH" : "POST";
      const res = await fetch("/api/admin/atividades", {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editandoAtividadeId || undefined,
          titulo: tituloAtividade.trim(),
          nivel: nivelAtividade.trim() || "A1",
          publicada: publicadaAtividade,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar avaliação");

      const novoId = data.atividade?.id || editandoAtividadeId;
      setMostrarFormAtividade(false);
      setMensagemSucesso(
        editandoAtividadeId ? "Avaliação atualizada com sucesso!" : "Nova avaliação criada com sucesso!"
      );
      await carregarAtividades(novoId);
    } catch (err: any) {
      setMensagemErro(err?.message || "Erro ao salvar avaliação.");
    } finally {
      setSalvandoAtividade(false);
    }
  };

  const alternarPublicacaoAtividade = async (ativ: AtividadeAdmin) => {
    try {
      const res = await fetch("/api/admin/atividades", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ativ.id, publicada: !ativ.publicada }),
      });
      if (!res.ok) throw new Error("Falha ao atualizar status da avaliação");
      await carregarAtividades(ativ.id);
    } catch (err: any) {
      setMensagemErro(err?.message || "Erro ao alterar publicação.");
    }
  };

  const excluirAtividade = async (ativ: AtividadeAdmin) => {
    if (!confirm(`Tem certeza que deseja excluir a avaliação "${ativ.titulo}" e todas as suas questões?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/atividades?id=${ativ.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao excluir avaliação");
      setMensagemSucesso("Avaliação excluída com sucesso.");
      await carregarAtividades();
    } catch (err: any) {
      setMensagemErro(err?.message || "Erro ao excluir avaliação.");
    }
  };

  // =========================================================================
  // FORMULÁRIO DE QUESTÃO (NOVA / EDITAR)
  // =========================================================================
  const limparGravacaoProf = () => {
    if (gravadorProfRef.current) {
      gravadorProfRef.current.cancelar().catch(() => {});
      gravadorProfRef.current = null;
    }
    if (timerProfRef.current) {
      clearInterval(timerProfRef.current);
      timerProfRef.current = null;
    }
    setGravandoAudioProf(false);
    setTempoGravandoProf(0);
    setNivelMicProf(0);
  };

  const abrirNovaPergunta = () => {
    if (!atividadeAtual) return;
    limparGravacaoProf();
    setEditandoPerguntaId(null);
    setSecao("Apresentação pessoal");
    setOrdem((atividadeAtual.perguntas?.length || 0) + 1);
    setTemImagem(false);
    setTipoImagem("imagem");
    setEnunciado("");
    setInstrucaoPt('Responda em inglês com uma frase completa (ex.: "...").');
    setRespostasEsperadasTxt("");
    setDicasTxt("Responda com frase completa. You can say: ...");
    setTempoGravacaoS(10);
    setImagemPathAtual(null);
    setImagemPreviewUrl(null);
    setImagemFile(null);
    setAudioProfessorUrlAtual(null);
    setAudioProfessorBlob(null);
    setAudioProfessorPreviewUrl(null);
    setRemoverAudioProfessor(false);
    setMostrarFormPergunta(true);
  };

  const abrirEditarPergunta = (p: PerguntaAdmin) => {
    limparGravacaoProf();
    setEditandoPerguntaId(p.id);
    setSecao(p.secao || "Geral");
    setOrdem(p.ordem || 1);
    setTemImagem(p.tem_imagem);
    setTipoImagem(p.tipo === "comparacao" ? "comparacao" : "imagem");
    setEnunciado(p.enunciado || "");
    setInstrucaoPt(p.instrucao_pt || "");
    setRespostasEsperadasTxt((p.respostas_esperadas || []).join("\n"));
    setDicasTxt((p.dicas || []).join("\n"));
    setTempoGravacaoS(p.tempo_gravacao_s || 10);
    setImagemPathAtual(p.imagem_path || null);
    setImagemPreviewUrl(p.imagem_url || null);
    setImagemFile(null);
    setAudioProfessorUrlAtual(p.audio_modelo_professor_url || null);
    setAudioProfessorBlob(null);
    setAudioProfessorPreviewUrl(null);
    setRemoverAudioProfessor(false);
    setMostrarFormPergunta(true);
  };

  const iniciarGravacaoProfessor = async () => {
    if (!GravadorWav.suportado()) {
      alert("Seu navegador não suporta gravação de áudio.");
      return;
    }
    try {
      const gravador = new GravadorWav();
      gravadorProfRef.current = gravador;
      await gravador.iniciar((n) => setNivelMicProf(Math.min(1, n.rms * 8)));
      setGravandoAudioProf(true);
      setTempoGravandoProf(0);
      timerProfRef.current = setInterval(() => {
        setTempoGravandoProf((t) => t + 1);
      }, 1000);
    } catch {
      gravadorProfRef.current = null;
      alert("Permita o uso do microfone no navegador para gravar a versão correta.");
    }
  };

  const pararGravacaoProfessor = async () => {
    const gravador = gravadorProfRef.current;
    if (!gravador || !gravandoAudioProf) return;
    setGravandoAudioProf(false);
    setNivelMicProf(0);
    if (timerProfRef.current) {
      clearInterval(timerProfRef.current);
      timerProfRef.current = null;
    }
    const final = await gravador.parar(30);
    gravadorProfRef.current = null;
    if (audioProfessorPreviewUrl) {
      URL.revokeObjectURL(audioProfessorPreviewUrl);
    }
    setAudioProfessorBlob(final.wav);
    setAudioProfessorPreviewUrl(URL.createObjectURL(final.wav));
    setRemoverAudioProfessor(false);
  };

  const salvarPergunta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!atividadeAtual || !enunciado.trim()) return;
    setSalvandoPergunta(true);
    setMensagemErro(null);
    setMensagemSucesso(null);

    try {
      const form = new FormData();
      if (editandoPerguntaId) {
        form.append("id", editandoPerguntaId);
      }
      form.append("atividade_id", atividadeAtual.id);
      form.append("secao", secao.trim() || "Geral");
      form.append("ordem", String(ordem || 1));
      form.append("tem_imagem", String(temImagem));
      form.append("tipo", temImagem ? tipoImagem : "oral");
      form.append("enunciado", enunciado.trim());
      form.append("instrucao_pt", instrucaoPt.trim());
      form.append("tempo_gravacao_s", String(tempoGravacaoS));

      const respArray = respostasEsperadasTxt
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      form.append("respostas_esperadas", JSON.stringify(respArray));

      const dicasArray = dicasTxt
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      form.append("dicas", JSON.stringify(dicasArray));

      if (temImagem) {
        if (imagemFile) {
          form.append("imagem_file", imagemFile);
        } else if (imagemPathAtual) {
          form.append("imagem_path", imagemPathAtual);
        }
      } else {
        form.append("imagem_path", "");
      }

      if (removerAudioProfessor) {
        form.append("remover_audio_professor", "true");
      }
      if (audioProfessorBlob) {
        form.append("audio_professor_file", audioProfessorBlob, "modelo-professor.wav");
      }

      const metodo = editandoPerguntaId ? "PATCH" : "POST";
      const res = await fetch("/api/admin/perguntas", {
        method: metodo,
        body: form,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar questão");

      setMostrarFormPergunta(false);
      setMensagemSucesso(
        editandoPerguntaId ? "Questão atualizada com sucesso!" : "Nova questão adicionada à avaliação!"
      );
      await carregarAtividades(atividadeAtual.id);
    } catch (err: any) {
      setMensagemErro(err?.message || "Erro ao salvar questão.");
    } finally {
      setSalvandoPergunta(false);
    }
  };

  const excluirPergunta = async (p: PerguntaAdmin) => {
    if (!confirm(`Deseja realmente excluir a questão "${p.enunciado}"?`)) return;
    try {
      const res = await fetch(`/api/admin/perguntas?id=${p.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao excluir questão");
      setMensagemSucesso("Questão excluída com sucesso.");
      await carregarAtividades(p.atividade_id);
    } catch (err: any) {
      setMensagemErro(err?.message || "Erro ao excluir questão.");
    }
  };

  const moverOrdemPergunta = async (p: PerguntaAdmin, direcao: "subir" | "descer") => {
    if (!atividadeAtual) return;
    const lista = [...atividadeAtual.perguntas].sort((a, b) => a.ordem - b.ordem);
    const idx = lista.findIndex((item) => item.id === p.id);
    if (idx === -1) return;
    const alvoIdx = direcao === "subir" ? idx - 1 : idx + 1;
    if (alvoIdx < 0 || alvoIdx >= lista.length) return;

    const outra = lista[alvoIdx];
    try {
      await Promise.all([
        fetch("/api/admin/perguntas", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: p.id, ordem: outra.ordem }),
        }),
        fetch("/api/admin/perguntas", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: outra.id, ordem: p.ordem }),
        }),
      ]);
      await carregarAtividades(atividadeAtual.id);
    } catch {
      setMensagemErro("Não foi possível reordenar a questão.");
    }
  };

  if (carregando) {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-12 flex flex-col items-center justify-center text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
        <p className="text-sm font-semibold">Carregando avaliações e questões...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {mensagemSucesso && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{mensagemSucesso}</span>
          </div>
          <button onClick={() => setMensagemSucesso(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {mensagemErro && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{mensagemErro}</span>
          </div>
          <button onClick={() => setMensagemErro(null)} className="text-rose-600 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Cabeçalho e Seletor de Avaliações */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <FileText className="w-6 h-6 text-indigo-600" />
              Avaliações Cadastradas & Banco de Questões
            </h2>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              Cadastre avaliações, edite perguntas, escolha com ou sem imagem, regule o tempo máximo de gravação (5s, 10s, 20s) e grave sua voz com a resposta correta.
            </p>
          </div>

          <button
            type="button"
            onClick={abrirNovaAtividade}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            Nova Avaliação
          </button>
        </div>

        {/* Lista de Cards das Avaliações */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {atividades.map((ativ) => {
            const selecionada = ativ.id === atividadeSelecionadaId;
            return (
              <div
                key={ativ.id}
                onClick={() => setAtividadeSelecionadaId(ativ.id)}
                className={`rounded-2xl p-4 border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  selecionada
                    ? "border-indigo-600 bg-indigo-50/40 shadow-md"
                    : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full">
                      Nível {ativ.nivel || "A1"}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        alternarPublicacaoAtividade(ativ);
                      }}
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border transition-all cursor-pointer ${
                        ativ.publicada
                          ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                          : "bg-amber-100 text-amber-700 border-amber-300"
                      }`}
                    >
                      {ativ.publicada ? "Publicada" : "Rascunho"}
                    </button>
                  </div>

                  <h3 className="text-base font-black text-slate-900">{ativ.titulo}</h3>
                  <p className="text-xs font-semibold text-slate-500 mt-1">
                    {ativ.total_perguntas} questão(ões) cadastrada(s)
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-200/80">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      abrirEditarAtividade(ativ);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-indigo-600 px-2.5 py-1 rounded-lg hover:bg-white transition-all cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Editar Título/Nível
                  </button>
                  {ativ.id !== "a0000000-0000-0000-0000-000000000001" && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        excluirAtividade(ativ);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 px-2.5 py-1 rounded-lg hover:bg-rose-50 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Excluir
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal / Box de Criar ou Editar Avaliação */}
        {mostrarFormAtividade && (
          <form
            onSubmit={salvarAtividade}
            className="mt-6 p-5 bg-slate-50 border border-indigo-200 rounded-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-indigo-900">
                {editandoAtividadeId ? "Editar Avaliação" : "Cadastrar Nova Avaliação"}
              </h3>
              <button
                type="button"
                onClick={() => setMostrarFormAtividade(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Título da Avaliação *
                </label>
                <input
                  type="text"
                  value={tituloAtividade}
                  onChange={(e) => setTituloAtividade(e.target.value)}
                  placeholder="Ex.: Avaliação Oral – Unidade 2 (Rotina e Escola)"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nível</label>
                <select
                  value={nivelAtividade}
                  onChange={(e) => setNivelAtividade(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900"
                >
                  <option value="A1">A1 (Iniciante)</option>
                  <option value="A2">A2 (Básico)</option>
                  <option value="B1">B1 (Intermediário)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={publicadaAtividade}
                  onChange={(e) => setPublicadaAtividade(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600"
                />
                Disponibilizar imediatamente para os alunos (Publicada)
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMostrarFormAtividade(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoAtividade}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {salvandoAtividade ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar Avaliação
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Questões da Avaliação Selecionada */}
      {atividadeAtual && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-indigo-600 block">
                Questões da Avaliação Selecionada
              </span>
              <h3 className="text-lg font-black text-slate-900">{atividadeAtual.titulo}</h3>
            </div>

            <button
              type="button"
              onClick={abrirNovaPergunta}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              Adicionar Nova Questão
            </button>
          </div>

          {/* Formulário de Criar / Editar Questão */}
          {mostrarFormPergunta && (
            <form
              onSubmit={salvarPergunta}
              className="p-6 bg-slate-50 border-2 border-indigo-200 rounded-3xl space-y-5 shadow-inner"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h4 className="text-base font-black text-indigo-950">
                    {editandoPerguntaId ? "Editar Questão" : "Nova Questão da Avaliação"}
                  </h4>
                  <p className="text-xs text-slate-500">
                    Defina o enunciado, escolha se a questão tem ou não imagem, regule o tempo máximo de gravação e grave sua versão correta.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    limparGravacaoProf();
                    setMostrarFormPergunta(false);
                  }}
                  className="text-slate-400 hover:text-slate-700 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Linha 1: Seção, Ordem e Enunciado */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Seção / Tema</label>
                  <input
                    type="text"
                    value={secao}
                    onChange={(e) => setSecao(e.target.value)}
                    placeholder="Ex.: Apresentação pessoal"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900"
                    required
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ordem (#)</label>
                  <input
                    type="number"
                    min={1}
                    value={ordem}
                    onChange={(e) => setOrdem(Number(e.target.value) || 1)}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Enunciado da Pergunta (em Inglês) *
                  </label>
                  <input
                    type="text"
                    value={enunciado}
                    onChange={(e) => setEnunciado(e.target.value)}
                    placeholder='Ex.: "What time do you wake up?"'
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900"
                    required
                  />
                </div>
              </div>

              {/* Linha 2: Dica de Contexto (Português) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Dica de Contexto para o Aluno (em Português — exigindo frase completa) *
                </label>
                <input
                  type="text"
                  value={instrucaoPt}
                  onChange={(e) => setInstrucaoPt(e.target.value)}
                  placeholder='Ex.: Responda em inglês com uma frase completa dizendo o horário em que você costuma acordar (ex.: "I wake up at...").'
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900"
                  required
                />
              </div>

              {/* Linha 3: Opção Com Imagem vs Sem Imagem + Tempo de Gravação (5s / 10s / 20s) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Seletor Com Imagem vs Sem Imagem */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                    1. Formato da Questão (Com ou Sem Imagem)
                  </label>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setTemImagem(false)}
                      className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                        !temImagem
                          ? "border-indigo-600 bg-indigo-50 text-indigo-950 font-black"
                          : "border-slate-200 hover:border-slate-300 text-slate-600 font-semibold"
                      }`}
                    >
                      <MessageSquare className="w-5 h-5 text-indigo-600 shrink-0" />
                      <div>
                        <span className="text-xs block">Sem Imagem</span>
                        <span className="text-[10px] text-slate-500 font-normal">Pergunta puramente oral</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTemImagem(true)}
                      className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                        temImagem
                          ? "border-indigo-600 bg-indigo-50 text-indigo-950 font-black"
                          : "border-slate-200 hover:border-slate-300 text-slate-600 font-semibold"
                      }`}
                    >
                      <ImageIcon className="w-5 h-5 text-indigo-600 shrink-0" />
                      <div>
                        <span className="text-xs block">Com Imagem</span>
                        <span className="text-[10px] text-slate-500 font-normal">Exibe figura na questão</span>
                      </div>
                    </button>
                  </div>

                  {temImagem && (
                    <div className="pt-2 border-t border-slate-100 space-y-3">
                      <div className="flex items-center gap-3">
                        <label className="text-xs font-bold text-slate-600">Tipo de visual:</label>
                        <select
                          value={tipoImagem}
                          onChange={(e) => setTipoImagem(e.target.value as "imagem" | "comparacao")}
                          className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-800"
                        >
                          <option value="imagem">Imagem Única</option>
                          <option value="comparacao">Comparação (On the left / On the right)</option>
                        </select>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold cursor-pointer transition-all">
                          <Upload className="w-3.5 h-3.5" />
                          Enviar Nova Imagem
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              setImagemFile(file);
                              if (file) {
                                setImagemPreviewUrl(URL.createObjectURL(file));
                              }
                            }}
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => {
                            setImagemFile(null);
                            setImagemPathAtual("gato-caixa.png");
                            setImagemPreviewUrl("/seed/gato-caixa.png");
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                        >
                          Usar Gato na Caixa
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setImagemFile(null);
                            setImagemPathAtual("comparacao-dia-noite.png");
                            setImagemPreviewUrl("/seed/comparacao-dia-noite.png");
                            setTipoImagem("comparacao");
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                        >
                          Usar Comparação Dia/Noite
                        </button>
                      </div>

                      {imagemPreviewUrl && (
                        <div className="p-2 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imagemPreviewUrl}
                            alt="Preview da questão"
                            className="max-h-36 w-auto object-contain rounded-lg"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Seletor de Tempo Máximo de Gravação (5s, 10s, 20s) */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                    2. Tempo Máximo de Gravação da Resposta
                  </label>

                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { valor: 5 as const, titulo: "Curta (5s)", desc: "Frase curta rápida" },
                      { valor: 10 as const, titulo: "Média (10s)", desc: "Frase completa padrão" },
                      { valor: 20 as const, titulo: "Longa (20s)", desc: " Comparação / 2+ frases" },
                    ].map((op) => (
                      <button
                        key={op.valor}
                        type="button"
                        onClick={() => setTempoGravacaoS(op.valor)}
                        className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                          tempoGravacaoS === op.valor
                            ? "border-indigo-600 bg-indigo-50 text-indigo-950 font-black shadow-sm"
                            : "border-slate-200 hover:border-slate-300 text-slate-600 font-semibold"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs">
                          <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>{op.titulo}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-normal block mt-1">
                          {op.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Linha 4: Frases Modelo Esperadas e Dicas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Exemplos de Resposta Correta (1 frase completa por linha) *
                  </label>
                  <textarea
                    rows={3}
                    value={respostasEsperadasTxt}
                    onChange={(e) => setRespostasEsperadasTxt(e.target.value)}
                    placeholder={"I wake up at seven o'clock.\nI wake up at six o'clock."}
                    className="w-full p-3 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Dica de Estrutura para o Aluno (1 por linha)
                  </label>
                  <textarea
                    rows={3}
                    value={dicasTxt}
                    onChange={(e) => setDicasTxt(e.target.value)}
                    placeholder={"Responda com frase completa. You can say: I wake up at…"}
                    className="w-full p-3 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900"
                  />
                </div>
              </div>

              {/* Linha 5: Gravação da Versão Correta pelo Professor */}
              <div className="bg-indigo-950 text-white p-5 rounded-2xl border border-indigo-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-indigo-300 block">
                      3. Versão Correta Gravada pelo Professor (Opcional, mas recomendado)
                    </span>
                    <p className="text-xs text-indigo-200 mt-0.5">
                      Grave com sua própria voz um exemplo de resposta correta para o aluno ouvir após responder.
                    </p>
                  </div>

                  {!gravandoAudioProf ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={iniciarGravacaoProfessor}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-md cursor-pointer transition-all"
                      >
                        <Mic className="w-4 h-4" />
                        Gravar Minha Voz (Professor)
                      </button>

                      <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-900 hover:bg-indigo-800 text-indigo-200 border border-indigo-700 text-xs font-bold cursor-pointer transition-all">
                        <Upload className="w-3.5 h-3.5" />
                        Enviar Áudio (.wav)
                        <input
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              setAudioProfessorBlob(f);
                              setAudioProfessorPreviewUrl(URL.createObjectURL(f));
                              setRemoverAudioProfessor(false);
                            }
                          }}
                        />
                      </label>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={pararGravacaoProfessor}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-black animate-pulse cursor-pointer"
                    >
                      <Square className="w-4 h-4 fill-current" />
                      Parar Gravação ({tempoGravandoProf}s)
                    </button>
                  )}
                </div>

                {gravandoAudioProf && (
                  <div className="w-full max-w-xs bg-indigo-900 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 transition-all duration-75"
                      style={{ width: `${Math.round(nivelMicProf * 100)}%` }}
                    />
                  </div>
                )}

                {(audioProfessorPreviewUrl || (audioProfessorUrlAtual && !removerAudioProfessor)) && (
                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-indigo-900">
                    <span className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      {audioProfessorPreviewUrl ? "Nova gravação pronta:" : "Áudio atual do professor:"}
                    </span>
                    <audio
                      controls
                      src={audioProfessorPreviewUrl || audioProfessorUrlAtual || undefined}
                      className="h-9 max-w-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setAudioProfessorBlob(null);
                        setAudioProfessorPreviewUrl(null);
                        setRemoverAudioProfessor(true);
                      }}
                      className="text-xs font-bold text-rose-300 hover:text-rose-200 underline cursor-pointer"
                    >
                      Remover áudio do professor
                    </button>
                  </div>
                )}
              </div>

              {/* Botões Salvar / Cancelar Questão */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    limparGravacaoProf();
                    setMostrarFormPergunta(false);
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoPergunta}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {salvandoPergunta ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editandoPerguntaId ? "Salvar Alterações da Questão" : "Cadastrar Questão"}
                </button>
              </div>
            </form>
          )}

          {/* Lista das Questões da Avaliação */}
          <div className="space-y-3">
            {atividadeAtual.perguntas.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-slate-500 text-sm">
                Nenhuma questão cadastrada nesta avaliação ainda. Clique em <strong>Adicionar Nova Questão</strong>.
              </div>
            ) : (
              atividadeAtual.perguntas.map((p, idx) => (
                <div
                  key={p.id}
                  className="p-4 rounded-2xl border border-slate-200 hover:border-slate-300 bg-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all"
                >
                  <div className="flex items-start gap-3.5 flex-1">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                      #{p.ordem || idx + 1}
                    </div>

                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                          {p.secao}
                        </span>

                        {p.tem_imagem ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-sky-100 text-sky-800 px-2 py-0.5 rounded-md">
                            <ImageIcon className="w-3 h-3" />
                            Com Imagem ({p.tipo === "comparacao" ? "Comparação" : "Figura"})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                            <MessageSquare className="w-3 h-3" />
                            Sem Imagem
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md">
                          <Clock className="w-3 h-3" />
                          Tempo: {p.tempo_gravacao_s === 5 ? "Curta (5s)" : p.tempo_gravacao_s === 20 ? "Longa (20s)" : "Média (10s)"}
                        </span>

                        {p.audio_modelo_professor_url && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                            <Volume2 className="w-3 h-3" />
                            Áudio do Professor Gravado
                          </span>
                        )}
                      </div>

                      <h4 className="text-base font-black text-slate-900">&ldquo;{p.enunciado}&rdquo;</h4>
                      <p className="text-xs text-slate-600 font-medium">💡 {p.instrucao_pt}</p>

                      {p.respostas_esperadas?.length > 0 && (
                        <p className="text-[11px] text-slate-500">
                          <strong>Modelo:</strong> {p.respostas_esperadas.join(" | ")}
                        </p>
                      )}

                      {p.audio_modelo_professor_url && (
                        <div className="pt-1">
                          <audio controls src={p.audio_modelo_professor_url} className="h-8 max-w-xs" />
                        </div>
                      )}
                    </div>

                    {p.tem_imagem && p.imagem_url && (
                      <div className="w-20 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-900 shrink-0 hidden sm:flex items-center justify-center p-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.imagem_url} alt={p.enunciado} className="max-h-full max-w-full object-contain" />
                      </div>
                    )}
                  </div>

                  {/* Ações da Questão */}
                  <div className="flex items-center gap-1.5 self-end md:self-center">
                    <button
                      type="button"
                      onClick={() => moverOrdemPergunta(p, "subir")}
                      disabled={idx === 0}
                      title="Subir ordem"
                      className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moverOrdemPergunta(p, "descer")}
                      disabled={idx === atividadeAtual.perguntas.length - 1}
                      title="Descer ordem"
                      className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirEditarPergunta(p)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition-all cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => excluirPergunta(p)}
                      className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs transition-all cursor-pointer"
                      title="Excluir questão"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

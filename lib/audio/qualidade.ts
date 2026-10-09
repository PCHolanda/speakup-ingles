/**
 * Controle de qualidade de áudio, antes de dar qualquer nota.
 * Função pura: roda no navegador (pré-envio) e no servidor (confirmação).
 */

export const LIMITES_QUALIDADE = {
  duracaoMinS: 0.4,
  duracaoMaxS: 15,
  /** RMS (0–1) do trecho de fala abaixo disso = nenhuma voz detectada (~ -36 dBFS) */
  rmsFalaMin: 0.016,
  /** Amostras com |x| >= este valor contam como saturadas */
  nivelClipping: 0.99,
  /** Fração máxima de amostras saturadas */
  fracaoClippingMax: 0.01,
  /** Relação sinal/ruído mínima em dB */
  snrMinDb: 10,
  frameMs: 20,
} as const;

export type MotivoQualidade =
  | "curto_demais"
  | "longo_demais"
  | "sem_fala"
  | "saturado"
  | "ruidoso";

export interface MetricasQualidade {
  duracaoS: number;
  rmsFala: number;
  rmsRuido: number;
  snrDb: number;
  fracaoClipping: number;
}

export interface ResultadoQualidade {
  ok: boolean;
  motivo?: MotivoQualidade;
  mensagem?: string;
  metricas: MetricasQualidade;
}

export const MENSAGENS_QUALIDADE: Record<MotivoQualidade, string> = {
  curto_demais: "Foi rapidinho demais! Segure o botão e fale a frase inteira.",
  longo_demais: "Ficou comprido demais. Fale só o texto do cartão.",
  sem_fala: "Não ouvimos sua voz. Chegue um pouco mais perto do microfone.",
  saturado: "Fale um pouco mais longe do microfone.",
  ruidoso: "Tem muito barulho aí. Tente num lugar mais silencioso.",
};

function percentil(valores: number[], p: number): number {
  if (valores.length === 0) return 0;
  const ord = [...valores].sort((a, b) => a - b);
  const idx = Math.min(ord.length - 1, Math.max(0, Math.round((p / 100) * (ord.length - 1))));
  return ord[idx];
}

/**
 * Avalia a qualidade de um sinal mono normalizado em [-1, 1].
 *
 * Ruído × fala: o "trecho silencioso" é estimado pelo percentil 10 do RMS por
 * quadro de 20 ms, e a fala pelo percentil 90. Isso cobre o caso do início
 * silencioso e também o aluno que começa a falar imediatamente.
 */
export function avaliarQualidade(
  amostras: Float32Array,
  sampleRate: number,
  limites = LIMITES_QUALIDADE
): ResultadoQualidade {
  const duracaoS = amostras.length / sampleRate;

  const frame = Math.max(1, Math.round((limites.frameMs / 1000) * sampleRate));
  const rmsQuadros: number[] = [];
  let saturadas = 0;
  for (let i = 0; i < amostras.length; i += frame) {
    let soma = 0;
    const fim = Math.min(amostras.length, i + frame);
    for (let j = i; j < fim; j++) {
      const x = amostras[j];
      soma += x * x;
      if (Math.abs(x) >= limites.nivelClipping) saturadas++;
    }
    rmsQuadros.push(Math.sqrt(soma / (fim - i)));
  }

  const rmsFala = percentil(rmsQuadros, 90);
  const rmsRuido = percentil(rmsQuadros, 10);
  const snrDb = 20 * Math.log10(Math.max(rmsFala, 1e-6) / Math.max(rmsRuido, 1e-5));
  const fracaoClipping = amostras.length ? saturadas / amostras.length : 0;

  const metricas: MetricasQualidade = {
    duracaoS: arred(duracaoS, 3),
    rmsFala: arred(rmsFala, 4),
    rmsRuido: arred(rmsRuido, 4),
    snrDb: arred(snrDb, 1),
    fracaoClipping: arred(fracaoClipping, 4),
  };

  const falha = (motivo: MotivoQualidade): ResultadoQualidade => ({
    ok: false,
    motivo,
    mensagem: MENSAGENS_QUALIDADE[motivo],
    metricas,
  });

  if (duracaoS < limites.duracaoMinS) return falha("curto_demais");
  if (duracaoS > limites.duracaoMaxS) return falha("longo_demais");
  if (fracaoClipping > limites.fracaoClippingMax) return falha("saturado");
  if (rmsFala < limites.rmsFalaMin) return falha("sem_fala");
  if (snrDb < limites.snrMinDb) return falha("ruidoso");

  return { ok: true, metricas };
}

function arred(v: number, casas: number): number {
  const f = 10 ** casas;
  return Math.round(v * f) / f;
}

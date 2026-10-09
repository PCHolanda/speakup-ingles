/**
 * Utilitários WAV (PCM 16-bit). Funções puras, sem APIs do navegador:
 * usados pelo gravador (cliente), pela rota de avaliação (servidor) e pelos scripts.
 */

export const SAMPLE_RATE_AZURE = 16000;
export const CONTENT_TYPE_AZURE = "audio/wav; codecs=audio/pcm; samplerate=16000";

/** Reamostra um sinal mono por média de janelas (downsample) ou interpolação linear (upsample). */
export function reamostrar(entrada: Float32Array, deHz: number, paraHz: number): Float32Array {
  if (deHz === paraHz) return entrada;
  const razao = deHz / paraHz;
  const n = Math.floor(entrada.length / razao);
  const saida = new Float32Array(n);
  if (razao > 1) {
    for (let i = 0; i < n; i++) {
      const ini = Math.floor(i * razao);
      const fim = Math.min(entrada.length, Math.floor((i + 1) * razao));
      let soma = 0;
      for (let j = ini; j < fim; j++) soma += entrada[j];
      saida[i] = soma / Math.max(1, fim - ini);
    }
  } else {
    for (let i = 0; i < n; i++) {
      const pos = i * razao;
      const a = Math.floor(pos);
      const b = Math.min(entrada.length - 1, a + 1);
      saida[i] = entrada[a] + (entrada[b] - entrada[a]) * (pos - a);
    }
  }
  return saida;
}

/** Codifica amostras mono [-1, 1] em WAV PCM16. */
export function codificarWav(amostras: Float32Array, sampleRate = SAMPLE_RATE_AZURE): Uint8Array {
  const bytesDados = amostras.length * 2;
  const buf = new ArrayBuffer(44 + bytesDados);
  const v = new DataView(buf);
  const escrever = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  escrever(0, "RIFF");
  v.setUint32(4, 36 + bytesDados, true);
  escrever(8, "WAVE");
  escrever(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  escrever(36, "data");
  v.setUint32(40, bytesDados, true);
  let off = 44;
  for (let i = 0; i < amostras.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, amostras[i]));
    v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buf);
}

export interface WavDecodificado {
  amostras: Float32Array;
  sampleRate: number;
  canais: number;
}

/** Decodifica WAV PCM16 (mono ou multicanal → mixado para mono). Lança erro se o formato não for suportado. */
export function decodificarWav(bytes: Uint8Array): WavDecodificado {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ler = (off: number, n: number) =>
    String.fromCharCode(...Array.from(bytes.subarray(off, off + n)));
  if (bytes.byteLength < 44 || ler(0, 4) !== "RIFF" || ler(8, 4) !== "WAVE") {
    throw new Error("Arquivo não é WAV");
  }

  let off = 12;
  let formato = 0;
  let canais = 0;
  let sampleRate = 0;
  let bits = 0;
  let dadosIni = -1;
  let dadosLen = 0;
  while (off + 8 <= bytes.byteLength) {
    const id = ler(off, 4);
    const tam = v.getUint32(off + 4, true);
    const corpo = off + 8;
    if (id === "fmt ") {
      formato = v.getUint16(corpo, true);
      canais = v.getUint16(corpo + 2, true);
      sampleRate = v.getUint32(corpo + 4, true);
      bits = v.getUint16(corpo + 14, true);
    } else if (id === "data") {
      dadosIni = corpo;
      dadosLen = Math.min(tam, bytes.byteLength - corpo);
      break;
    }
    off = corpo + tam + (tam % 2);
  }

  if (formato !== 1 || bits !== 16 || dadosIni < 0 || canais < 1) {
    throw new Error("WAV não suportado (esperado PCM 16-bit)");
  }

  const quadros = Math.floor(dadosLen / (2 * canais));
  const amostras = new Float32Array(quadros);
  for (let i = 0; i < quadros; i++) {
    let soma = 0;
    for (let c = 0; c < canais; c++) {
      soma += v.getInt16(dadosIni + (i * canais + c) * 2, true) / 0x8000;
    }
    amostras[i] = soma / canais;
  }
  return { amostras, sampleRate, canais };
}

/** Recorta um trecho [inicioMs, inicioMs+duracaoMs) de um sinal, com margem opcional. */
export function recortar(
  amostras: Float32Array,
  sampleRate: number,
  inicioMs: number,
  duracaoMs: number,
  margemMs = 80
): Float32Array {
  const ini = Math.max(0, Math.floor(((inicioMs - margemMs) / 1000) * sampleRate));
  const fim = Math.min(amostras.length, Math.ceil(((inicioMs + duracaoMs + margemMs) / 1000) * sampleRate));
  return amostras.slice(ini, Math.max(ini, fim));
}

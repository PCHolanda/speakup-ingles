/**
 * Gravador WAV 16 kHz mono para o navegador.
 * Captura PCM bruto (AudioWorklet, com fallback para ScriptProcessor),
 * expõe o nível de volume ao vivo e entrega WAV + controle de qualidade.
 * Somente cliente.
 */
import { avaliarQualidade, type ResultadoQualidade } from "./qualidade";
import { codificarWav, reamostrar, SAMPLE_RATE_AZURE } from "./wav";

export interface NivelAoVivo {
  /** RMS 0–1 do último bloco */
  rms: number;
  /** Pico 0–1 do último bloco */
  pico: number;
  /** true se o bloco teve amostras saturadas */
  saturado: boolean;
}

export interface GravacaoFinal {
  wav: Blob;
  amostras: Float32Array; // 16 kHz mono
  duracaoS: number;
  qualidade: ResultadoQualidade;
}

const WORKLET_SRC = `
class CapturaPCM extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor('captura-pcm', CapturaPCM);
`;

export class GravadorWav {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private fonte: MediaStreamAudioSourceNode | null = null;
  private no: AudioWorkletNode | ScriptProcessorNode | null = null;
  private blocos: Float32Array[] = [];
  private onNivel?: (n: NivelAoVivo) => void;

  static suportado(): boolean {
    return typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && !!window.AudioContext;
  }

  async iniciar(onNivel?: (n: NivelAoVivo) => void): Promise<void> {
    if (this.ctx) return;
    this.onNivel = onNivel;
    this.blocos = [];
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        // Supressão de ruído/eco distorce os fonemas; o controle de qualidade cuida do ruído.
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: true,
      },
    });
    this.ctx = new AudioContext();
    this.fonte = this.ctx.createMediaStreamSource(this.stream);

    const receber = (bloco: Float32Array) => {
      this.blocos.push(bloco);
      if (this.onNivel) {
        let soma = 0;
        let pico = 0;
        for (let i = 0; i < bloco.length; i++) {
          const a = Math.abs(bloco[i]);
          soma += bloco[i] * bloco[i];
          if (a > pico) pico = a;
        }
        this.onNivel({ rms: Math.sqrt(soma / bloco.length), pico, saturado: pico >= 0.99 });
      }
    };

    try {
      const url = URL.createObjectURL(new Blob([WORKLET_SRC], { type: "application/javascript" }));
      await this.ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      const node = new AudioWorkletNode(this.ctx, "captura-pcm");
      node.port.onmessage = (e: MessageEvent<Float32Array>) => receber(e.data);
      this.fonte.connect(node);
      this.no = node;
    } catch {
      // Fallback (Safari antigo): ScriptProcessor está deprecado, mas é amplamente suportado.
      const sp = this.ctx.createScriptProcessor(4096, 1, 1);
      sp.onaudioprocess = (e) => receber(new Float32Array(e.inputBuffer.getChannelData(0)));
      this.fonte.connect(sp);
      sp.connect(this.ctx.destination);
      this.no = sp;
    }
  }

  async parar(): Promise<GravacaoFinal> {
    const ctx = this.ctx;
    if (!ctx) throw new Error("Gravador não iniciado");
    const taxaOriginal = ctx.sampleRate;

    this.fonte?.disconnect();
    this.no?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    await ctx.close();
    this.ctx = null;
    this.stream = null;
    this.fonte = null;
    this.no = null;

    const total = this.blocos.reduce((s, b) => s + b.length, 0);
    const bruto = new Float32Array(total);
    let off = 0;
    for (const b of this.blocos) {
      bruto.set(b, off);
      off += b.length;
    }
    this.blocos = [];

    const amostras = reamostrar(bruto, taxaOriginal, SAMPLE_RATE_AZURE);
    const qualidade = avaliarQualidade(amostras, SAMPLE_RATE_AZURE);
    const wavBytes = codificarWav(amostras, SAMPLE_RATE_AZURE);
    return {
      wav: new Blob([wavBytes.buffer as ArrayBuffer], { type: "audio/wav" }),
      amostras,
      duracaoS: amostras.length / SAMPLE_RATE_AZURE,
      qualidade,
    };
  }

  /** Cancela sem produzir resultado (ex.: componente desmontado). */
  async cancelar(): Promise<void> {
    if (!this.ctx) return;
    this.fonte?.disconnect();
    this.no?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    await this.ctx.close();
    this.ctx = null;
    this.blocos = [];
  }
}

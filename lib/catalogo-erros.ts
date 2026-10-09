/**
 * Catálogo de erros de pronúncia típicos de falantes de português (nível A1).
 * Fonte única: usado pelo detector, pelo feedback (LLM e fallback) e pela UI.
 */

export const CODIGOS_ERRO = [
  "TH",
  "R_INICIAL",
  "EPENTESE",
  "SUFIXO_ED",
  "VOGAL_CURTA_LONGA",
  "V_W",
  "Y_INICIAL",
  "H_ASPIRADO",
  "CONSOANTE_FINAL",
  "OUTRO",
  "NENHUM",
] as const;

export type CodigoErro = (typeof CODIGOS_ERRO)[number];

/** Ilustração da boca usada em components/feedback/DicaBoca.tsx */
export type IlustracaoBoca =
  | "lingua_entre_dentes"
  | "lingua_recuada"
  | "sopro_garganta"
  | "labio_nos_dentes"
  | "sorriso_curto_longo"
  | "consoante_final"
  | "semivogal_y"
  | "neutra";

export interface EntradaCatalogo {
  codigo: CodigoErro;
  nome: string;
  descricao: string;
  /** Fonemas-alvo em IPA */
  fonemas: string[];
  /** Dica padrão (pt-BR, para criança). Também é o fallback se o LLM falhar. */
  dica: string;
  ilustracao: IlustracaoBoca;
  /** Exemplo curto exibido no painel */
  exemplo: string;
}

export const CATALOGO_ERROS: Record<CodigoErro, EntradaCatalogo> = {
  TH: {
    codigo: "TH",
    nome: "Som do TH",
    descricao: "Troca de /θ/ ou /ð/ por /t/, /f/, /d/ ou /s/.",
    fonemas: ["θ", "ð"],
    dica: "Coloque a pontinha da língua entre os dentes e sopre: thhh-ree.",
    ilustracao: "lingua_entre_dentes",
    exemplo: "three → tree / free",
  },
  R_INICIAL: {
    codigo: "R_INICIAL",
    nome: "R do começo",
    descricao: "R inicial pronunciado como /h/ (red soando como head).",
    fonemas: ["ɹ"],
    dica: "Enrole a língua para trás sem encostar no céu da boca: rrred.",
    ilustracao: "lingua_recuada",
    exemplo: "red → head",
  },
  EPENTESE: {
    codigo: "EPENTESE",
    nome: "Vogal extra no final/início",
    descricao: "Inserção de vogal antes ou depois de consoante (stop → istópi, big → bigui).",
    fonemas: ["ɡ", "t", "k", "d", "p", "b", "s"],
    dica: "Termine no som da consoante seca, sem soltar um 'i' no final: big.",
    ilustracao: "consoante_final",
    exemplo: "stop → istópi / big → bigui",
  },
  SUFIXO_ED: {
    codigo: "SUFIXO_ED",
    nome: "Final -ed",
    descricao: "-ed pronunciado como sílaba extra fora de /t/ e /d/ (played → pleiédi).",
    fonemas: ["t", "d"],
    dica: "Em 'played' o final é só o som rápido de /d/: pleid.",
    ilustracao: "consoante_final",
    exemplo: "played → pleiédi",
  },
  VOGAL_CURTA_LONGA: {
    codigo: "VOGAL_CURTA_LONGA",
    nome: "Vogal curta vs longa",
    descricao: "Confusão entre /ɪ/ e /iː/ (ship/sheep, live/leave).",
    fonemas: ["ɪ", "iː", "i"],
    dica: "'ship' é curtinho e relaxado; 'sheep' é longo, com sorriso: sheeeep.",
    ilustracao: "sorriso_curto_longo",
    exemplo: "ship → sheep",
  },
  V_W: {
    codigo: "V_W",
    nome: "Som do V e W",
    descricao: "Troca entre /v/ e /w/ ou /b/.",
    fonemas: ["v", "w"],
    dica: "Para o V, encoste os dentes de cima no lábio de baixo: vvvery.",
    ilustracao: "labio_nos_dentes",
    exemplo: "very → berry / water → vater",
  },
  Y_INICIAL: {
    codigo: "Y_INICIAL",
    nome: "Y inicial",
    descricao: "Omissão ou alteração do /j/ inicial (years soando como ears).",
    fonemas: ["j"],
    dica: "Comece com um 'i' bem rapidinho antes: iiyears.",
    ilustracao: "semivogal_y",
    exemplo: "years → ears",
  },
  H_ASPIRADO: {
    codigo: "H_ASPIRADO",
    nome: "H aspirado",
    descricao: "Omissão do /h/ aspirado ou pronúncia com R forte (house/have).",
    fonemas: ["h"],
    dica: "Solte um ar quentinho da garganta, como quem embaça um vidro: hhhouse.",
    ilustracao: "sopro_garganta",
    exemplo: "house → ouse / rouse",
  },
  CONSOANTE_FINAL: {
    codigo: "CONSOANTE_FINAL",
    nome: "Consoante final",
    descricao: "Final engolido ou nasalizado (cat → ké, time → taimi).",
    fonemas: ["t", "d", "m", "n", "k", "p"],
    dica: "Pronuncie suavemente a consoante final sem sumir com ela: ca-t.",
    ilustracao: "consoante_final",
    exemplo: "cat → ké / time → taimi",
  },
  OUTRO: {
    codigo: "OUTRO",
    nome: "Outro som",
    descricao: "Outra interferência fonética.",
    fonemas: [],
    dica: "Ouça o áudio modelo e repita com calma.",
    ilustracao: "neutra",
    exemplo: "",
  },
  NENHUM: {
    codigo: "NENHUM",
    nome: "Pronúncia adequada",
    descricao: "Sem erro fonético relevante para o nível.",
    fonemas: [],
    dica: "Muito bem!",
    ilustracao: "neutra",
    exemplo: "",
  },
};

// Aliases para compatibilidade retroativa
export const ALIASES_ERRO: Record<string, CodigoErro> = {
  TH_T_F_D: "TH",
  R_INICIAL_H: "R_INICIAL",
  ED_SILABA: "SUFIXO_ED",
  YEARS_EARS: "Y_INICIAL",
  H_MUDO: "H_ASPIRADO",
};

export function isCodigoErro(v: unknown): v is CodigoErro {
  return typeof v === "string" && (CODIGOS_ERRO as readonly string[]).includes(v);
}

/** Primeiro código do catálogo associado a um fonema IPA. */
export function codigoPorFonema(fonema: string): CodigoErro | undefined {
  return CODIGOS_ERRO.find((c) => CATALOGO_ERROS[c].fonemas.includes(fonema));
}

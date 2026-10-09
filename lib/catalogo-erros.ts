/**
 * Catálogo de erros de pronúncia típicos de falantes de português (nível A1).
 * Fonte única: usado pelo detector, pelo feedback (LLM e fallback) e pela UI.
 */

export const CODIGOS_ERRO = [
  "TH_T_F_D",
  "R_INICIAL_H",
  "EPENTESE",
  "ED_SILABA",
  "YEARS_EARS",
  "V_W",
  "VOGAL_CURTA_LONGA",
  "H_MUDO",
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
  | "semivogal_y";

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
  TH_T_F_D: {
    codigo: "TH_T_F_D",
    nome: "Som do TH",
    descricao: "Troca de /θ/ ou /ð/ por /t/, /f/, /d/ ou /s/.",
    fonemas: ["θ", "ð"],
    dica: "Coloque a pontinha da língua entre os dentes e sopre: thhh-ree.",
    ilustracao: "lingua_entre_dentes",
    exemplo: "three → tree",
  },
  R_INICIAL_H: {
    codigo: "R_INICIAL_H",
    nome: "R do começo",
    descricao: "R inicial pronunciado como /h/ (\"red\" soando como \"head\").",
    fonemas: ["ɹ"],
    dica: "Enrole a língua para trás sem encostar no céu da boca: rrred.",
    ilustracao: "lingua_recuada",
    exemplo: "red → head",
  },
  EPENTESE: {
    codigo: "EPENTESE",
    nome: "Vogal extra no final",
    descricao: "Inserção de vogal depois de consoante final (\"big\" → \"bigi\").",
    fonemas: ["ɡ", "t", "k", "d", "p", "b"],
    dica: "Termine a palavra no som da consoante, sem colocar um \"i\" no final: big.",
    ilustracao: "consoante_final",
    exemplo: "big → bigi",
  },
  ED_SILABA: {
    codigo: "ED_SILABA",
    nome: "Final -ed",
    descricao: "-ed pronunciado como sílaba extra fora de /t/ e /d/ (\"walked\" → \"walk-ed\").",
    fonemas: ["t", "d"],
    dica: "Em \"walked\" o final é só um /t/ rapidinho: walkt.",
    ilustracao: "consoante_final",
    exemplo: "walked → walk-ed",
  },
  YEARS_EARS: {
    codigo: "YEARS_EARS",
    nome: "Y de years",
    descricao: "Omissão do /j/ inicial (\"years\" soando como \"ears\").",
    fonemas: ["j"],
    dica: "Comece com um \"i\" bem rapidinho antes: iiyears.",
    ilustracao: "semivogal_y",
    exemplo: "years → ears",
  },
  V_W: {
    codigo: "V_W",
    nome: "Som do V",
    descricao: "Troca de /v/ por /w/ ou /b/.",
    fonemas: ["v"],
    dica: "Encoste os dentes de cima no lábio de baixo e faça vibrar: vvvery.",
    ilustracao: "labio_nos_dentes",
    exemplo: "very → berry",
  },
  VOGAL_CURTA_LONGA: {
    codigo: "VOGAL_CURTA_LONGA",
    nome: "I curto e I longo",
    descricao: "Confusão entre /ɪ/ (ship) e /iː/ (sheep).",
    fonemas: ["ɪ", "iː", "i"],
    dica: "\"ship\" é curtinho e relaxado; \"sheep\" é longo, com sorriso: sheeeep.",
    ilustracao: "sorriso_curto_longo",
    exemplo: "ship → sheep",
  },
  H_MUDO: {
    codigo: "H_MUDO",
    nome: "H aspirado",
    descricao: "Omissão do /h/ aspirado (\"have\" soando como \"ave\").",
    fonemas: ["h"],
    dica: "Solte um ar quentinho da garganta, como quem embaça um vidro: hhhave.",
    ilustracao: "sopro_garganta",
    exemplo: "have → ave",
  },
};

export function isCodigoErro(v: unknown): v is CodigoErro {
  return typeof v === "string" && (CODIGOS_ERRO as readonly string[]).includes(v);
}

/** Primeiro código do catálogo associado a um fonema IPA. */
export function codigoPorFonema(fonema: string): CodigoErro | undefined {
  return CODIGOS_ERRO.find((c) => CATALOGO_ERROS[c].fonemas.includes(fonema));
}

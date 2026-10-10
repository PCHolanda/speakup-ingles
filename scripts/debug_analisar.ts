import { analisarPronuncia, ContextoPergunta } from "../lib/pronuncia/analisar";
import fs from "fs";

async function main() {
  const dummyWav = new Uint8Array(100); // 100 zero bytes
  const pergunta: ContextoPergunta = {
    enunciado: "What is your name?",
    tipo: "pergunta_oral",
    respostas_esperadas: ["My name is John"],
  };

  try {
    const result = await analisarPronuncia(dummyWav, pergunta);
    console.log("Success:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error thrown:", error);
  }
}

main();

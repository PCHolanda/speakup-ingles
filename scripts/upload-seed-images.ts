import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function uploadSeedImages() {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.log("Variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não configuradas.");
    console.log("As imagens continuam disponíveis localmente em /seed/*.png");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const images = ["gato-caixa.png", "comparacao-dia-noite.png"];
  const seedDir = path.join(process.cwd(), "public", "seed");

  for (const filename of images) {
    const filePath = path.join(seedDir, filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`Arquivo não encontrado: ${filePath}`);
      continue;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const { data, error } = await supabase.storage
      .from("atividades")
      .upload(filename, fileBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (error) {
      console.error(`Erro ao subir ${filename}:`, error.message);
    } else {
      console.log(`Sucesso no upload de ${filename}:`, data?.path);
    }
  }
}

uploadSeedImages().catch((err) => {
  console.error("Erro fatal no upload:", err);
});

/**
 * Diagnóstico: a RLS reconhece o JWT do usuário?
 * Uso: npx tsx scripts/diagnostico-rls-jwt.ts
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function main() {
  const sb = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInWithPassword({
    email: "professor@demo.com",
    password: "password123",
  });
  if (error || !data.session) throw error ?? new Error("sem sessão");
  const token = data.session.access_token;
  const header = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString());
  console.log("JWT header:", header);

  // 1. O GoTrue aceita o token?
  const u = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` },
  });
  console.log("GET /auth/v1/user:", u.status);

  // 2. PostgREST com o token: tabelas com policies simples por auth.uid()
  for (const t of ["profiles", "turmas", "atividades", "turma_alunos"]) {
    const r = await fetch(`${url}/rest/v1/${t}?select=*`, {
      headers: { apikey: anon, Authorization: `Bearer ${token}` },
    });
    const body = await r.text();
    console.log(`${t}: HTTP ${r.status} ->`, body.slice(0, 160));
  }

  // 3. Mesmo request como anon (sem JWT de usuário)
  const anonR = await fetch(`${url}/rest/v1/atividades?select=id`, { headers: { apikey: anon } });
  console.log("atividades como anon:", anonR.status, (await anonR.text()).slice(0, 120));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

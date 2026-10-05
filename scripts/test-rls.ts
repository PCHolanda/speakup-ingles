import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function checkRLS() {
  console.log("=== EXAMINANDO POLICIES DE PROFILES ===");
  // Vamos buscar via RPC se houver ou testar
  const { data: d1, error: e1 } = await admin.auth.signInWithPassword({
    email: "professor@demo.com",
    password: "password123",
  });
  console.log("Admin client signInWithPassword:", d1.user?.id, "Error:", e1);
}

checkRLS().catch(console.error);

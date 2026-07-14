import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";

/**
 * Cliente anônimo sem sessão, para leituras públicas em RSC (home, landing de
 * parceiro). Não usa cookies, então não força renderização dinâmica.
 * Retorna null quando o Supabase não está configurado.
 */
export function createPublicSupabase() {
  if (!isSupabaseConfigured()) return null;
  return createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

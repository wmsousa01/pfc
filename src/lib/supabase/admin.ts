import { createClient } from "@supabase/supabase-js";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./env";

/**
 * Cliente com service-role (ignora RLS). SOMENTE servidor.
 * Usado para registrar cliques e operações de escrita do admin.
 * Retorna null se não configurado, para permitir degradação graciosa.
 *
 * `no-store` é obrigatório: o supabase-js usa fetch, e o Next 14 guarda as
 * respostas do fetch no Data Cache mesmo em página force-dynamic. Sem isso o
 * painel do parceiro mostrava leitura velha — leads novos sumidos, aceite de
 * termos ainda pendente depois de feito, conversa sem mensagens. Dado privado
 * lido com service-role nunca deve sair de cache.
 */
export function createAdminSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/**
 * Cliente Supabase para contexto de servidor (RSC, Server Actions, Route Handlers)
 * que respeita a sessão de autenticação do usuário via cookies.
 * Usado no painel admin.
 */
export function createServerSupabase() {
  const cookieStore = cookies();
  return createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // chamado de um RSC — pode ser ignorado quando há middleware refrescando a sessão
        }
      },
    },
  });
}

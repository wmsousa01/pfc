"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/**
 * Só o que a gente realmente usa. `Parameters<typeof createBrowserClient>[2]`
 * não serve aqui: a função tem overloads e o TS resolve pela última, que é a
 * deprecada e exige `cookies`.
 */
type BrowserOptions = {
  auth?: { detectSessionInUrl?: boolean; persistSession?: boolean };
};

/**
 * Cliente Supabase no browser (login do admin, do revendedor e recuperação).
 *
 * `options` existe para /redefinir-senha, que precisa desligar o
 * `detectSessionInUrl` — veja o comentário de lá.
 */
export function createBrowserSupabase(options?: BrowserOptions) {
  return createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, options);
}

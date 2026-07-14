"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/** Cliente Supabase no browser (usado no login do admin). */
export function createBrowserSupabase() {
  return createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
}

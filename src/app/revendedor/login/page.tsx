"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { MicIcon } from "@/components/icons";

export default function ResellerLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const configured = isSupabaseConfigured();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createBrowserSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setError(
          error.message === "Invalid login credentials"
            ? "E-mail ou senha inválidos."
            : `Erro: ${error.message}`
        );
        setLoading(false);
        return;
      }
      if (!data.session) {
        setError("Login sem sessão. Fale com a equipe do Fora da Caixa.");
        setLoading(false);
        return;
      }
      // Navegação "hard": garante o cookie de sessão no servidor antes do gate.
      window.location.assign("/revendedor");
    } catch (err) {
      setError(
        err instanceof Error ? `Erro: ${err.message}` : "Erro ao entrar. Tente novamente."
      );
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="flex items-center justify-center w-11 h-11 bg-gold-500 rounded-lg">
            <MicIcon className="w-6 h-6 text-black" />
          </div>
          <div>
            <div className="text-gold-500 font-black text-xl leading-none">
              Fora da Caixa
            </div>
            <div className="text-white/40 text-xs mt-1">Área do revendedor</div>
          </div>
        </div>

        {!configured && (
          <div className="mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
            Supabase ainda não configurado.
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-[#111] border border-[#222] rounded-2xl p-6 flex flex-col gap-4"
        >
          <div>
            <label className="text-white/60 text-sm font-medium">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1.5 w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gold-500/50"
              placeholder="voce@email.com"
            />
          </div>
          <div>
            <label className="text-white/60 text-sm font-medium">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1.5 w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gold-500/50"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || !configured}
            className="btn-primary py-3 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <p className="text-white/30 text-xs text-center">
            O acesso é criado pela equipe do Fora da Caixa. Perdeu a senha? Chame
            no WhatsApp.
          </p>
        </form>

        <a
          href="/"
          className="block text-center text-white/30 hover:text-white/60 text-sm mt-6 transition-colors"
        >
          ← Voltar ao site
        </a>
      </div>
    </main>
  );
}

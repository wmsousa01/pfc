"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { MicIcon } from "@/components/icons";

const inputCls =
  "mt-1.5 w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gold-500/50";

/**
 * Login das duas áreas logadas (admin e revendedor) + pedido de recuperação
 * de senha. As telas eram duplicadas; foram unificadas aqui para o fluxo de
 * "esqueci minha senha" não precisar existir em dois lugares.
 */
export default function LoginForm({
  subtitle,
  home,
  note,
}: {
  subtitle: string;
  /** Para onde ir depois de entrar. */
  home: string;
  /** Recado abaixo do botão (varia entre admin e revendedor). */
  note?: string;
}) {
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const configured = isSupabaseConfigured();

  function switchMode(next: "login" | "forgot") {
    setMode(next);
    setError(null);
    setSent(false);
  }

  async function handleLogin(e: React.FormEvent) {
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
      window.location.assign(home);
    } catch (err) {
      setError(
        err instanceof Error ? `Erro: ${err.message}` : "Erro ao entrar. Tente novamente."
      );
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createBrowserSupabase();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      if (error) {
        setError(`Não foi possível enviar agora: ${error.message}`);
        setLoading(false);
        return;
      }
      // Mensagem propositalmente genérica: confirmar que a conta existe
      // entregaria a lista de e-mails cadastrados a quem ficar tentando.
      setSent(true);
      setLoading(false);
    } catch (err) {
      setError(
        err instanceof Error ? `Erro: ${err.message}` : "Erro ao enviar. Tente novamente."
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
            <div className="text-white/40 text-xs mt-1">{subtitle}</div>
          </div>
        </div>

        {!configured && (
          <div className="mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
            Supabase ainda não configurado.
          </div>
        )}

        {mode === "login" ? (
          <form
            onSubmit={handleLogin}
            className="bg-[#111] border border-[#222] rounded-2xl p-6 flex flex-col gap-4"
          >
            <div>
              <label className="text-white/60 text-sm font-medium">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className={inputCls}
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
                autoComplete="current-password"
                className={inputCls}
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

            <button
              type="button"
              onClick={() => switchMode("forgot")}
              className="text-white/40 hover:text-white/70 text-sm transition-colors"
            >
              Esqueci minha senha
            </button>

            {note && <p className="text-white/30 text-xs text-center">{note}</p>}
          </form>
        ) : (
          <form
            onSubmit={handleForgot}
            className="bg-[#111] border border-[#222] rounded-2xl p-6 flex flex-col gap-4"
          >
            <div>
              <p className="text-white font-semibold">Recuperar senha</p>
              <p className="text-white/45 text-sm mt-1 leading-relaxed">
                Informe seu e-mail e enviamos um link para você criar uma senha
                nova.
              </p>
            </div>

            {sent ? (
              <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-4 py-3">
                <p className="text-emerald-300 text-sm leading-relaxed">
                  Se existir uma conta com esse e-mail, o link já está a caminho.
                  Confira também a caixa de spam — e lembre que ele expira em
                  1 hora.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-white/60 text-sm font-medium">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className={inputCls}
                    placeholder="voce@email.com"
                  />
                </div>

                {error && <p className="text-red-400 text-sm">{error}</p>}

                <button
                  type="submit"
                  disabled={loading || !configured}
                  className="btn-primary py-3 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Enviando..." : "Enviar link"}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => switchMode("login")}
              className="text-white/40 hover:text-white/70 text-sm transition-colors"
            >
              ← Voltar para o login
            </button>
          </form>
        )}

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

"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { MIN_PASSWORD_LENGTH } from "@/lib/config";
import { MicIcon } from "@/components/icons";

const inputCls =
  "mt-1.5 w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gold-500/50";

type Status =
  | { kind: "checking" }
  | { kind: "ready" }
  | { kind: "invalid"; message: string }
  | { kind: "done" };

/**
 * Destino do link de recuperação enviado por e-mail.
 *
 * Precisa ficar FORA dos matchers do middleware (`/admin/*` e `/revendedor/*`):
 * quem chega aqui está justamente sem conseguir entrar, e seria barrado antes
 * de conseguir trocar a senha.
 */
export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>({ kind: "checking" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    let cancelled = false;

    async function prepare() {
      // Link expirado/já usado: o Supabase devolve o motivo na própria URL.
      const params = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const described = params.get("error_description") ?? hash.get("error_description");

      if (described) {
        setStatus({ kind: "invalid", message: described });
        return;
      }

      // O cliente do @supabase/ssr troca o ?code= por sessão sozinho ao montar;
      // por isso a sessão é conferida antes de tentar a troca manual.
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        setStatus({ kind: "ready" });
        return;
      }

      const code = params.get("code");
      if (!code) {
        setStatus({
          kind: "invalid",
          message:
            "Este endereço só funciona pelo link enviado por e-mail. Peça um novo na tela de login.",
        });
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (cancelled) return;
      setStatus(
        error
          ? {
              kind: "invalid",
              message:
                "O link expirou ou já foi usado. Peça um novo na tela de login.",
            }
          : { kind: "ready" }
      );
    }

    prepare();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`A senha precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirm) {
      setError("A confirmação não bate com a nova senha.");
      return;
    }

    setSaving(true);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(`Não foi possível salvar: ${error.message}`);
      setSaving(false);
      return;
    }
    setStatus({ kind: "done" });
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
            <div className="text-white/40 text-xs mt-1">Nova senha</div>
          </div>
        </div>

        <div className="bg-[#111] border border-[#222] rounded-2xl p-6">
          {status.kind === "checking" && (
            <p className="text-white/50 text-sm text-center py-4">
              Conferindo seu link...
            </p>
          )}

          {status.kind === "invalid" && (
            <div className="flex flex-col gap-4">
              <p className="text-red-400 text-sm leading-relaxed">
                {status.message}
              </p>
              <div className="flex flex-col gap-2">
                <a
                  href="/revendedor/login"
                  className="btn-primary py-3 rounded-lg font-bold text-center"
                >
                  Ir para o login do revendedor
                </a>
                <a
                  href="/admin/login"
                  className="text-white/40 hover:text-white/70 text-sm text-center transition-colors"
                >
                  Sou do time — login do admin
                </a>
              </div>
            </div>
          )}

          {status.kind === "ready" && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <p className="text-white/55 text-sm leading-relaxed">
                Escolha sua nova senha. Ela substitui a anterior imediatamente.
              </p>

              <div>
                <label className="text-white/60 text-sm font-medium">
                  Nova senha
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className={inputCls}
                  placeholder={`mín. ${MIN_PASSWORD_LENGTH} caracteres`}
                />
              </div>
              <div>
                <label className="text-white/60 text-sm font-medium">
                  Repita a senha
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  className={inputCls}
                  placeholder="••••••••"
                />
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={saving}
                className="btn-primary py-3 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Salvando..." : "Salvar nova senha"}
              </button>
            </form>
          )}

          {status.kind === "done" && (
            <div className="flex flex-col gap-4 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-xl mx-auto">
                ✓
              </div>
              <p className="text-white font-bold">Senha alterada!</p>
              <p className="text-white/50 text-sm leading-relaxed">
                Você já está logado. É só seguir para o seu painel.
              </p>
              {/* /admin resolve o papel sozinho: revendedor cai em /revendedor
                  e conta sem papel vai para /sem-acesso. */}
              <a
                href="/admin"
                className="btn-primary py-3 rounded-lg font-bold text-center"
              >
                Ir para o meu painel
              </a>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

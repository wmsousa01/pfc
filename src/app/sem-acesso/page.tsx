import { signOutAction } from "@/lib/auth-actions";
import { MicIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

/**
 * Estado terminal para uma conta autenticada que não é admin nem revendedor
 * ativo. Fica FORA dos matchers do middleware de propósito: é aqui que os
 * gates param, em vez de ficar redirecionando entre /admin e /revendedor.
 */
export default function SemAcessoPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex items-center justify-center w-11 h-11 bg-gold-500 rounded-lg mx-auto mb-6">
          <MicIcon className="w-6 h-6 text-black" />
        </div>
        <h1 className="text-xl font-bold text-white">Conta sem acesso</h1>
        <p className="text-white/50 text-sm mt-3 leading-relaxed">
          Seu login funcionou, mas esta conta ainda não está vinculada a um
          cadastro de revendedor ativo. Fale com a equipe do Fora da Caixa para
          liberar o acesso.
        </p>
        <form action={signOutAction} className="mt-8">
          <input type="hidden" name="to" value="/" />
          <button className="btn-primary w-full py-3 rounded-lg font-bold">
            Sair
          </button>
        </form>
        <a
          href="/"
          className="block text-white/30 hover:text-white/60 text-sm mt-6 transition-colors"
        >
          ← Voltar ao site
        </a>
      </div>
    </main>
  );
}

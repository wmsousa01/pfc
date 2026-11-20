import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProducaoForm from "@/components/admin/ProducaoForm";
import { inputCls } from "@/components/agenda/BriefingFields";
import CadastroFields from "@/components/apresentador/CadastroFields";
import TermoImagem from "@/components/apresentador/TermoImagem";
import { hashDoTermo } from "@/lib/apresentadores/termo";
import { cadastrarAction } from "./actions";

export const dynamic = "force-dynamic";

// Página de equipe, não de público: fora dos buscadores.
export const metadata: Metadata = {
  title: "Cadastro de apresentador | Fora da Caixa",
  robots: { index: false, follow: false },
};

export default function CadastroApresentadorPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#0a0a0a] pt-28 pb-20">
        <div className="container-px max-w-3xl">
          <span className="section-tag">Área do apresentador</span>
          <h1 className="text-3xl sm:text-4xl font-black mt-3 leading-tight">Cadastro de apresentador</h1>
          <p className="text-white/60 mt-3">
            Preencha seus dados e aceite o termo de uso de imagem. Em seguida você ganha um link pessoal para mandar
            fotos, vídeos, vinhetas e roteiros usados nas gravações e transmissões. Guarde o link: é por ele que você
            volta para mandar material novo.
          </p>

          <ProducaoForm
            action={cadastrarAction}
            label="Cadastrar e aceitar o termo"
            pending="Cadastrando..."
            className="mt-8 space-y-8"
            buttonClassName="btn-primary w-full py-4 rounded-xl text-base font-bold"
          >
            {/* Honeypot: escondido de quem usa o site. */}
            <input name="site_url" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
            <input type="hidden" name="termo_hash" value={hashDoTermo()} />

            <CadastroFields />

            <section className="space-y-4">
              <h2 className="text-white font-bold text-xl">Uso de imagem</h2>
              <TermoImagem />
              <label className="flex items-start gap-3 text-sm text-white/80">
                <input type="checkbox" name="termo_aceite" value="1" required className="mt-1 accent-gold-500" />
                <span>Li e autorizo o uso da minha imagem, voz e materiais nas condições acima.</span>
              </label>
              <div>
                <label className="block text-white/70 text-sm font-semibold mb-1.5" htmlFor="termo_nome">
                  Nome completo (vale como assinatura) *
                </label>
                <input id="termo_nome" name="termo_nome" required maxLength={160} className={inputCls} placeholder="Nome e sobrenome" />
              </div>
            </section>
          </ProducaoForm>
        </div>
      </main>
      <Footer />
    </>
  );
}

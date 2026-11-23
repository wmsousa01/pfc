import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import EnvioGrande from "@/components/arquivos/EnvioGrande";
import { arquivosDoLink, linkPorToken, linkValido, tamanhoLegivel } from "@/lib/arquivos/store";
import { whatsapp } from "@/lib/config";
import { cancelarLinkAction, concluirLinkAction, iniciarLinkAction, retomarLinkAction, urlsLinkAction } from "../actions";

export const dynamic = "force-dynamic";

// O link é pessoal: fora dos buscadores.
export const metadata: Metadata = { title: "Enviar arquivos | Fora da Caixa", robots: { index: false, follow: false } };

const data = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default async function EnviarPage({ params }: { params: { token: string } }) {
  const l = await linkPorToken(params.token);
  if (!l) notFound();
  const valido = linkValido(l);
  const enviados = valido ? (await arquivosDoLink(l.id)).filter((a) => a.status === "pronto") : [];
  const t = l.token;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#0a0a0a] pt-28 pb-20">
        <div className="container-px max-w-2xl space-y-8">
          <div>
            <span className="section-tag">Envio de arquivos</span>
            <h1 className="text-3xl sm:text-4xl font-black mt-3 leading-tight">{l.titulo}</h1>
            {l.mensagem && <p className="text-white/60 mt-3 whitespace-pre-line">{l.mensagem}</p>}
          </div>

          {!valido ? (
            <div className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-300 text-sm">
              Este link expirou ou foi desativado. Peça um novo à produção.
            </div>
          ) : (
            <section className="bg-[#111] border border-[#222] rounded-2xl p-6">
              <p className="text-white/50 text-sm mb-4">
                Os arquivos chegam direto para a produção do Fora da Caixa. Pode mandar vídeo bruto, vários GB por arquivo
                {l.max_arquivo ? ` (até ${tamanhoLegivel(l.max_arquivo)} cada)` : ""}. Link válido até {data(l.expira_em)}.
              </p>
              <EnvioGrande
                acoes={{
                  iniciar: iniciarLinkAction.bind(null, t),
                  retomar: retomarLinkAction.bind(null, t),
                  urls: urlsLinkAction.bind(null, t),
                  concluir: concluirLinkAction.bind(null, t),
                  cancelar: cancelarLinkAction.bind(null, t),
                }}
                escopo={`link:${l.id}`}
                pedirRemetente
                maxBytes={l.max_arquivo}
                inputCls="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30"
                buttonCls="btn-primary px-5 py-2.5 rounded-lg text-sm font-bold"
              />
            </section>
          )}

          {enviados.length > 0 && (
            <section>
              <h2 className="text-white font-bold">Já recebidos por este link</h2>
              <ul className="mt-3 divide-y divide-[#1f1f1f] text-sm">
                {enviados.map((a) => (
                  <li key={a.id} className="py-2 flex justify-between gap-3">
                    <span className="text-white/80 truncate">{a.nome}</span>
                    <span className="text-white/40 whitespace-nowrap">
                      {tamanhoLegivel(a.tamanho)} · {a.enviado_por}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="text-white/40 text-sm">
            Algum problema no envio?{" "}
            <a href={whatsapp(`Oi! Estou tentando enviar arquivos pelo link "${l.titulo}".`)} target="_blank" className="text-gold-400 hover:underline">
              Fale com a produção no WhatsApp
            </a>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}

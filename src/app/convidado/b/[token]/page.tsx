import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProducaoForm from "@/components/admin/ProducaoForm";
import BriefingFields from "@/components/agenda/BriefingFields";
import { youtubeUrl } from "@/lib/agenda/fluxo";
import { convidadoPorToken, getArte, getEpisodio, quandoLongo } from "@/lib/agenda/store";
import { whatsapp } from "@/lib/config";
import { QUADROS, isQuadroId } from "@/lib/producao/quadros";
import { signedUrls } from "@/lib/producao/store";
import { salvarBriefingAction } from "../../actions";

export const dynamic = "force-dynamic";

// O link é pessoal: fora dos buscadores.
export const metadata: Metadata = { title: "Sua participação | Fora da Caixa", robots: { index: false, follow: false } };

const STATUS = {
  solicitado: { label: "Aguardando confirmação", texto: "A produção vai confirmar pelo WhatsApp. Enquanto isso, complete o briefing abaixo.", cls: "border-gold-500/40 bg-gold-500/10 text-gold-300" },
  confirmado: { label: "Confirmado", texto: "Está na agenda. O convite chegou no seu e-mail; chegue 20 minutos antes para passar o som.", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  realizado: { label: "Gravado", texto: "Obrigado pela conversa! Os cortes saem no canal nos próximos dias.", cls: "border-sky-500/40 bg-sky-500/10 text-sky-300" },
  cancelado: { label: "Cancelado", texto: "Esse horário foi cancelado. Fale com a produção para remarcar.", cls: "border-red-500/40 bg-red-500/10 text-red-300" },
} as const;

export default async function ConvidadoBriefingPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { novo?: string };
}) {
  const c = await convidadoPorToken(params.token);
  if (!c) notFound();
  const ep = await getEpisodio(c.episodio_id);
  if (!ep) notFound();
  const t = isQuadroId(ep.quadro) ? QUADROS[ep.quadro] : null;
  const st = STATUS[ep.status];

  // As artes aparecem para o convidado só depois de confirmado — é ele quem mais compartilha.
  const arte = ep.status === "confirmado" && ep.arte_id ? await getArte(ep.arte_id) : null;
  const urls = arte ? await signedUrls([arte.feed_path, arte.story_path]) : new Map<string, string>();
  const live = youtubeUrl(ep);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#0a0a0a] pt-28 pb-20">
        <div className="container-px max-w-3xl space-y-8">
          {searchParams.novo && (
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-sm">
              Pedido recebido! Guarde este link: é por ele que você acompanha e completa sua participação.
            </div>
          )}

          <div>
            <span className="section-tag">{t?.name ?? "Fora da Caixa"}</span>
            <h1 className="text-3xl sm:text-4xl font-black mt-3 leading-tight capitalize">{quandoLongo(ep.inicio)}</h1>
            <div className={`mt-4 p-4 rounded-xl border text-sm ${st.cls}`}>
              <strong>{st.label}.</strong> {st.texto}
            </div>
            {live && ep.status === "confirmado" && (
              <p className="text-white/60 text-sm mt-3">
                Link da live para divulgar:{" "}
                <a href={live} target="_blank" className="text-gold-400 hover:underline break-all">{live}</a>
              </p>
            )}
          </div>

          {arte && (
            <section className="bg-[#111] border border-[#222] rounded-2xl p-6">
              <h2 className="text-white font-bold">Sua arte de divulgação</h2>
              <p className="text-white/50 text-sm mt-1">
                Baixe e poste no seu perfil e nos stories. Se recebeu o convite de collab no Instagram, aceite: o post
                aparece nos dois perfis.
              </p>
              <div className="grid grid-cols-2 gap-4 mt-4">
                {[
                  { path: arte.feed_path, label: "Feed (4:5)" },
                  { path: arte.story_path, label: "Story / Reels (9:16)" },
                ].map((a) => {
                  const url = urls.get(a.path);
                  return url ? (
                    <a key={a.path} href={url} download target="_blank" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={a.label} className="w-full rounded-lg border border-[#222]" />
                      <span className="text-gold-400 text-xs font-semibold mt-2 inline-block">↓ {a.label}</span>
                    </a>
                  ) : null;
                })}
              </div>
            </section>
          )}

          {ep.status !== "cancelado" && ep.status !== "realizado" && (
            <section>
              <h2 className="text-white font-bold text-xl">Seu briefing</h2>
              <p className="text-white/50 text-sm mt-1 mb-6">
                Quanto mais contexto, melhor a conversa: o apresentador usa isto para preparar as perguntas.
              </p>
              <ProducaoForm
                action={salvarBriefingAction}
                label="Salvar"
                pending="Salvando..."
                okMessage="Salvo. Obrigado!"
                className="space-y-6"
                buttonClassName="btn-primary w-full py-4 rounded-xl text-base font-bold"
              >
                <input type="hidden" name="token" value={c.token} />
                <BriefingFields c={c} />
              </ProducaoForm>
            </section>
          )}

          <p className="text-white/40 text-sm">
            Precisa remarcar ou tem alguma dúvida?{" "}
            <a
              href={whatsapp(`Oi! Sou ${c.nome}, convidado do ${t?.name ?? "Fora da Caixa"} em ${quandoLongo(ep.inicio)}.`)}
              target="_blank"
              className="text-gold-400 hover:underline"
            >
              Fale com a produção no WhatsApp
            </a>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}

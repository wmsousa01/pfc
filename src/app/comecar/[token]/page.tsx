import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Passos from "@/components/checkout/Passos";
import { salvarMarca } from "./actions";
import { getCheckoutByToken, getMarca, getPanelToken, syncCheckout } from "@/lib/checkout-store";
import { planById, REGRAS_PRECO } from "@/lib/planos";
import { site, whatsapp } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bem-vindo ao PFC | Fora da Caixa", robots: { index: false } };

const inputCls =
  "w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold-500/60 transition-colors";

const ERROS: Record<string, string> = {
  logo: "O logo precisa ser PNG, JPG ou WEBP de até 5 MB.",
  "1": "Não conseguimos salvar agora. Tente de novo.",
};

/**
 * Onboarding do cliente que pagou pelo site. Link secreto (onboarding_token),
 * sem login, no mesmo padrão do painel do parceiro.
 */
export default async function ComecarPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { ok?: string; erro?: string };
}) {
  const inicial = await getCheckoutByToken(params.token);
  if (!inicial) notFound();
  // Chegou pelo link antes do webhook (boleto compensado, por exemplo).
  const c = inicial.status === "pago" ? inicial : await syncCheckout(inicial);
  const plan = planById(c.plan);

  if (c.status !== "pago" || !c.partner_id) {
    return (
      <Shell atual={3}>
        <h1 className="text-3xl font-black mt-10 text-center">Pagamento ainda não confirmado</h1>
        <p className="text-white/60 mt-3 text-center">
          Assim que o Mercado Pago confirmar, este link libera o onboarding. Se já pagou, fale com a gente.
        </p>
        <div className="text-center">
          <a
            href={whatsapp(`Paguei o Plano ${plan?.name ?? c.plan} (${c.company}) e o onboarding não abriu`)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary inline-block mt-6 px-7 py-3.5 rounded-xl font-bold"
          >
            Falar no WhatsApp
          </a>
        </div>
      </Shell>
    );
  }

  const [marca, panelToken] = await Promise.all([getMarca(c.partner_id), getPanelToken(c.partner_id)]);
  const portal = marca && panelToken ? `${site.url}/parceiros/${marca.slug}/painel?token=${panelToken}` : null;
  const enviado = Boolean(c.onboarding_done_at);
  const vantagem = c.meses >= REGRAS_PRECO.vantagemMeses;
  const erro = searchParams.erro ? ERROS[searchParams.erro] ?? ERROS["1"] : null;

  const etapas = [
    { t: "Pagamento confirmado", d: `Plano ${plan?.name}, ${c.meses} meses.`, feito: true },
    { t: "Termos aceitos", d: "A cópia fica no seu portal, na aba Termos.", feito: true },
    { t: "Material da marca", d: "Logo, cor e WhatsApp de atendimento (abaixo).", feito: enviado },
    { t: "Sua página e o QR", d: "A produção monta em até 3 dias úteis depois do material.", feito: false },
    {
      t: "No ar",
      d: vantagem
        ? `Primeira entrega na agenda e ${REGRAS_PRECO.vantagem.toLowerCase()} combinado com a produção.`
        : "Primeira entrega na agenda do PFC, com aviso no seu portal.",
      feito: false,
    },
  ];

  return (
    <Shell atual={4}>
      <div className="text-center mt-8">
        <span className="section-tag">Onboarding</span>
        <h1 className="text-3xl sm:text-4xl font-black mt-3">
          Bem-vindo ao PFC, <span className="text-gradient-gold">{c.company}</span>
        </h1>
        <p className="text-white/55 mt-3">
          {searchParams.ok ? "Material recebido. Agora é com a gente." : "Faltam só alguns dados para colocar sua marca no ar."}
        </p>
      </div>

      <ol className="mt-8 grid gap-2">
        {etapas.map((e, i) => (
          <li
            key={e.t}
            className={`flex items-start gap-3 rounded-xl border p-4 ${
              e.feito ? "border-emerald-500/25 bg-emerald-500/[0.05]" : "border-[#222] bg-[#111]"
            }`}
          >
            <span
              className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-black ${
                e.feito ? "bg-emerald-500 text-black" : "bg-[#222] text-white/50"
              }`}
            >
              {e.feito ? "✓" : i + 1}
            </span>
            <div>
              <div className="text-white font-semibold">{e.t}</div>
              <div className="text-white/50 text-sm">{e.d}</div>
            </div>
          </li>
        ))}
      </ol>

      {marca && (
        <form action={salvarMarca} encType="multipart/form-data" className="mt-8 bg-[#111] border border-[#222] rounded-2xl p-6 flex flex-col gap-4">
          <input type="hidden" name="token" value={c.onboarding_token} />
          <div>
            <h2 className="text-white font-bold text-lg">{enviado ? "Material da marca (pode ajustar)" : "Material da marca"}</h2>
            <p className="text-white/45 text-sm mt-1">
              É o que vai na sua página em pfctv.com.br/parceiros/{marca.slug} e no QR do episódio.
            </p>
          </div>
          <div className="grid sm:grid-cols-[96px_1fr] gap-4 items-center">
            <div className="w-24 h-24 rounded-xl bg-black/40 border border-[#2a2a2a] flex items-center justify-center overflow-hidden">
              {marca.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={marca.logo_url} alt="Logo" className="max-w-full max-h-full object-contain" />
              ) : (
                <span className="text-white/25 text-xs">Sem logo</span>
              )}
            </div>
            <label className="flex flex-col gap-1.5 text-sm text-white/60">
              Logo (PNG com fundo transparente é o ideal)
              <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm text-white/60 file:mr-3 file:rounded-lg file:border-0 file:bg-gold-500 file:px-3 file:py-2 file:font-bold file:text-black" />
            </label>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm text-white/60">
              WhatsApp de atendimento *
              <input name="whatsapp" required defaultValue={marca.whatsapp ?? ""} inputMode="tel" className={inputCls} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-white/60">
              Instagram
              <input name="instagram" defaultValue={marca.instagram ? `@${marca.instagram}` : ""} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-white/60">
              Site
              <input name="website" defaultValue={marca.website ?? ""} className={inputCls} placeholder="suamarca.com.br" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-white/60">
              Cidade
              <input name="city" defaultValue={marca.city ?? ""} className={inputCls} placeholder="Mogi Guaçu" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-white/60">
              Cor da marca
              <input name="accent" type="color" defaultValue={marca.accent ?? "#FFD700"} className="h-12 w-full rounded-xl bg-[#0d0d0d] border border-[#2a2a2a] p-1" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-white/60">
              Frase curta
              <input name="tagline" defaultValue={marca.tagline ?? ""} maxLength={120} className={inputCls} placeholder="O que você faz, em uma linha" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-white/60 sm:col-span-2">
              O que a audiência do PFC precisa saber sobre você
              <textarea name="description" defaultValue={marca.description ?? ""} rows={4} maxLength={1000} className={inputCls} placeholder="Produtos, diferenciais, oferta para quem vier pelo PFC..." />
            </label>
          </div>
          {erro && (
            <p role="alert" className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {erro}
            </p>
          )}
          <button className="btn-primary py-3.5 rounded-xl font-bold">{enviado ? "Salvar alterações" : "Enviar material"}</button>
        </form>
      )}

      {portal && (
        <div className="mt-6 rounded-2xl border border-gold-500/30 bg-gold-500/[0.06] p-6">
          <h2 className="text-white font-bold">Seu portal de cliente</h2>
          <p className="text-white/55 text-sm mt-1">
            Entregas, termos, mensagens com a equipe e os acessos que o PFC gerou para você. Guarde este link: ele é
            só seu.
          </p>
          <a href={portal} className="btn-primary inline-block mt-4 px-6 py-3 rounded-xl font-bold">
            Abrir meu portal
          </a>
        </div>
      )}
    </Shell>
  );
}

function Shell({ atual, children }: { atual: number; children: React.ReactNode }) {
  return (
    <main className="bg-dark-900 text-white overflow-x-hidden">
      <Navbar />
      <section className="pt-32 pb-20 lg:pt-36 bg-[#0a0a0a] min-h-screen">
        <div className="container-px max-w-2xl mx-auto">
          <Passos atual={atual} />
          {children}
        </div>
      </section>
      <Footer />
    </main>
  );
}

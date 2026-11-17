import AdminHeader from "@/components/admin/AdminHeader";
import { requireAdmin } from "@/lib/auth";
import { OFERTA, STATUS_OFERTA, rotuloSemana, segundaDaSemana, semanasAVenda } from "@/lib/ads/config";
import { signedUrls } from "@/lib/ads/arte-io";
import { linkCurto } from "@/lib/ads/arte";
import { listarOfertas, vagasLivres, type Oferta } from "@/lib/ads/store";
import { formatDocument } from "@/lib/client-area";
import { brl } from "@/lib/money";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { aprovarOferta, alternarNota, editarTexto, publicarAgora, recusarOferta, refazerArte } from "./actions";

export const dynamic = "force-dynamic";

const btn = "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors";
const input = "w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-500/60";

const quando = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

function Card({ o, arte }: { o: Oferta; arte: string | null }) {
  const st = STATUS_OFERTA[o.status];
  const editavel = ["paga", "aprovada", "erro"].includes(o.status);
  return (
    <div className="bg-[#111] border border-[#222] rounded-2xl p-5 flex flex-col sm:flex-row gap-5">
      {arte ? (
        // eslint-disable-next-line @next/next/no-img-element
        <a href={arte} target="_blank" rel="noreferrer" className="flex-shrink-0">
          <img src={arte} alt="Arte do story" className="w-32 rounded-lg border border-[#2a2a2a]" />
        </a>
      ) : null}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${st.cls}`}>{st.label}</span>
          <span className="text-white font-bold">{o.empresa}</span>
          <span className="text-white/35 text-xs">
            {o.cidade} · {o.instagram ? `@${o.instagram}` : "sem Instagram"}
          </span>
        </div>
        <div className="text-white text-lg font-black mt-2">{o.titulo}</div>
        <p className="text-white/55 text-sm mt-1">{o.descricao}</p>

        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-white/45 mt-3">
          <span>
            {o.responsavel} · {formatDocument(o.documento)}
          </span>
          <span>
            {o.email} · +{o.whatsapp}
          </span>
          <span>
            {brl(o.valor_cents)} · MP {o.mp_payment_id ?? "—"} ({o.mp_status ?? "sem pagamento"})
          </span>
          <span>
            Story: {quando(o.publicar_em)}
            {o.publicada_em ? ` · no ar ${quando(o.publicada_em)}` : ""}
          </span>
          <span>
            Link: <a href={linkCurto(o.codigo)} className="underline">/o/{o.codigo}</a> · <b className="text-white/80">{o.cliques} cliques</b>
          </span>
          {o.reembolso_id && <span>Reembolso MP {o.reembolso_id}</span>}
        </div>
        {o.erro && <p className="text-red-400 text-xs mt-2">{o.erro}</p>}
        {o.motivo_recusa && <p className="text-white/40 text-xs mt-2">Motivo: {o.motivo_recusa}</p>}

        {editavel && (
          <details className="mt-3">
            <summary className="text-white/50 text-xs cursor-pointer">Corrigir texto</summary>
            <form action={editarTexto} className="flex flex-col gap-2 mt-2">
              <input type="hidden" name="id" value={o.id} />
              <input name="titulo" defaultValue={o.titulo} maxLength={60} className={input} />
              <textarea name="descricao" defaultValue={o.descricao} maxLength={220} rows={2} className={input} />
              <button className={`${btn} self-start border-white/15 text-white/70 hover:bg-white/5`}>Salvar texto</button>
            </form>
          </details>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          {o.status === "paga" && (
            <form action={aprovarOferta}>
              <input type="hidden" name="id" value={o.id} />
              <button className={`${btn} border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10`}>Aprovar e gerar arte</button>
            </form>
          )}
          {["aprovada", "erro"].includes(o.status) && (
            <>
              <form action={publicarAgora}>
                <input type="hidden" name="id" value={o.id} />
                <button className={`${btn} border-sky-500/40 text-sky-300 hover:bg-sky-500/10`}>
                  {o.status === "erro" ? "Tentar publicar de novo" : "Publicar agora"}
                </button>
              </form>
              <form action={refazerArte}>
                <input type="hidden" name="id" value={o.id} />
                <button className={`${btn} border-white/15 text-white/70 hover:bg-white/5`}>Refazer arte</button>
              </form>
            </>
          )}
          {o.pago_em && (
            <form action={alternarNota}>
              <input type="hidden" name="id" value={o.id} />
              <button className={`${btn} ${o.nota_emitida_em ? "border-emerald-500/30 text-emerald-300" : "border-amber-500/40 text-amber-300"} hover:bg-white/5`}>
                {o.nota_emitida_em ? "✓ Nota emitida" : "Marcar nota emitida"}
              </button>
            </form>
          )}
          {["reservada", "paga", "aprovada", "erro"].includes(o.status) && (
            <form action={recusarOferta} className="flex gap-2">
              <input type="hidden" name="id" value={o.id} />
              <input name="motivo" placeholder="Motivo da recusa" className={`${input} !py-1.5 !text-xs w-44`} />
              <button className={`${btn} border-red-500/40 text-red-300 hover:bg-red-500/10`}>
                {o.mp_status === "approved" ? "Recusar e reembolsar" : "Cancelar"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default async function AdminOfertasPage({ searchParams }: { searchParams: { semana?: string } }) {
  await requireAdmin();
  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <AdminHeader />
        <div className="max-w-3xl mx-auto px-6 py-20 text-center text-white/50">Supabase não configurado.</div>
      </div>
    );
  }

  const atual = segundaDaSemana(Date.now());
  const semanas = [atual, ...semanasAVenda()];
  const semana = semanas.includes(searchParams.semana ?? "") ? searchParams.semana! : null;
  const [ofertas, livres] = await Promise.all([
    listarOfertas(semana ? { semana } : {}),
    vagasLivres(semanas),
  ]);
  const arte = await signedUrls(ofertas.map((o) => o.arte_path).filter((p): p is string => !!p));
  const visiveis = ofertas.filter((o) => o.status !== "cancelada" && !(o.status === "reservada" && Date.parse(o.reservada_ate) < Date.now()));
  const aprovar = visiveis.filter((o) => o.status === "paga");
  const resto = visiveis.filter((o) => o.status !== "paga");
  const receita = ofertas.filter((o) => o.pago_em && o.status !== "recusada").reduce((s, o) => s + o.valor_cents, 0);
  const semNota = ofertas.filter((o) => o.pago_em && o.status !== "recusada" && !o.nota_emitida_em).length;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <AdminHeader />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white">Ofertas da semana</h1>
            <p className="text-white/45 text-sm mt-1">
              PFCTV Ads self-serve · {OFERTA.vagasPorSemana} vagas por semana · <a href="/anuncie" className="underline">/anuncie</a> ·{" "}
              <a href="/ofertas" className="underline">/ofertas</a>
            </p>
          </div>
          <div className="flex gap-3 text-center">
            <div className="bg-[#111] border border-[#222] rounded-xl px-4 py-2">
              <div className="text-gold-500 font-black text-lg">{brl(receita)}</div>
              <div className="text-white/40 text-[11px]">pago{semana ? " na semana" : ""}</div>
            </div>
            <div className="bg-[#111] border border-[#222] rounded-xl px-4 py-2">
              <div className={`font-black text-lg ${semNota ? "text-amber-300" : "text-white"}`}>{semNota}</div>
              <div className="text-white/40 text-[11px]">sem nota fiscal</div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-6">
          <a href="/admin/ofertas" className={`${btn} ${!semana ? "border-gold-500 text-gold-500" : "border-[#2a2a2a] text-white/60"}`}>
            Todas
          </a>
          {semanas.map((s) => (
            <a key={s} href={`/admin/ofertas?semana=${s}`} className={`${btn} ${semana === s ? "border-gold-500 text-gold-500" : "border-[#2a2a2a] text-white/60"}`}>
              {s === atual ? "Esta semana" : rotuloSemana(s)} · {livres[s] ?? 0} livres
            </a>
          ))}
        </div>

        {aprovar.length > 0 && (
          <section className="mt-8">
            <h2 className="text-amber-300 text-sm font-bold uppercase tracking-widest mb-3">Pagas, esperando aprovação ({aprovar.length})</h2>
            <div className="flex flex-col gap-4">
              {aprovar.map((o) => (
                <Card key={o.id} o={o} arte={o.arte_path ? arte.get(o.arte_path) ?? null : null} />
              ))}
            </div>
          </section>
        )}

        <section className="mt-8">
          <h2 className="text-white/50 text-sm font-bold uppercase tracking-widest mb-3">Ofertas</h2>
          {resto.length === 0 ? (
            <p className="text-white/40 text-sm">Nenhuma oferta {semana ? "nesta semana" : "ainda"}.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {resto.map((o) => (
                <Card key={o.id} o={o} arte={o.arte_path ? arte.get(o.arte_path) ?? null : null} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

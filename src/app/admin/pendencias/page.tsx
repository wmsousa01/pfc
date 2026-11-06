import AdminHeader from "@/components/admin/AdminHeader";
import { EspacoHeader, selo } from "@/components/admin/Espaco";
import { ICONES } from "@/components/admin/nav";
import { requireAdmin } from "@/lib/auth";
import { quandoLongo, type Convidado, type Episodio } from "@/lib/agenda/store";
import { db, type ProducaoVideo } from "@/lib/producao/store";
import type { ProducaoLive } from "@/lib/producao/lives";
import { QUADROS, isQuadroId } from "@/lib/producao/quadros";
import { PLATFORMS, type SocialPost } from "@/lib/social/store";

export const dynamic = "force-dynamic";

function quando(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Uma consulta que falha (tabela ausente, banco fora) vira lista vazia, não página quebrada. */
async function linhas<T>(consulta: () => PromiseLike<{ data: unknown }>): Promise<T[]> {
  try {
    return ((await consulta()).data ?? []) as T[];
  } catch {
    return [];
  }
}

type Linha = { id: string; href: string; titulo: string; detalhe: string; erro?: string | null; selo?: { label: string; cls: string } };
type Secao = { key: string; titulo: string; icone: string; area: string; areaHref: string; alerta?: boolean; itens: Linha[] };

export default async function PendenciasPage() {
  await requireAdmin();

  const [pedidos, revisar, cortesErro, lives, posts] = await Promise.all([
    linhas<Episodio>(() => db().from("agenda_episodios").select("*").eq("status", "solicitado").order("inicio").limit(50)),
    linhas<ProducaoVideo>(() => db().from("producao_videos").select("*").eq("status", "revisar").order("uploaded_at", { ascending: false }).limit(50)),
    linhas<ProducaoVideo>(() => db().from("producao_videos").select("*").eq("status", "erro").order("updated_at", { ascending: false }).limit(50)),
    linhas<ProducaoLive>(() => db().from("producao_lives").select("*").in("status", ["detectada", "erro"]).order("ended_at", { ascending: false }).limit(30)),
    linhas<SocialPost>(() => db().from("social_posts").select("*").eq("status", "erro").order("scheduled_at", { ascending: false }).limit(50)),
  ]);

  const convidados = pedidos.length
    ? await linhas<Convidado>(() => db().from("agenda_convidados").select("*").in("episodio_id", pedidos.map((e) => e.id)))
    : [];
  const nomes = (e: Episodio) =>
    convidados.filter((c) => c.episodio_id === e.id).map((c) => c.nome).join(", ") || e.tema || "Sem convidado";
  const quadro = (q: string | null) => (q && isQuadroId(q) ? QUADROS[q].name : "Quadro a identificar");

  const erroCls = "border-red-500/30 bg-red-500/10 text-red-300";
  const secoes: Secao[] = [
    {
      key: "pedidos",
      titulo: "Pedidos de convidados para confirmar",
      icone: ICONES.agenda,
      area: "Agenda",
      areaHref: "/admin/agenda",
      itens: pedidos.map((e) => ({
        id: e.id,
        href: `/admin/agenda/${e.id}`,
        titulo: nomes(e),
        detalhe: `${quadro(e.quadro)} · ${quandoLongo(e.inicio)}`,
      })),
    },
    {
      key: "revisar",
      titulo: "Thumbs para aprovar",
      icone: ICONES.producao,
      area: "Produção",
      areaHref: "/admin/producao?view=revisar",
      itens: revisar.map((v) => ({
        id: v.id,
        href: `/admin/producao?view=revisar#v-${v.id}`,
        titulo: v.title,
        detalhe: `${quadro(v.quadro)} · subiu ${quando(v.uploaded_at)}`,
      })),
    },
    {
      key: "lives",
      titulo: "Lives sem cortes",
      icone: ICONES.producao,
      area: "Produção",
      areaHref: "/admin/producao?view=lives",
      alerta: lives.some((l) => l.status === "erro"),
      itens: lives.map((l) => ({
        id: l.id,
        href: "/admin/producao?view=lives",
        titulo: l.title,
        detalhe: `terminou ${quando(l.ended_at)}`,
        erro: l.error,
        selo: l.status === "erro" ? { label: "Erro", cls: erroCls } : undefined,
      })),
    },
    {
      key: "cortes",
      titulo: "Cortes com erro",
      icone: ICONES.producao,
      area: "Produção",
      areaHref: "/admin/producao",
      alerta: true,
      itens: cortesErro.map((v) => ({
        id: v.id,
        href: "/admin/producao",
        titulo: v.title,
        detalhe: `${quadro(v.quadro)} · ${quando(v.updated_at)}`,
        erro: v.error,
      })),
    },
    {
      key: "posts",
      titulo: "Posts com erro",
      icone: ICONES.marketing,
      area: "Marketing",
      areaHref: "/admin/marketing",
      alerta: true,
      itens: posts.map((p) => ({
        id: p.id,
        href: "/admin/marketing",
        titulo: p.title,
        detalhe: `${PLATFORMS[p.platform].label} · ${quando(p.scheduled_at)}${p.attempts > 0 ? ` · ${p.attempts}ª tentativa` : ""}`,
        erro: p.error,
      })),
    },
  ].filter((s) => s.itens.length > 0);

  const total = secoes.reduce((n, s) => n + s.itens.length, 0);

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        <EspacoHeader
          area="Pendências"
          titulo="Pendências"
          extra={<span className="text-white/45 text-sm">{total === 0 ? "Tudo em dia" : `${total} pedem ação`}</span>}
        />

        {total === 0 ? (
          <p className="mt-6 p-6 rounded-xl border border-dashed border-[#2a2a2a] text-white/50 text-sm text-center">
            Nada esperando a equipe: nenhum pedido para confirmar, nenhuma thumb para aprovar e nenhum erro.
          </p>
        ) : (
          <div className="mt-5 space-y-5">
            {secoes.map((s) => (
              <section key={s.key} className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-xl overflow-hidden">
                <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#1c1c1c]">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-white min-w-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-white/50">
                      <path d={s.icone} />
                    </svg>
                    <span className="truncate">{s.titulo}</span>
                    <span className={s.alerta ? "text-red-400" : "text-white/40"}>{s.itens.length}</span>
                  </h2>
                  <a href={s.areaHref} className="text-xs text-white/50 hover:text-white whitespace-nowrap">
                    {s.area} →
                  </a>
                </header>
                <ul>
                  {s.itens.map((i) => (
                    <li key={i.id} className="border-b border-[#1a1a1a] last:border-0">
                      <a href={i.href} className="flex items-start justify-between gap-3 px-4 py-3 min-h-[56px] hover:bg-white/[0.03]">
                        <span className="min-w-0">
                          <span className="block text-white text-sm font-medium line-clamp-2">{i.titulo}</span>
                          <span className="block text-white/45 text-xs mt-0.5">{i.detalhe}</span>
                          {i.erro && <span className="block text-red-400/85 text-xs mt-1 break-words line-clamp-2">{i.erro}</span>}
                        </span>
                        {i.selo ? (
                          <span className={`${selo} ${i.selo.cls} shrink-0`}>{i.selo.label}</span>
                        ) : (
                          <span aria-hidden="true" className="text-white/30 shrink-0">›</span>
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

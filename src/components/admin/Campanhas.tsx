import type { Analise, Criativo, EntregaStatus, EstrategiaStatus, Metricas } from "@/lib/campanhas/store";
import type { Aba } from "@/components/admin/Espaco";

export const STATUS_ESTRATEGIA: Record<EstrategiaStatus, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "bg-white/5 border-white/10 text-white/50" },
  ativa: { label: "Ativa", cls: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" },
  pausada: { label: "Pausada", cls: "bg-gold-500/10 border-gold-500/30 text-gold-400" },
  encerrada: { label: "Encerrada", cls: "bg-white/5 border-white/10 text-white/30" },
};

export const STATUS_ENTREGA: Record<EntregaStatus, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "bg-white/5 border-white/10 text-white/50" },
  aprovado: { label: "Aprovado", cls: "bg-violet-500/10 border-violet-500/30 text-violet-300" },
  enviando: { label: "Subindo", cls: "bg-sky-500/10 border-sky-500/30 text-sky-400" },
  no_gerenciador: { label: "No gerenciador (pausado)", cls: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" },
  erro: { label: "Erro", cls: "bg-red-500/10 border-red-500/30 text-red-400" },
};

export const input =
  "bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-gold-500/50";
export const card = "bg-[#111] border border-[#222] rounded-2xl p-5";
export const btnSec = "text-xs border border-[#2a2a2a] hover:border-[#3a3a3a] text-white/70 hover:text-white rounded-lg px-3 py-1.5";
export const btnPri = "btn-primary px-3 py-1.5 rounded-lg text-xs font-bold";

function corDaNota(n: number): string {
  if (n >= 75) return "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
  if (n >= 50) return "bg-gold-500/10 border-gold-500/30 text-gold-400";
  return "bg-red-500/10 border-red-500/30 text-red-400";
}

export function Nota({ n, titulo }: { n: number | null; titulo?: string }) {
  if (n === null) return <span className="text-[11px] text-white/30 border border-white/10 rounded-full px-2 py-0.5">sem análise</span>;
  return (
    <span title={titulo} className={`text-[11px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${corDaNota(n)}`}>
      {n}/100
    </span>
  );
}

/** Miniatura 9:16/1:1 da peça; vídeo sem miniatura vira <video> sem som. */
export function Miniatura({ c, url, className = "w-16" }: { c: Criativo; url: string | undefined; className?: string }) {
  const ratio = c.formato === "16:9" ? "aspect-video" : c.formato === "1:1" ? "aspect-square" : c.formato === "4:5" ? "aspect-[4/5]" : "aspect-[9/16]";
  const cls = `${className} ${ratio} object-cover rounded-lg bg-black shrink-0 border border-[#222]`;
  if (!url) return <div className={`${cls} flex items-center justify-center text-[10px] text-white/30`}>{c.tipo}</div>;
  if (c.tipo === "video" && !c.thumb_url) return <video src={url} muted preload="metadata" className={cls} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" loading="lazy" className={cls} />;
}

const CRITERIOS: [keyof Pick<Analise, "gancho" | "clareza" | "ritmo" | "cta" | "formato" | "alinhamento">, string][] = [
  ["gancho", "Gancho (0–3 s)"],
  ["clareza", "Clareza sem som"],
  ["ritmo", "Ritmo / hierarquia"],
  ["cta", "Chamada para ação"],
  ["formato", "Formato e área segura"],
  ["alinhamento", "Alinhamento com a estratégia"],
];

function Lista({ titulo, itens, cor }: { titulo: string; itens: string[]; cor: string }) {
  if (!itens.length) return null;
  return (
    <div>
      <p className={`text-[11px] font-bold uppercase tracking-wide ${cor}`}>{titulo}</p>
      <ul className="mt-1 space-y-0.5">
        {itens.map((t, i) => (
          <li key={i} className="text-xs text-white/70 leading-relaxed">• {t}</li>
        ))}
      </ul>
    </div>
  );
}

export function AnaliseView({ a }: { a: Analise }) {
  return (
    <details className="mt-2 group">
      <summary className="cursor-pointer text-xs text-gold-400 hover:text-gold-300 select-none">
        Ver análise{a.estrategia ? ` (para “${a.estrategia}”)` : ""}
      </summary>
      <div className="mt-3 space-y-3 border-l border-[#2a2a2a] pl-3">
        <p className="text-sm text-white/80">{a.resumo}</p>
        <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2">
          {CRITERIOS.map(([k, label]) => (
            <div key={k}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-white/50">{label}</span>
                <span className="text-xs font-bold text-white/80">{a[k].nota}</span>
              </div>
              <div className="h-1 bg-[#222] rounded-full mt-1 overflow-hidden">
                <div className={`h-full ${a[k].nota >= 75 ? "bg-emerald-500" : a[k].nota >= 50 ? "bg-gold-500" : "bg-red-500"}`} style={{ width: `${a[k].nota}%` }} />
              </div>
              <p className="text-[11px] text-white/45 mt-1 leading-snug">{a[k].comentario}</p>
            </div>
          ))}
        </div>
        <Lista titulo="Pontos fortes" itens={a.pontos_fortes} cor="text-emerald-400" />
        <Lista titulo="Problemas" itens={a.problemas} cor="text-red-400" />
        <Lista titulo="O que mudar" itens={a.sugestoes} cor="text-gold-400" />
        <Lista titulo="Risco de reprovação" itens={a.riscos_politica} cor="text-orange-400" />
        {a.posicionamentos.length > 0 && (
          <p className="text-xs text-white/50">
            Rende mais em: <span className="text-white/80">{a.posicionamentos.join(", ")}</span>
          </p>
        )}
        <div className="bg-[#0a0a0a] border border-[#222] rounded-lg p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-white/40">Copy sugerida</p>
          <p className="text-sm text-white font-semibold mt-1">{a.copy.headline}</p>
          <p className="text-xs text-white/70 mt-1 whitespace-pre-line">{a.copy.texto}</p>
        </div>
      </div>
    </details>
  );
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const int = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1).replace(".", ",")} mil` : String(Math.round(v)));

/** Linha compacta: gasto, impressões, cliques, CTR, CPC e ThruPlays quando há. */
export function MetricasView({ m, quando }: { m: Metricas | null; quando?: string | null }) {
  if (!m) return null;
  if (m.erro) return <p className="text-xs text-red-400 mt-1">Métricas: {m.erro}</p>;
  const itens: [string, string][] = [];
  if (m.gasto !== undefined) itens.push(["Gasto", brl(m.gasto)]);
  if (m.impressoes !== undefined) itens.push(["Impr.", int(m.impressoes)]);
  if (m.alcance !== undefined) itens.push(["Alcance", int(m.alcance)]);
  if (m.cliques !== undefined) itens.push(["Cliques", int(m.cliques)]);
  if (m.ctr !== undefined) itens.push(["CTR", `${m.ctr.toFixed(2).replace(".", ",")}%`]);
  if (m.cpc !== undefined) itens.push(["CPC", brl(m.cpc)]);
  if (m.thruplays !== undefined) itens.push(["ThruPlay", int(m.thruplays)]);
  if (m.conversoes !== undefined) itens.push(["Leads", int(m.conversoes)]);
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5" title={quando ? `Atualizado em ${new Date(quando).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : undefined}>
      {itens.map(([k, v]) => (
        <span key={k} className="text-[11px] text-white/40">
          {k} <span className="text-white/80 font-semibold">{v}</span>
        </span>
      ))}
    </div>
  );
}

export function Flash({ ok, erro }: { ok?: string; erro?: string }) {
  if (!ok && !erro) return null;
  return (
    <div className={`rounded-xl px-4 py-3 text-sm mb-6 border ${erro ? "bg-red-500/10 border-red-500/30 text-red-300" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"}`}>
      {erro ?? ok}
    </div>
  );
}

export type AbaCampanhas = "estrategias" | "criativos" | "gerenciadores" | "contas";

/** Abas da área de Campanhas, as mesmas em todas as páginas dela. */
export function abasCampanhas(atual: AbaCampanhas, alertaContas = false): Aba[] {
  return [
    { href: "/admin/campanhas", label: "Estratégias", ativa: atual === "estrategias" },
    { href: "/admin/campanhas/criativos", label: "Biblioteca de criativos", ativa: atual === "criativos" },
    { href: "/admin/campanhas?view=gerenciadores", label: "Nos gerenciadores", ativa: atual === "gerenciadores" },
    { href: "/admin/campanhas?view=contas", label: "Contas", ativa: atual === "contas", alerta: alertaContas },
  ];
}

export function SubNav({ atual }: { atual: AbaCampanhas }) {
  return (
    <nav className="flex gap-1 mb-6 border-b border-[#1f1f1f] overflow-x-auto">
      {abasCampanhas(atual).map((t) => (
        <a
          key={t.href}
          href={t.href}
          className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
            t.ativa ? "border-gold-500 text-gold-400" : "border-transparent text-white/55 hover:text-white hover:border-white/20"
          }`}
        >
          {t.label}
        </a>
      ))}
    </nav>
  );
}

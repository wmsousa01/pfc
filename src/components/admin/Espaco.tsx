/**
 * Moldura das áreas do admin no modelo do Jira: trilha, título, abas e quadro em colunas
 * que rolam por conta própria (a página não cresce com a quantidade de itens).
 */

const TZ = "America/Sao_Paulo";

/** Dia em Brasília como AAAA-MM-DD, para agrupar e ordenar. */
export function diaKey(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
}

export function diaLabel(key: string): string {
  if (!key) return "Sem data";
  const hoje = diaKey(new Date().toISOString());
  const amanha = diaKey(new Date(Date.now() + 86_400_000).toISOString());
  const ontem = diaKey(new Date(Date.now() - 86_400_000).toISOString());
  if (key === hoje) return "Hoje";
  if (key === amanha) return "Amanhã";
  if (key === ontem) return "Ontem";
  return new Date(`${key}T12:00:00Z`).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

/** Agrupa por dia em Brasília, mantendo a ordem em que os itens chegaram. */
export function porDia<T>(itens: T[], data: (t: T) => string | null): [string, T[]][] {
  const grupos = new Map<string, T[]>();
  for (const t of itens) {
    const k = diaKey(data(t));
    grupos.set(k, [...(grupos.get(k) ?? []), t]);
  }
  return Array.from(grupos.entries());
}

export type Aba = {
  href: string;
  label: string;
  ativa: boolean;
  /** Número ao lado do nome; com `alerta`, fica vermelho. */
  count?: number;
  /** Sem `count`, vira um ponto amarelo: algo pede atenção nessa aba. */
  alerta?: boolean;
};

export function EspacoHeader({
  area,
  titulo,
  extra,
  acoes,
  abas,
}: {
  area: string;
  titulo: string;
  /** Ao lado do título (selos de status, link público...). */
  extra?: React.ReactNode;
  /** À direita (botões da área). */
  acoes?: React.ReactNode;
  abas: Aba[];
}) {
  return (
    <>
      <p className="text-white/40 text-xs">Admin / {area}</p>
      <div className="flex flex-wrap items-center justify-between gap-3 mt-1">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <h1 className="text-2xl font-bold text-white">{titulo}</h1>
          {extra}
        </div>
        {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
      </div>
      <nav className="flex gap-1 mt-4 border-b border-[#1f1f1f] overflow-x-auto">
        {abas.map((t) => (
          <a
            key={t.href}
            href={t.href}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
              t.ativa
                ? "border-gold-500 text-gold-400"
                : "border-transparent text-white/55 hover:text-white hover:border-white/20"
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={`text-[10px] font-bold px-1.5 rounded-full ${
                  t.alerta ? "bg-red-500/20 text-red-300" : "bg-white/10 text-white/60"
                }`}
              >
                {t.count}
              </span>
            )}
            {t.alerta && t.count === undefined && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />}
          </a>
        ))}
      </nav>
    </>
  );
}

/** Grade do quadro: 1 coluna no celular, 2 no tablet, `cols` no desktop. */
export function Quadro({ cols = 4, children }: { cols?: 3 | 4 | 5; children: React.ReactNode }) {
  const xl = { 3: "xl:grid-cols-3", 4: "xl:grid-cols-4", 5: "xl:grid-cols-5" }[cols];
  return <div className={`grid gap-3 mt-4 md:grid-cols-2 ${xl} items-start`}>{children}</div>;
}

export function Coluna({
  titulo,
  count,
  alerta,
  vazio,
  children,
}: {
  titulo: string;
  count: number;
  /** Contagem em vermelho quando há itens (coluna de erros). */
  alerta?: boolean;
  vazio: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-xl flex flex-col min-w-0">
      <h2 className="px-3 pt-3 pb-2 text-[11px] font-bold uppercase tracking-wide text-white/60 flex items-center gap-2">
        {titulo}
        <span className={alerta && count > 0 ? "text-red-400" : "text-white/30"}>{count}</span>
      </h2>
      <div className="px-2 pb-2 space-y-2 overflow-y-auto max-h-[calc(100vh-290px)] min-h-[80px]">
        {count === 0 ? (
          <p className="text-white/30 text-xs px-1 py-6 text-center border border-dashed border-[#222] rounded-lg">{vazio}</p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

/** Rótulo de grupo dentro da coluna (dia, mês), fixo no topo enquanto a coluna rola. */
export function GrupoColuna({ label, count }: { label: string; count: number }) {
  return (
    <p className="sticky top-0 z-10 bg-[#0f0f0f] text-[11px] text-white/40 px-1 pt-1 pb-0.5 capitalize">
      {label} <span className="text-white/25">· {count}</span>
    </p>
  );
}

export const cartao = "block bg-[#161616] border border-[#242424] hover:border-[#333] rounded-lg p-3 transition-colors";
export const selo = "text-[11px] font-bold px-2 py-0.5 rounded border whitespace-nowrap";

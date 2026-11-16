import type { ReactNode } from "react";
import { PLACEMENTS, type PlacementId } from "@/lib/placements";

/**
 * Mockups de onde a marca aparece, desenhados em HTML/SVG (sem imagem) para
 * levar o nome e a cor do próprio cliente. Ilustrativos: o estúdio é uma
 * silhueta, não a foto real.
 *
 * Sem hooks — serve em Server e Client Components.
 */

export type MarcaInfo = { nome: string; cor: string; quadro?: string; /** Foto de perfil do Instagram (data URL). */ logo?: string | null };

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "sua-marca";

/** Texto preto ou branco, o que contrastar mais com a cor da marca. */
function tinta(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#fff";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? "#111" : "#fff";
}

/** "Logo" da marca: monograma + nome, na cor dela. */
function Logo({ m, size = "sm" }: { m: MarcaInfo; size?: "xs" | "sm" | "md" }) {
  const s = { xs: "text-[7px] px-1.5 py-0.5 gap-1", sm: "text-[10px] px-2 py-1 gap-1.5", md: "text-sm px-3 py-1.5 gap-2" }[size];
  const d = { xs: "w-2.5 h-2.5 text-[6px]", sm: "w-3.5 h-3.5 text-[8px]", md: "w-5 h-5 text-[11px]" }[size];
  const fg = tinta(m.cor);
  return (
    <span className={`inline-flex items-center rounded-md font-black uppercase tracking-wide whitespace-nowrap max-w-full ${s}`} style={{ background: m.cor, color: fg }}>
      {m.logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL pequena, sem otimização a fazer
        <img src={m.logo} alt="" className={`rounded-full object-cover flex-shrink-0 bg-white ${d}`} />
      ) : (
        <span className={`rounded-full flex items-center justify-center flex-shrink-0 ${d}`} style={{ background: fg, color: m.cor }}>
          {m.nome.trim().charAt(0) || "M"}
        </span>
      )}
      <span className="truncate">{m.nome}</span>
    </span>
  );
}

/** QR de mentira, mas com cara de QR (estável para o mesmo nome). */
function Qr({ seed, className = "" }: { seed: string; className?: string }) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const N = 21;
  const cells: ReactNode[] = [];
  const finder = (x: number, y: number) => x < 7 && y < 7;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (finder(x, y) || finder(N - 1 - x, y) || finder(x, N - 1 - y)) continue;
      h = Math.imul(h ^ (x * 31 + y), 16777619);
      if ((h >>> 0) % 2) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />);
    }
  const F = ({ x, y }: { x: number; y: number }) => (
    <g>
      <rect x={x} y={y} width="7" height="7" />
      <rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" />
      <rect x={x + 2} y={y + 2} width="3" height="3" />
    </g>
  );
  return (
    <svg viewBox="-1 -1 23 23" className={`bg-white ${className}`} shapeRendering="crispEdges" aria-hidden>
      <F x={0} y={0} />
      <F x={14} y={0} />
      <F x={0} y={14} />
      {cells}
    </svg>
  );
}

/** Pessoa em silhueta. */
function Pessoa({ className = "", cor = "#2b2b2b" }: { className?: string; cor?: string }) {
  return (
    <svg viewBox="0 0 40 50" className={className} aria-hidden>
      <circle cx="20" cy="13" r="9" fill={cor} />
      <path d="M3 50c0-12 7.6-20 17-20s17 8 17 20z" fill={cor} />
    </svg>
  );
}

/** Quadro 16:9 com o estúdio: telão, duas pessoas e a bancada. */
function Estudio({ m, children, logoNaBancada = false }: { m: MarcaInfo; children?: ReactNode; logoNaBancada?: boolean }) {
  return (
    <div className="relative aspect-video overflow-hidden rounded-lg bg-gradient-to-b from-[#141a24] to-[#07090c]">
      <div className="absolute inset-x-[18%] top-[8%] h-[34%] rounded-md bg-gradient-to-br from-[#1d2a3d] to-[#0e141d] border border-white/5" />
      <div className="absolute left-[6%] top-[10%] w-[3%] h-[60%] rounded-full bg-amber-400/30 blur-[2px]" />
      <div className="absolute right-[6%] top-[10%] w-[3%] h-[60%] rounded-full bg-amber-400/30 blur-[2px]" />
      <Pessoa className="absolute left-[20%] bottom-[22%] w-[17%]" cor="#3a3f48" />
      <Pessoa className="absolute right-[20%] bottom-[22%] w-[17%]" cor="#3a3f48" />
      <div className="absolute inset-x-[12%] bottom-0 h-[26%] rounded-t-xl bg-gradient-to-b from-[#24262b] to-[#15161a] border-t border-white/10 flex items-center justify-center">
        {logoNaBancada && <Logo m={m} size="sm" />}
      </div>
      <span className="absolute left-[3%] top-[5%] text-[8px] font-black text-amber-400">PFC</span>
      <span className="absolute right-[3%] top-[5%] text-[7px] font-bold bg-red-600 text-white px-1 rounded-sm">AO VIVO</span>
      {children}
    </div>
  );
}

/** Celular em pé com tela 9:16. */
function Celular({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mx-auto w-[46%] min-w-[120px] rounded-[18px] border-[3px] border-[#2a2a2a] bg-black p-[3px] ${className}`}>
      <div className="relative aspect-[9/16] overflow-hidden rounded-[13px]">{children}</div>
    </div>
  );
}

function Tela({ id, m }: { id: PlacementId; m: MarcaInfo }) {
  const quadro = m.quadro || "Seu quadro";
  switch (id) {
    case "vinheta":
      return (
        <div className="relative aspect-video overflow-hidden rounded-lg bg-[radial-gradient(circle_at_50%_40%,#1f3a2b,#050806_70%)] flex flex-col items-center justify-center gap-2 text-center px-4">
          <span className="text-[7px] font-bold tracking-[0.3em] text-white/50">PFC | PAPO FORA DA CAIXA</span>
          <span className="text-white font-black text-base sm:text-lg leading-none uppercase">{quadro}</span>
          <span className="text-white/60 text-[9px] italic">apresentado por</span>
          <Logo m={m} size="md" />
        </div>
      );
    case "estudio":
      return (
        <Estudio m={m} logoNaBancada>
          <div className="absolute inset-x-[18%] top-[8%] h-[34%] flex items-center justify-center">
            <Logo m={m} size="xs" />
          </div>
        </Estudio>
      );
    case "mencao":
      return (
        <Estudio m={m}>
          <div className="absolute left-[24%] top-[14%] max-w-[46%] rounded-lg rounded-bl-none bg-white text-[#111] text-[8px] leading-tight px-2 py-1 shadow">
            “Esse episódio tem o apoio da <b>{m.nome}</b>…”
          </div>
          <div className="absolute left-[3%] bottom-[6%] flex items-stretch shadow-lg">
            <span className="bg-amber-400 text-black text-[7px] font-black px-1.5 flex items-center uppercase">Oferecimento</span>
            <span className="bg-black/85 px-1.5 py-1 flex items-center">
              <Logo m={m} size="xs" />
            </span>
          </div>
        </Estudio>
      );
    case "qr":
      return (
        <Estudio m={m}>
          <div className="absolute right-[3%] bottom-[6%] w-[22%] rounded-md bg-black/85 p-1.5 flex flex-col items-center gap-1 shadow-lg">
            <Qr seed={m.nome} className="w-full rounded-sm" />
            <span className="text-[6px] text-white/80 text-center leading-tight">Aponte a câmera</span>
            <Logo m={m} size="xs" />
          </div>
        </Estudio>
      );
    case "thumb":
      return (
        <div>
          <div className="relative aspect-video overflow-hidden rounded-lg bg-gradient-to-br from-[#0f2a1b] via-[#0a0f0c] to-[#1d1405]">
            <Pessoa className="absolute left-[4%] bottom-0 w-[30%]" cor="#55606b" />
            <Pessoa className="absolute right-[30%] bottom-0 w-[26%]" cor="#46505a" />
            <div className="absolute right-[3%] top-[18%] w-[42%] text-right font-black uppercase leading-[0.95]">
              <span className="block text-white text-[13px]">O treino</span>
              <span className="block text-[#f3e6c8] text-[15px]">que mudou tudo</span>
            </div>
            <div className="absolute right-[3%] top-[5%] flex items-center gap-1 rounded bg-black/70 px-1 py-0.5">
              <span className="text-[6px] text-white/70">apresentado por</span>
              <Logo m={m} size="xs" />
            </div>
            <span className="absolute right-[2%] bottom-[4%] text-[7px] bg-black/80 text-white px-1 rounded-sm">58:12</span>
          </div>
          <div className="mt-1.5 flex gap-1.5">
            <span className="w-4 h-4 rounded-full bg-amber-400 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-[9px] text-white font-semibold leading-tight truncate">{quadro} | O treino que mudou tudo</div>
              <div className="text-[8px] text-white/40">Papo Fora da Caixa · 2,1 mil visualizações</div>
            </div>
          </div>
        </div>
      );
    case "short":
      return (
        <Celular>
          <div className="absolute inset-0 bg-gradient-to-b from-[#1b2230] to-[#06070a]" />
          <Pessoa className="absolute left-1/2 -translate-x-1/2 bottom-[24%] w-[62%]" cor="#3d4450" />
          <div className="absolute inset-x-[8%] top-[16%] text-center">
            <span className="bg-white text-black text-[9px] font-black px-1 leading-snug">ISSO NINGUÉM TE CONTA</span>
          </div>
          <div className="absolute left-[6%] bottom-[6%] right-[18%] flex flex-col gap-1">
            <span className="text-[7px] text-white font-bold">@papoforadacaixapdc</span>
            <span className="text-[7px] text-white/80">Oferecimento</span>
            <Logo m={m} size="xs" />
          </div>
          <div className="absolute right-[5%] bottom-[10%] flex flex-col gap-2 items-center">
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-3 h-3 rounded-full bg-white/70" />
            ))}
          </div>
        </Celular>
      );
    case "story":
      return (
        <Celular>
          <div className="absolute inset-0 bg-gradient-to-br from-[#3b1d5a] via-[#121018] to-[#3a2205]" />
          <div className="absolute inset-x-[5%] top-[2.5%] flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className={`h-[2px] flex-1 rounded ${i === 0 ? "bg-white" : "bg-white/30"}`} />
            ))}
          </div>
          <div className="absolute left-[5%] top-[5%] flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-amber-400" />
            <span className="text-[7px] text-white font-semibold">papoforadacaixapdc</span>
          </div>
          <Pessoa className="absolute left-1/2 -translate-x-1/2 top-[22%] w-[55%]" cor="#55505e" />
          <div className="absolute inset-x-[8%] top-[60%] text-center text-white text-[9px] font-black leading-tight">
            Hoje tem episódio novo!
          </div>
          <div className="absolute inset-x-0 top-[70%] flex justify-center">
            <span className="flex items-center gap-1 rounded-md bg-white px-1.5 py-1 text-[8px] font-bold text-[#2563eb]">
              🔗 {m.nome.toUpperCase()}
            </span>
          </div>
        </Celular>
      );
    case "collab":
      return (
        <div className="mx-auto w-[58%] min-w-[150px] rounded-lg border border-[#2a2a2a] bg-black overflow-hidden">
          <div className="flex items-center gap-1.5 p-1.5">
            <span className="flex -space-x-1.5">
              <span className="w-4 h-4 rounded-full bg-amber-400 border border-black" />
              {m.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.logo} alt="" className="w-4 h-4 rounded-full border border-black object-cover" />
              ) : (
                <span className="w-4 h-4 rounded-full border border-black" style={{ background: m.cor }} />
              )}
            </span>
            <span className="text-[8px] text-white leading-tight truncate">
              <b>papoforadacaixapdc</b> e <b>{slug(m.nome).replace(/-/g, "")}</b>
            </span>
          </div>
          <div className="relative aspect-square bg-gradient-to-br from-[#1b2230] to-[#07090c]">
            <Pessoa className="absolute left-[12%] bottom-0 w-[36%]" cor="#46505a" />
            <Pessoa className="absolute right-[12%] bottom-0 w-[36%]" cor="#55606b" />
            <div className="absolute top-[8%] inset-x-0 flex justify-center">
              <Logo m={m} size="sm" />
            </div>
          </div>
          <div className="p-1.5 text-[8px] text-white/60">♥ 💬 ➤ · aparece nos dois perfis</div>
        </div>
      );
    case "descricao":
      return (
        <div className="rounded-lg bg-[#1f1f1f] p-3 text-[9px] leading-relaxed text-white/80 font-sans">
          <div className="text-white font-semibold text-[10px]">2,1 mil visualizações · há 3 dias</div>
          <p className="mt-1">No episódio de hoje, a conversa é sobre treino, rotina e competição…</p>
          <p className="mt-2">
            🏆 Este episódio tem o apoio da <b className="text-white">{m.nome}</b>
            <br />
            👉 <span className="text-[#3ea6ff]">pfctv.com.br/parceiros/{slug(m.nome)}</span>
          </p>
          <p className="mt-2 text-white/40">#PapoForaDaCaixa #MogiGuaçu</p>
        </div>
      );
    case "creditos":
      return (
        <div className="relative aspect-video overflow-hidden rounded-lg bg-[#07090c] flex flex-col items-center pt-[12%] gap-2">
          <span className="text-[8px] tracking-[0.3em] text-white/40 uppercase">Apoio</span>
          <div className="flex flex-wrap justify-center gap-1.5 px-4">
            <span className="text-[8px] text-white/30 border border-white/10 rounded px-2 py-1">MARCA</span>
            <Logo m={m} size="sm" />
            <span className="text-[8px] text-white/30 border border-white/10 rounded px-2 py-1">MARCA</span>
          </div>
          <div className="absolute bottom-[8%] inset-x-[18%] h-[30%] flex gap-2">
            <span className="flex-1 rounded bg-white/5 border border-white/10 text-[6px] text-white/30 p-1">Próximo episódio</span>
            <span className="flex-1 rounded bg-white/5 border border-white/10 text-[6px] text-white/30 p-1">Inscreva-se</span>
          </div>
        </div>
      );
    case "pagina":
      return (
        <Celular>
          <div className="absolute inset-0 bg-[#0d0d0d]" />
          <div className="absolute inset-x-0 top-0 bg-[#1f1f1f] px-1.5 py-1 text-[6px] text-white/60 truncate">
            🔒 pfctv.com.br/parceiros/{slug(m.nome)}
          </div>
          <div className="absolute inset-x-0 top-[6%] h-[30%]" style={{ background: `linear-gradient(160deg, ${m.cor}, #0d0d0d)` }} />
          <div className="absolute inset-x-[8%] top-[22%] flex flex-col items-start gap-1.5">
            <Logo m={m} size="xs" />
            <span className="text-white text-[9px] font-black leading-tight">Parceiro oficial do Papo Fora da Caixa</span>
            <span className="text-white/50 text-[7px] leading-tight">Endereço, horário e as condições para quem veio pelo programa.</span>
          </div>
          <div className="absolute inset-x-[8%] bottom-[16%] flex flex-col gap-1">
            <span className="rounded-md bg-[#25d366] text-black text-[8px] font-bold text-center py-1">Chamar no WhatsApp</span>
            <span className="rounded-md border border-white/20 text-white/70 text-[8px] text-center py-1">Ver no mapa</span>
          </div>
        </Celular>
      );
    case "relatorio":
      return (
        <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-3">
          <div className="flex items-center justify-between">
            <Logo m={m} size="xs" />
            <span className="text-[8px] text-white/40">Relatório · outubro</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 mt-2">
            {[
              ["18,4 mil", "views das peças"],
              ["312", "leituras do QR"],
              ["47", "cliques no WhatsApp"],
            ].map(([n, l]) => (
              <div key={l} className="rounded bg-white/[0.04] p-1.5">
                <div className="text-amber-400 font-black text-[11px]">{n}</div>
                <div className="text-white/40 text-[7px] leading-tight">{l}</div>
              </div>
            ))}
          </div>
          <div className="flex items-end gap-0.5 h-8 mt-2">
            {[30, 45, 38, 60, 52, 80, 70, 95, 64, 72, 88, 100].map((v, i) => (
              <span key={i} className="flex-1 rounded-t bg-amber-400/70" style={{ height: `${v}%` }} />
            ))}
          </div>
          <div className="text-[7px] text-white/30 mt-1">Números ilustrativos</div>
        </div>
      );
    case "visita":
      return (
        <div className="relative aspect-video overflow-hidden rounded-lg bg-gradient-to-b from-[#2a3b52] to-[#14181f]">
          <div className="absolute inset-x-[10%] bottom-0 top-[22%] bg-[#e9e2d4] rounded-t-sm" />
          <div className="absolute inset-x-[10%] top-[22%] h-[12%] flex">
            {Array.from({ length: 10 }).map((_, i) => (
              <span key={i} className="flex-1" style={{ background: i % 2 ? "#fff" : m.cor }} />
            ))}
          </div>
          <div className="absolute inset-x-0 top-[8%] flex justify-center">
            <Logo m={m} size="sm" />
          </div>
          <div className="absolute left-[16%] bottom-0 w-[30%] h-[46%] bg-[#9fb7c9]/70 border-2 border-[#c9c2b4]" />
          <div className="absolute right-[16%] bottom-0 w-[18%] h-[52%] bg-[#6b5745] border-2 border-[#c9c2b4]" />
          <Pessoa className="absolute left-[40%] bottom-0 w-[16%]" cor="#2b2b2b" />
          <Pessoa className="absolute left-[52%] bottom-0 w-[15%]" cor="#3a3a3a" />
          <span className="absolute left-[3%] top-[5%] text-[7px] font-black bg-[#22c55e] text-[#06210f] px-1 rounded-sm">PFC VISITA</span>
          <span className="absolute right-[3%] top-[5%] text-[7px] text-white/70">● REC</span>
        </div>
      );
  }
}

export function PlacementMockup({ id, marca }: { id: PlacementId; marca: MarcaInfo }) {
  return <Tela id={id} m={{ ...marca, nome: marca.nome.trim() || "Sua marca" }} />;
}

/** Galeria: mockup + título + onde + explicação. `origem` diz de qual item cada placement vem. */
export function PlacementGallery({
  ids,
  marca,
  origem,
  colunas = 3,
}: {
  ids: PlacementId[];
  marca: MarcaInfo;
  origem?: Partial<Record<PlacementId, string[]>>;
  /** 2 quando a galeria fica numa coluna estreita (Monte seu plano). */
  colunas?: 2 | 3;
}) {
  return (
    <div className={`grid sm:grid-cols-2 gap-4 ${colunas === 3 ? "xl:grid-cols-3" : ""}`}>
      {ids.map((id) => {
        const p = PLACEMENTS[id];
        return (
          <figure key={id} id={`placement-${id}`} className="scroll-mt-28 rounded-2xl border border-[#2a2a2a] bg-[#111] p-3 flex flex-col gap-3">
            <div className="rounded-xl bg-[#050505] p-3 flex items-center justify-center min-h-[150px]">
              <div className="w-full">
                <PlacementMockup id={id} marca={marca} />
              </div>
            </div>
            <figcaption className="px-1 pb-1">
              <div className="text-white font-bold text-sm">{p.titulo}</div>
              <div className="text-gold-500/80 text-[11px] font-semibold mt-0.5">{p.onde}</div>
              <p className="text-white/45 text-xs leading-relaxed mt-1.5">{p.descricao}</p>
              {origem?.[id]?.length ? (
                <p className="text-white/30 text-[10px] mt-1.5">Vem de: {origem[id]!.join(", ")}</p>
              ) : null}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

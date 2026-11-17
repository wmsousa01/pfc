"use client";

import { useEffect, useRef, useState } from "react";
import type { EstadoTela, ItemTela, Posicao } from "@/lib/ao-vivo/tipos";

const POLL_NO_AR_MS = 1000;
const POLL_PARADO_MS = 3000;
const SAIDA_MS = 500;
/** Dois logos no mesmo canto se revezam. */
const RODIZIO_MS = 8000;

type Vivo = ItemTela & { saindo: boolean };

/**
 * Fonte de navegador do OBS (1920×1080, fundo transparente). A cena é
 * montada uma vez; o servidor decide o que aparece. Tudo é medido em vw,
 * então a arte acompanha o tamanho da fonte.
 *
 * Sem rede, o que está no ar continua: a tela nunca some por queda de conexão.
 * ?teste=1 põe um fundo escuro e o status, para conferir no navegador.
 */
export default function AoVivoTela({ token, teste }: { token: string; teste: boolean }) {
  const [canto, setCanto] = useState<Vivo[]>([]);
  const [destaque, setDestaque] = useState<Vivo[]>([]);
  const [status, setStatus] = useState("conectando");
  const [giro, setGiro] = useState(0);

  useEffect(() => {
    const fundo = teste ? "#1b1f24" : "transparent";
    document.documentElement.style.background = fundo;
    document.body.style.background = fundo;
    document.body.style.overflow = "hidden";
    document.body.style.cursor = "none";
  }, [teste]);

  useEffect(() => {
    const t = setInterval(() => setGiro((g) => g + 1), RODIZIO_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let vivo = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      let espera = POLL_PARADO_MS;
      try {
        const r = await fetch(`/api/ao-vivo/tela/${token}`, { cache: "no-store" });
        if (r.ok) {
          const e = (await r.json()) as EstadoTela;
          if (!vivo) return;
          espera = e.sessao ? POLL_NO_AR_MS : POLL_PARADO_MS;
          setStatus(e.sessao ? `live ${e.sessao.status}` : "sem live no ar");
          setCanto((cs) => trocar(cs, e.canto));
          setDestaque((ds) => trocar(ds, e.destaque ? [e.destaque] : []));
        } else {
          setStatus(`erro ${r.status}`);
        }
      } catch {
        setStatus("sem rede: mantendo a tela");
      }
      if (vivo) timer = setTimeout(poll, espera);
    }
    poll();
    return () => {
      vivo = false;
      clearTimeout(timer);
    };
  }, [token]);

  // Quem saiu fica o tempo da animação de saída e depois é removido.
  useEffect(() => {
    if (!canto.some((c) => c.saindo) && !destaque.some((d) => d.saindo)) return;
    const t = setTimeout(() => {
      setCanto((cs) => cs.filter((c) => !c.saindo));
      setDestaque((ds) => ds.filter((d) => !d.saindo));
    }, SAIDA_MS);
    return () => clearTimeout(t);
  }, [canto, destaque]);

  const vinheta = destaque.find((d) => d.tipo === "vinheta" && !d.saindo);
  const porCanto = new Map<Posicao, Vivo[]>();
  for (const c of canto) porCanto.set(c.posicao, [...(porCanto.get(c.posicao) ?? []), c]);

  return (
    <div className="fixed inset-0 overflow-hidden select-none" style={{ fontFamily: "Inter, Arial, sans-serif" }}>
      <style>{CSS}</style>
      {!vinheta &&
        Array.from(porCanto.entries()).map(([pos, itens]) => {
          const ativos = itens.filter((i) => !i.saindo);
          const mostra = ativos.length ? ativos[giro % ativos.length] : itens[0];
          return <Logo key={`${pos}-${mostra.id}`} item={mostra} saindo={mostra.saindo || !ativos.length} />;
        })}
      {destaque.map((d) =>
        d.tipo === "vinheta" ? (
          <Vinheta key={d.id} item={d} />
        ) : d.tipo === "qr" ? (
          <Qr key={d.id} item={d} />
        ) : (
          <Faixa key={d.id} item={d} />
        )
      )}
      {teste && (
        <div className="absolute top-3 left-3 text-white/70 text-sm bg-black/50 rounded px-2 py-1">
          Tela do OBS · {status}
        </div>
      )}
    </div>
  );
}

/** Mantém o que continua, marca a saída do que sumiu e acrescenta o que chegou. */
function trocar(atual: Vivo[], novos: ItemTela[]): Vivo[] {
  const ids = new Set(novos.map((n) => n.id));
  const fica = atual.map((a) => (ids.has(a.id) ? { ...a, saindo: false } : { ...a, saindo: true }));
  const tem = new Set(atual.map((a) => a.id));
  // A URL assinada muda de vez em quando: o item que já está no ar mantém a dele.
  return [...fica, ...novos.filter((n) => !tem.has(n.id)).map((n) => ({ ...n, saindo: false }))];
}

const anim = (saindo: boolean, entra: string) => ({
  animation: `${saindo ? "aoSai" : entra} ${saindo ? SAIDA_MS : 650}ms cubic-bezier(.2,.8,.2,1) both`,
});

const CANTO: Record<Posicao, React.CSSProperties> = {
  "superior-esquerdo": { top: "2.4vw", left: "2.4vw" },
  "superior-direito": { top: "2.4vw", right: "2.4vw" },
  "inferior-esquerdo": { bottom: "2.4vw", left: "2.4vw" },
  "inferior-direito": { bottom: "2.4vw", right: "2.4vw" },
};

function Logo({ item, saindo }: { item: Vivo; saindo: boolean }) {
  const arte = item.midia?.mime.startsWith("image/") ? item.midia.url : null;
  const logo = arte ?? item.parceiro.logo;
  return (
    <div className="absolute" style={{ ...CANTO[item.posicao], ...anim(saindo, "aoFade") }}>
      <div
        className="flex flex-col items-center"
        style={{
          background: "rgba(10,10,10,.55)",
          backdropFilter: "blur(6px)",
          borderRadius: "0.8vw",
          padding: "0.5vw 0.9vw 0.7vw",
          borderBottom: `0.18vw solid ${item.parceiro.cor}`,
        }}
      >
        <span
          style={{ fontSize: "0.62vw", letterSpacing: "0.18em", color: "rgba(255,255,255,.75)", fontWeight: 700 }}
          className="uppercase"
        >
          {item.texto || (item.momento === "continuo" ? "Apresentado por" : "Oferecimento")}
        </span>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" style={{ maxHeight: "3.4vw", maxWidth: "11vw", marginTop: "0.35vw", objectFit: "contain" }} />
        ) : (
          <span style={{ fontSize: "1.4vw", fontWeight: 800, color: "#fff", marginTop: "0.2vw" }}>{item.parceiro.nome}</span>
        )}
      </div>
    </div>
  );
}

function Faixa({ item }: { item: Vivo }) {
  const arte = item.midia?.mime.startsWith("image/") ? item.midia.url : null;
  if (arte)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={arte}
        alt=""
        className="absolute"
        style={{ left: "3vw", bottom: "4vw", maxWidth: "46vw", maxHeight: "14vw", ...anim(item.saindo, "aoEsq") }}
      />
    );
  return (
    <div className="absolute flex items-stretch" style={{ left: "3vw", bottom: "4vw", maxWidth: "60vw", ...anim(item.saindo, "aoEsq") }}>
      <div style={{ width: "0.5vw", background: item.parceiro.cor, borderRadius: "0.3vw 0 0 0.3vw" }} />
      {item.parceiro.logo && (
        <div className="flex items-center justify-center" style={{ background: "#fff", padding: "0.8vw 1.1vw" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.parceiro.logo} alt="" style={{ maxHeight: "4vw", maxWidth: "9vw", objectFit: "contain" }} />
        </div>
      )}
      <div
        className="flex flex-col justify-center"
        style={{ background: "rgba(12,12,12,.88)", padding: "0.8vw 1.6vw", borderRadius: "0 0.6vw 0.6vw 0" }}
      >
        <span className="uppercase" style={{ fontSize: "0.75vw", letterSpacing: "0.2em", color: item.parceiro.cor, fontWeight: 800 }}>
          Oferecimento · {item.parceiro.nome}
        </span>
        <span style={{ fontSize: "1.75vw", lineHeight: 1.15, color: "#fff", fontWeight: 800, marginTop: "0.2vw" }}>
          {item.texto || item.parceiro.nome}
        </span>
      </div>
    </div>
  );
}

function Qr({ item }: { item: Vivo }) {
  const arte = item.midia?.mime.startsWith("image/") ? item.midia.url : null;
  const pos: React.CSSProperties = { right: "3vw", top: "50%", transform: "translateY(-50%)" };
  if (arte)
    return (
      <div className="absolute" style={pos}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={arte} alt="" style={{ maxWidth: "24vw", maxHeight: "44vw", ...anim(item.saindo, "aoDir") }} />
      </div>
    );
  return (
    <div className="absolute" style={pos}>
      <div
        className="flex flex-col items-center"
        style={{
          width: "15vw",
          background: "#fff",
          borderRadius: "1vw",
          padding: "1.1vw",
          boxShadow: "0 1vw 3vw rgba(0,0,0,.45)",
          borderTop: `0.45vw solid ${item.parceiro.cor}`,
          ...anim(item.saindo, "aoDir"),
        }}
      >
        {item.parceiro.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.parceiro.logo} alt="" style={{ maxHeight: "3vw", maxWidth: "11vw", objectFit: "contain" }} />
        ) : (
          <span style={{ fontSize: "1.2vw", fontWeight: 800, color: "#111" }}>{item.parceiro.nome}</span>
        )}
        {item.qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.qr} alt="" style={{ width: "12.4vw", height: "12.4vw", marginTop: "0.7vw", imageRendering: "pixelated" }} />
        )}
        <span className="text-center" style={{ fontSize: "1vw", fontWeight: 800, color: "#111", marginTop: "0.5vw", lineHeight: 1.2 }}>
          {item.texto || "Aponte a câmera do celular"}
        </span>
        {item.link && (
          <span style={{ fontSize: "0.7vw", color: "#555", marginTop: "0.3vw" }}>{item.link}</span>
        )}
      </div>
    </div>
  );
}

function Vinheta({ item }: { item: Vivo }) {
  const ref = useRef<HTMLVideoElement>(null);
  // O OBS toca com som (marque "Controlar áudio via OBS"); o navegador comum
  // bloqueia autoplay com som, então cai para mudo em vez de não tocar.
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = false;
    v.play().catch(() => {
      v.muted = true;
      v.play().catch(() => undefined);
    });
  }, []);
  if (!item.midia) return null;
  if (item.midia.mime.startsWith("image/"))
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={item.midia.url} alt="" className="absolute inset-0 w-full h-full object-contain" style={anim(item.saindo, "aoFade")} />
    );
  return (
    <video
      ref={ref}
      src={item.midia.url}
      playsInline
      className="absolute inset-0 w-full h-full object-contain"
      style={{ background: "#000", ...anim(item.saindo, "aoFade") }}
    />
  );
}

const CSS = `
@keyframes aoFade { from { opacity: 0 } to { opacity: 1 } }
@keyframes aoEsq { from { opacity: 0; transform: translateX(-4vw) } to { opacity: 1; transform: none } }
@keyframes aoDir { from { opacity: 0; transform: translateX(4vw) } to { opacity: 1; transform: none } }
@keyframes aoSai { from { opacity: 1 } to { opacity: 0 } }
`;

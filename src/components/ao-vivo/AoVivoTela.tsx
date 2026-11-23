"use client";

import { useEffect, useRef, useState } from "react";
import { ANIMACAO_L_MS, ESCALA_L, ObsPrograma, configDoHash, type ObsStatus } from "@/lib/ao-vivo/obs";
import type { EstadoTela, ItemTela, Posicao } from "@/lib/ao-vivo/tipos";

const POLL_NO_AR_MS = 1000;
const POLL_PARADO_MS = 3000;
const SAIDA_MS = ANIMACAO_L_MS;
/** O que sobra para o patrocinador no L, em vw (a fonte é 16:9). */
const L_DIREITA = (1 - ESCALA_L) * 100;
const L_BAIXO = (1 - ESCALA_L) * 56.25;
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
  const [obsStatus, setObsStatus] = useState<ObsStatus | null>(null);
  const obs = useRef<ObsPrograma | null>(null);
  const placasBaixadas = useRef(new Set<string>());

  // A senha do OBS vem depois do # na URL da fonte; sem ela, o L só cobre as bordas.
  useEffect(() => {
    const cfg = configDoHash(window.location.hash);
    if (!cfg) return;
    const o = new ObsPrograma(cfg, setObsStatus);
    obs.current = o;
    o.iniciar();
    return () => {
      o.parar();
      obs.current = null;
    };
  }, []);

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
          for (const id of e.placasDaFila) {
            if (placasBaixadas.current.has(id)) continue;
            placasBaixadas.current.add(id);
            new Image().src = `/ao-vivo/tela/${token}/placa/${id}`;
          }
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
  const emL = destaque.some((d) => d.tipo === "l" && !d.saindo);
  useEffect(() => obs.current?.espremer(emL), [emL, obsStatus]);
  const porCanto = new Map<Posicao, Vivo[]>();
  for (const c of canto) porCanto.set(c.posicao, [...(porCanto.get(c.posicao) ?? []), c]);

  return (
    <div className="fixed inset-0 overflow-hidden select-none" style={{ fontFamily: "Inter, Arial, sans-serif" }}>
      <style>{CSS}</style>
      {/* No L, os logos acompanham o vídeo encolhido em vez de cair sobre a arte. */}
      <div
        className="absolute top-0 left-0"
        style={{
          right: emL ? `${L_DIREITA}vw` : 0,
          bottom: emL ? `${L_BAIXO}vw` : 0,
          transition: `right ${ANIMACAO_L_MS}ms ${CURVA_L}, bottom ${ANIMACAO_L_MS}ms ${CURVA_L}`,
        }}
      >
        {!vinheta &&
          Array.from(porCanto.entries()).map(([pos, itens]) => {
            const ativos = itens.filter((i) => !i.saindo);
            const mostra = ativos.length ? ativos[giro % ativos.length] : itens[0];
            return <Logo key={`${pos}-${mostra.id}`} item={mostra} saindo={mostra.saindo || !ativos.length} />;
          })}
      </div>
      {destaque.map((d) =>
        d.tipo === "vinheta" ? (
          <Vinheta key={d.id} item={d} />
        ) : d.tipo === "l" ? (
          <InsercaoL key={d.id} item={d} />
        ) : d.tipo === "qr" ? (
          <Qr key={d.id} item={d} token={token} />
        ) : (
          <Faixa key={d.id} item={d} />
        )
      )}
      {teste && (
        <div className="absolute top-3 left-3 text-white/70 text-sm bg-black/50 rounded px-2 py-1">
          Tela do OBS · {status}{obsStatus ? ` · OBS: ${obsStatus}` : ""}
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

const CURVA_L = "cubic-bezier(.45,0,.55,1)";

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
          {/* Altura fixa: SVG sem tamanho próprio encolhia a zero dentro da faixa. */}
          <img src={item.parceiro.logo} alt="" style={{ height: "3.6vw", width: "auto", maxWidth: "9vw", objectFit: "contain" }} />
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

/** Canto superior esquerdo, com 463 px de altura em 1080: o lugar da placa usada hoje no OBS. */
const POS_PLACA: React.CSSProperties = { left: 0, top: 0 };
const ALTURA_PLACA = "24.1vw";

function Qr({ item, token }: { item: Vivo; token: string }) {
  const [carregou, setCarregou] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const arte = item.midia?.mime.startsWith("image/") ? item.midia.url : null;

  if (!falhou)
    return (
      <div className="absolute" style={{ ...POS_PLACA, visibility: carregou ? "visible" : "hidden", ...(carregou ? anim(item.saindo, "aoEsq") : {}) }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={arte ?? `/ao-vivo/tela/${token}/placa/${item.id}`}
          alt=""
          onLoad={() => setCarregou(true)}
          onError={() => setFalhou(true)}
          style={{ height: ALTURA_PLACA, width: "auto", display: "block" }}
        />
      </div>
    );

  // A placa não gerou: o QR simples garante a entrega do parceiro.
  return (
    <div
      className="absolute flex flex-col items-center"
      style={{
        ...POS_PLACA,
        width: "13vw",
        background: "#fff",
        borderRadius: "0.8vw",
        padding: "0.8vw",
        borderTop: `0.35vw solid ${item.parceiro.cor}`,
        ...anim(item.saindo, "aoEsq"),
      }}
    >
      {item.qr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.qr} alt="" style={{ width: "11.4vw", height: "11.4vw", imageRendering: "pixelated" }} />
      )}
      <span className="text-center" style={{ fontSize: "0.9vw", fontWeight: 800, color: "#111", marginTop: "0.4vw", lineHeight: 1.2 }}>
        {item.texto || "Aponte a câmera do celular"}
      </span>
      {item.link && <span style={{ fontSize: "0.62vw", color: "#555", marginTop: "0.2vw" }}>{item.link}</span>}
    </div>
  );
}

/** Coluna da direita e faixa de baixo; o buraco do L é onde o vídeo encolhido fica. */
function InsercaoL({ item }: { item: Vivo }) {
  const arte = item.midia?.mime.startsWith("image/") ? item.midia.url : null;
  const painel = (entra: string, sai: string): React.CSSProperties => ({
    background: item.parceiro.fundo,
    animation: `${item.saindo ? sai : entra} ${ANIMACAO_L_MS}ms ${CURVA_L} both`,
  });
  return (
    <>
      <div
        className="absolute flex flex-col items-center"
        style={{
          top: 0,
          right: 0,
          bottom: 0,
          width: `${L_DIREITA}vw`,
          padding: "1.6vw 1.4vw",
          borderLeft: `0.22vw solid ${item.parceiro.cor}`,
          ...painel("aoLDir", "aoLDirSai"),
        }}
      >
        <span className="uppercase" style={{ fontSize: "0.9vw", letterSpacing: "0.22em", fontWeight: 800, color: "rgba(255,255,255,.8)" }}>
          Oferecimento
        </span>
        <div className="flex-1 min-h-0 w-full flex flex-col items-center justify-center" style={{ margin: "1vw 0" }}>
          {arte ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={arte} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          ) : (
            item.qr && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.qr} alt="" style={{ width: "15vw", height: "15vw", borderRadius: "0.6vw", imageRendering: "pixelated" }} />
                <span style={{ fontSize: "1.05vw", fontWeight: 800, color: "#fff", marginTop: "0.8vw" }}>Aponte a câmera</span>
                {item.link && <span style={{ fontSize: "0.72vw", color: "rgba(255,255,255,.7)", marginTop: "0.2vw" }}>{item.link}</span>}
              </>
            )
          )}
        </div>
        {/* Placa branca: logo escuro sumiria no fundo da marca. */}
        <div className="flex items-center justify-center" style={{ background: "#fff", borderRadius: "0.7vw", padding: "0.7vw 1vw", width: "100%", height: "6.4vw" }}>
          {item.parceiro.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.parceiro.logo} alt={item.parceiro.nome} style={{ height: "100%", width: "auto", maxWidth: "100%", objectFit: "contain" }} />
          ) : (
            <span style={{ fontSize: "1.7vw", fontWeight: 800, color: "#111" }}>{item.parceiro.nome}</span>
          )}
        </div>
      </div>
      <div
        className="absolute flex flex-col justify-center"
        style={{
          left: 0,
          bottom: 0,
          width: `${100 - L_DIREITA}vw`,
          height: `${L_BAIXO}vw`,
          padding: "0.8vw 2.4vw",
          borderTop: `0.22vw solid ${item.parceiro.cor}`,
          ...painel("aoLBaixo", "aoLBaixoSai"),
        }}
      >
        <span style={{ fontSize: "3vw", lineHeight: 1.12, fontWeight: 800, color: "#fff" }}>{item.texto || item.parceiro.nome}</span>
        {item.legenda && (
          <span style={{ fontSize: "0.78vw", lineHeight: 1.3, color: "rgba(255,255,255,.72)", marginTop: "0.6vw" }}>{item.legenda}</span>
        )}
      </div>
    </>
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
@keyframes aoLDir { from { transform: translateX(100%) } to { transform: none } }
@keyframes aoLBaixo { from { transform: translateY(100%) } to { transform: none } }
@keyframes aoLDirSai { from { transform: none } to { transform: translateX(100%) } }
@keyframes aoLBaixoSai { from { transform: none } to { transform: translateY(100%) } }
`;

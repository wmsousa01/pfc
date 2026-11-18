"use client";

import { useEffect, useRef, useState } from "react";

type Midia = { id: string; mime: string };
type Camada = Midia & { visivel: boolean };
export type GcJornal = { chapeu: string | null; titulo: string; manchete: string | null };
export type EstadoJornal = { tela: Midia | null; gc: GcJornal | null; credito: string | null };

const POLL_MS = 1500;
const FADE_MS = 450;
const AMARELO = "#fcc43e";
const LARANJA = "#fd9429";
/** Largura útil do texto do GC, em vw. */
const LARGURA_GC = 72;

/** Reduz a letra em vez de cortar a frase: os títulos do roteiro variam muito de tamanho. */
const fonteQueCabe = (texto: string, maximo: number, larguraDaLetra: number) =>
  Math.min(maximo, LARGURA_GC / (Math.max(texto.length, 1) * larguraDaLetra));

/**
 * Tela de telejornal do PFC News: fonte de navegador do OBS (1920×1080,
 * transparente) por cima da câmera. A imagem da notícia fica numa janela ao
 * lado do apresentador e o GC embaixo, os dois seguindo o bloco marcado no
 * espelho. Sem rede, o que está no ar continua.
 *
 * ?so=imagem ou ?so=gc separa em duas fontes, para ligar e desligar cada uma
 * no OBS. ?lado=esquerda muda a janela de lado. ?previa=N mostra o bloco N
 * sem marcar nada no ar.
 */
export default function EspelhoJornal({
  token,
  inicial,
  so,
  lado,
  previa,
}: {
  token: string;
  inicial: EstadoJornal;
  so: "imagem" | "gc" | null;
  lado: "direita" | "esquerda";
  previa: boolean;
}) {
  const [camadas, setCamadas] = useState<Camada[]>(inicial.tela ? [{ ...inicial.tela, visivel: true }] : []);
  const [gc, setGc] = useState(inicial.gc);
  const [credito, setCredito] = useState(inicial.credito);
  const alvo = useRef<string | null>(inicial.tela?.id ?? null);
  const src = (id: string) => `/espelho/${token}/img/${id}`;

  useEffect(() => {
    const fundo = previa ? "#2a2f36" : "transparent";
    document.documentElement.style.background = fundo;
    document.body.style.background = fundo;
    document.body.style.overflow = "hidden";
    document.body.style.cursor = "none";
  }, [previa]);

  useEffect(() => {
    if (previa) return;
    let vivo = true;
    async function poll() {
      try {
        const r = await fetch(`/api/espelho/${token}`, { cache: "no-store" });
        if (!r.ok) return;
        const { tela, jornal } = (await r.json()) as { tela: Midia | null; jornal: Omit<EstadoJornal, "tela"> };
        if (!vivo) return;
        setGc(jornal.gc);
        setCredito(jornal.credito);
        if ((tela?.id ?? null) === alvo.current) return;
        alvo.current = tela?.id ?? null;
        if (!tela) {
          setCamadas((cs) => cs.map((c) => ({ ...c, visivel: false })));
          setTimeout(() => vivo && alvo.current === null && setCamadas([]), FADE_MS);
          return;
        }
        setCamadas((cs) => [...cs.filter((c) => c.id !== tela.id), { ...tela, visivel: false }]);
      } catch {
        // Sem rede: a imagem e o GC que estão no ar continuam.
      }
    }
    const t = setInterval(poll, POLL_MS);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [token, previa]);

  /** A imagem nova só aparece depois de carregada, por cima da anterior. */
  function carregou(id: string) {
    if (alvo.current !== id) return;
    setCamadas((cs) => cs.map((c) => (c.id === id ? { ...c, visivel: true } : c)));
    setTimeout(() => setCamadas((cs) => (alvo.current === id ? cs.filter((c) => c.id === id) : cs)), FADE_MS);
  }

  const janelaNoAr = camadas.some((c) => c.visivel);
  return (
    <div className="fixed inset-0 overflow-hidden select-none" style={{ fontFamily: "Inter, Arial, sans-serif" }}>
      <style>{CSS}</style>

      {so !== "gc" && camadas.length > 0 && (
        <div
          className="absolute overflow-hidden"
          style={{
            top: "4.5vw",
            [lado === "direita" ? "right" : "left"]: "2.6vw",
            width: "44vw",
            height: "24.75vw",
            background: "#0b0b0b",
            border: `0.2vw solid ${AMARELO}`,
            borderRadius: "0.5vw",
            boxShadow: "0 0.8vw 2.4vw rgba(0,0,0,.55)",
            opacity: janelaNoAr ? 1 : 0,
            transform: janelaNoAr ? "none" : "scale(.96)",
            transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
          }}
        >
          {camadas.map((c) => {
            const estilo = { opacity: c.visivel ? 1 : 0, transition: `opacity ${FADE_MS}ms ease` };
            return c.mime.startsWith("video/") ? (
              <video key={c.id} src={src(c.id)} autoPlay muted loop playsInline onLoadedData={() => carregou(c.id)} className="absolute inset-0 w-full h-full object-contain" style={estilo} />
            ) : (
              <div key={c.id} className="absolute inset-0" style={estilo}>
                {/* Foto em pé ou quadrada: o fundo desfocado preenche as laterais sem cortar a imagem. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src(c.id)} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ filter: "blur(1.6vw) brightness(.55)", transform: "scale(1.15)" }} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src(c.id)} alt="" onLoad={() => carregou(c.id)} className="absolute inset-0 w-full h-full object-contain" />
              </div>
            );
          })}
          {credito && (
            <span className="absolute" style={{ right: "0.5vw", bottom: "0.5vw", fontSize: "0.8vw", color: "#fff", background: "rgba(0,0,0,.65)", padding: "0.15vw 0.5vw", borderRadius: "0.25vw" }}>
              Foto: {credito}
            </span>
          )}
        </div>
      )}

      {so !== "imagem" && gc && <Gc key={gc.titulo} gc={gc} />}
    </div>
  );
}

function Gc({ gc }: { gc: GcJornal }) {
  return (
    <div className="absolute flex items-stretch" style={{ left: "2.6vw", right: "2.6vw", bottom: "2.2vw", height: "7.6vw", animation: "jornalEntra 550ms cubic-bezier(.2,.8,.2,1) both" }}>
      <div
        className="flex flex-col items-center justify-center shrink-0"
        style={{ width: "11.5vw", background: `linear-gradient(135deg, ${AMARELO}, ${LARANJA})`, borderRadius: "0.45vw 0 0 0.45vw", color: "#111", fontStyle: "italic", fontWeight: 900, lineHeight: 1 }}
      >
        <span style={{ fontSize: "2.5vw" }}>PFC</span>
        <span style={{ fontSize: "1.55vw", marginTop: "0.15vw" }}>NEWS</span>
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center" style={{ background: "rgba(10,10,10,.93)", borderRadius: "0 0.45vw 0.45vw 0", padding: "0.3vw 1.5vw", borderBottom: `0.2vw solid ${AMARELO}` }}>
        {gc.chapeu && (
          <span className="uppercase self-start" style={{ fontSize: "0.86vw", fontWeight: 900, letterSpacing: "0.1em", color: "#111", background: AMARELO, padding: "0.08vw 0.55vw", borderRadius: "0.18vw" }}>
            {gc.chapeu}
          </span>
        )}
        <span className="whitespace-nowrap overflow-hidden" style={{ fontSize: `${fonteQueCabe(gc.titulo, 2.5, 0.56)}vw`, lineHeight: 1.18, fontWeight: 800, color: "#fff", marginTop: "0.12vw" }}>
          {gc.titulo}
        </span>
        {gc.manchete && (
          <span className="whitespace-nowrap overflow-hidden" style={{ fontSize: `${fonteQueCabe(gc.manchete, 1.2, 0.5)}vw`, lineHeight: 1.25, color: "rgba(255,255,255,.82)" }}>
            {gc.manchete}
          </span>
        )}
      </div>
    </div>
  );
}

const CSS = `
@keyframes jornalEntra { from { opacity: 0; transform: translateY(2vw) } to { opacity: 1; transform: none } }
`;

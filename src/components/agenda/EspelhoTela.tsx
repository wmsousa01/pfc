"use client";

import { useEffect, useRef, useState } from "react";

type Midia = { id: string; mime: string };
type Camada = Midia & { visivel: boolean };

const POLL_MS = 1500;
const FADE_MS = 400;

/**
 * A tela que vai para o OBS. A imagem nova só entra depois de carregada,
 * por cima da anterior, com fade; sem conexão, a última imagem fica — a
 * tela nunca apaga no ar por causa da rede.
 */
export default function EspelhoTela({
  token,
  inicial,
  transparente,
  cobrir,
}: {
  token: string;
  inicial: Midia | null;
  transparente: boolean;
  cobrir: boolean;
}) {
  const [camadas, setCamadas] = useState<Camada[]>(inicial ? [{ ...inicial, visivel: true }] : []);
  const alvo = useRef<string | null>(inicial?.id ?? null);
  const src = (id: string) => `/espelho/${token}/img/${id}`;

  // O body do site é preto: na fonte do OBS com fundo transparente, ele também precisa sumir.
  useEffect(() => {
    const fundo = transparente ? "transparent" : "#000";
    document.documentElement.style.background = fundo;
    document.body.style.background = fundo;
    document.body.style.overflow = "hidden";
    document.body.style.cursor = "none";
  }, [transparente]);

  useEffect(() => {
    let vivo = true;
    async function poll() {
      try {
        const r = await fetch(`/api/espelho/${token}`, { cache: "no-store" });
        if (!r.ok) return;
        const { tela } = (await r.json()) as { tela: Midia | null };
        if (!vivo || (tela?.id ?? null) === alvo.current) return;
        alvo.current = tela?.id ?? null;
        if (!tela) {
          setCamadas((cs) => cs.map((c) => ({ ...c, visivel: false })));
          setTimeout(() => vivo && alvo.current === null && setCamadas([]), FADE_MS);
          return;
        }
        setCamadas((cs) => [...cs.filter((c) => c.id !== tela.id), { ...tela, visivel: false }]);
      } catch {
        // Sem rede: a imagem que está no ar continua.
      }
    }
    const t = setInterval(poll, POLL_MS);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [token]);

  /** A camada nova carregou: aparece por cima e as de baixo saem depois do fade. */
  function carregou(id: string) {
    if (alvo.current !== id) return;
    setCamadas((cs) => cs.map((c) => (c.id === id ? { ...c, visivel: true } : c)));
    setTimeout(() => setCamadas((cs) => (alvo.current === id ? cs.filter((c) => c.id === id) : cs)), FADE_MS);
  }

  const fit = cobrir ? "object-cover" : "object-contain";
  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: transparente ? "transparent" : "#000" }}>
      {camadas.map((c) => {
        const cls = `absolute inset-0 w-full h-full ${fit}`;
        const style = { opacity: c.visivel ? 1 : 0, transition: `opacity ${FADE_MS}ms ease` };
        return c.mime.startsWith("video/") ? (
          <video key={c.id} src={src(c.id)} autoPlay muted loop playsInline onLoadedData={() => carregou(c.id)} className={cls} style={style} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={c.id} src={src(c.id)} alt="" onLoad={() => carregou(c.id)} className={cls} style={style} />
        );
      })}
    </div>
  );
}

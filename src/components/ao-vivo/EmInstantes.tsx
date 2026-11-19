"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { EmInstantes as Dados } from "@/lib/ao-vivo/em-instantes";

const ATUALIZA_MS = 2 * 60_000;
const CHAMADA_MS = 8_000;
const MARINHO = "#051a2d";

const v = (px: number) => `${(px / 19.2).toFixed(3)}vw`;
const mmss = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600);
  const m = String(Math.floor((t % 3600) / 60)).padStart(2, "0");
  const ss = String(t % 60).padStart(2, "0");
  return h ? `${h}:${m}:${ss}` : `${m}:${ss}`;
};

/**
 * Cena "Em instantes" (1920×1080, fundo próprio). A contagem usa a hora do
 * servidor; a música continua sendo a fonte de áudio do OBS.
 */
export default function EmInstantes({ dados, thumb }: { dados: Dados; thumb: string }) {
  const router = useRouter();
  const offset = useRef(new Date(dados.agora).getTime() - Date.now());
  const [agora, setAgora] = useState(() => Date.now() + offset.current);
  const [vez, setVez] = useState(0);
  const [thumbOk, setThumbOk] = useState(true);

  useEffect(() => {
    offset.current = new Date(dados.agora).getTime() - Date.now();
  }, [dados.agora]);

  useEffect(() => {
    document.documentElement.style.background = MARINHO;
    document.body.style.background = MARINHO;
    document.body.style.overflow = "hidden";
    document.body.style.cursor = "none";
    const relogio = setInterval(() => setAgora(Date.now() + offset.current), 250);
    const chamada = setInterval(() => setVez((x) => x + 1), CHAMADA_MS);
    const atualiza = setInterval(() => router.refresh(), ATUALIZA_MS);
    return () => {
      clearInterval(relogio);
      clearInterval(chamada);
      clearInterval(atualiza);
    };
  }, [router]);

  const cor = dados.cor;
  const falta = dados.inicio ? (new Date(dados.inicio).getTime() - agora) / 1000 : null;
  const convidado = dados.convidados[0];
  const nomes = dados.convidados.map((c) => c.nome).join(" e ");
  const chamadas = [
    "Comenta aí: de onde você está assistindo?",
    `Deixa o like para o ${dados.quadro} chegar em mais gente`,
    "Ative o sininho para não perder as próximas lives",
    ...(nomes ? [`Manda sua pergunta para ${nomes} no chat`] : []),
  ];

  return (
    <div
      className="fixed inset-0 overflow-hidden select-none text-white"
      style={{ fontFamily: "Inter, Arial, sans-serif", background: `radial-gradient(110% 90% at 20% 15%, #0d3358 0%, ${MARINHO} 55%, #020c16 100%)` }}
    >
      <style>{`@keyframes eiTroca { from { opacity: 0; transform: translateY(${v(14)}) } to { opacity: 1; transform: none } }
@keyframes eiPulso { 0%, 100% { opacity: 1 } 50% { opacity: .35 } }`}</style>

      {/* Thumb do episódio */}
      <div className="absolute overflow-hidden" style={{ left: v(60), top: v(70), width: v(1152), height: v(648), borderRadius: v(20), border: `${v(5)} solid ${cor}`, boxShadow: `0 ${v(20)} ${v(60)} rgba(0,0,0,.55)`, background: "#0b2238" }}>
        {dados.temThumb && thumbOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" onError={() => setThumbOk(false)} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ fontSize: v(96), fontWeight: 900, color: cor }}>
            {dados.quadro}
          </div>
        )}
      </div>

      {/* Coluna da direita: em instantes, contagem e convidado */}
      <div className="absolute flex flex-col" style={{ left: v(1272), top: v(70), width: v(588), height: v(648) }}>
        <span className="uppercase flex items-center" style={{ fontSize: v(24), letterSpacing: "0.24em", fontWeight: 800, color: cor, gap: v(12) }}>
          <span className="rounded-full" style={{ width: v(16), height: v(16), background: "#ff3b30", animation: "eiPulso 1.4s ease-in-out infinite" }} />
          {dados.quadro}
        </span>
        <div style={{ fontSize: v(96), fontWeight: 900, lineHeight: 0.95, marginTop: v(14) }}>
          Em
          <br />
          instantes
        </div>
        {falta != null && (
          <div style={{ marginTop: v(28) }}>
            <div style={{ fontSize: v(22), color: "rgba(255,255,255,.7)", fontWeight: 600 }}>{falta > 0 ? "A live começa em" : "Começando agora"}</div>
            {falta > 0 && (
              <div className="tabular-nums" style={{ fontSize: v(110), fontWeight: 900, lineHeight: 1, color: cor, marginTop: v(4) }}>
                {mmss(falta)}
              </div>
            )}
          </div>
        )}
        {convidado && (
          <div className="flex items-center mt-auto" style={{ gap: v(20), padding: v(20), borderRadius: v(18), background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)" }}>
            {convidado.foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={convidado.foto} alt="" className="rounded-full object-cover shrink-0" style={{ width: v(104), height: v(104), border: `${v(4)} solid ${cor}` }} />
            ) : (
              <div className="rounded-full shrink-0" style={{ width: v(104), height: v(104), background: cor }} />
            )}
            <div className="min-w-0">
              <div className="uppercase" style={{ fontSize: v(18), letterSpacing: "0.2em", fontWeight: 800, color: cor }}>
                Convidado{dados.convidados.length > 1 ? "s" : ""}
              </div>
              <div className="truncate" style={{ fontSize: v(40), fontWeight: 900, lineHeight: 1.1 }}>{nomes}</div>
              {convidado.username && <div style={{ fontSize: v(24), color: "rgba(255,255,255,.75)" }}>@{convidado.username}</div>}
            </div>
          </div>
        )}
      </div>

      {/* Chamada para o chat, revezando */}
      <div className="absolute flex items-center" style={{ left: v(60), top: v(752), width: v(1800), height: v(90) }}>
        <span key={vez} style={{ fontSize: v(40), fontWeight: 800, animation: "eiTroca 600ms ease both" }}>
          <span style={{ color: cor }}>💬 </span>
          {chamadas[vez % chamadas.length]}
        </span>
      </div>

      {/* Oferecimento */}
      {dados.parceiros.length > 0 && (
        <div className="absolute flex items-center" style={{ left: 0, right: 0, bottom: 0, height: v(190), padding: `0 ${v(60)}`, gap: v(36), background: "rgba(0,0,0,.35)", borderTop: `${v(3)} solid ${cor}` }}>
          <span className="uppercase shrink-0" style={{ fontSize: v(22), letterSpacing: "0.24em", fontWeight: 800, color: "rgba(255,255,255,.8)" }}>
            Oferecimento
          </span>
          {dados.parceiros.map((p) => (
            <div key={p.nome} className="flex items-center justify-center shrink-0" style={{ height: v(120), width: v(300), background: "#fff", borderRadius: v(16), padding: `${v(14)} ${v(24)}` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.logo} alt={p.nome} style={{ height: "100%", width: "auto", maxWidth: "100%", objectFit: "contain" }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

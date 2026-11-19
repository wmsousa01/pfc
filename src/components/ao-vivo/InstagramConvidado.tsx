"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { InstagramTela } from "@/lib/ao-vivo/instagram";

/** Atualiza os dados de tempos em tempos sem recarregar a página (não pisca no ar). */
const ATUALIZA_MS = 5 * 60_000;
/** Com mais de um convidado, os perfis se revezam. */
const REVEZA_MS = 25_000;
const MARINHO = "#051a2d";

const numero = (n: number | null) =>
  n == null ? null : new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);

/**
 * Cena do OBS com o Instagram do convidado (1920×1080, fundo próprio).
 * Medidas em vw a partir de 1920. Os posts ficam à esquerda, onde a placa do
 * QR e a faixa dos patrocinadores podem cobrir; câmera e perfil à direita, fora delas.
 * A moldura da câmera é desenhada aqui; o vídeo é a fonte de câmera do OBS, posta por cima.
 */
export default function InstagramConvidado({ dados }: { dados: InstagramTela }) {
  const router = useRouter();
  const [vez, setVez] = useState(0);

  useEffect(() => {
    document.documentElement.style.background = MARINHO;
    document.body.style.background = MARINHO;
    document.body.style.overflow = "hidden";
    document.body.style.cursor = "none";
    const a = setInterval(() => router.refresh(), ATUALIZA_MS);
    const r = setInterval(() => setVez((v) => v + 1), REVEZA_MS);
    return () => {
      clearInterval(a);
      clearInterval(r);
    };
  }, [router]);

  const cor = dados.cor;
  const p = dados.perfis.length ? dados.perfis[vez % dados.perfis.length] : null;
  const v = (px: number) => `${(px / 19.2).toFixed(3)}vw`;

  return (
    <div
      className="fixed inset-0 overflow-hidden select-none text-white"
      style={{ fontFamily: "Inter, Arial, sans-serif", background: `radial-gradient(120% 90% at 85% 10%, #0d3358 0%, ${MARINHO} 55%, #020c16 100%)` }}
    >
      <div className="absolute" style={{ left: v(40), top: v(48) }}>
        <span className="uppercase" style={{ fontSize: v(22), letterSpacing: "0.22em", fontWeight: 800, color: cor }}>
          Instagram do convidado
        </span>
        <div style={{ fontSize: v(58), fontWeight: 900, lineHeight: 1.05, marginTop: v(4) }}>{p ? `@${p.username}` : dados.quadro}</div>
      </div>

      {/* Moldura da câmera: a fonte do OBS fica por cima, em 1305,150 com 560×315. */}
      <div className="absolute" style={{ left: v(1297), top: v(142), width: v(576), height: v(331), border: `${v(4)} solid ${cor}`, borderRadius: v(14), background: "#000" }}>
        <span className="absolute uppercase" style={{ left: v(14), top: v(-30), fontSize: v(16), letterSpacing: "0.2em", fontWeight: 800, color: cor }}>
          ● Ao vivo
        </span>
      </div>

      {p ? (
        <>
          <div className="absolute grid" style={{ left: v(40), top: v(160), width: v(1200), gridTemplateColumns: "repeat(3, 1fr)", gap: v(30) }}>
            {p.posts.map((post) => (
              <div key={post.id} className="relative overflow-hidden" style={{ height: v(380), borderRadius: v(18), background: "#0b2238", boxShadow: `0 ${v(10)} ${v(30)} rgba(0,0,0,.45)` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={post.imagem} alt="" className="absolute inset-0 w-full h-full object-cover" />
                {post.curtidas != null && (
                  <span className="absolute" style={{ left: v(14), bottom: v(12), fontSize: v(22), fontWeight: 800, background: "rgba(0,0,0,.55)", padding: `${v(4)} ${v(12)}`, borderRadius: v(20) }}>
                    ♥ {numero(post.curtidas)}
                  </span>
                )}
                {post.video && (
                  <span className="absolute" style={{ right: v(14), top: v(12), fontSize: v(20), background: "rgba(0,0,0,.55)", padding: `${v(2)} ${v(10)}`, borderRadius: v(8) }}>
                    ▶
                  </span>
                )}
              </div>
            ))}
            {p.posts.length === 0 && (
              <div className="col-span-3 flex items-center justify-center" style={{ height: v(790), borderRadius: v(18), border: `${v(3)} dashed rgba(255,255,255,.2)`, fontSize: v(30), color: "rgba(255,255,255,.6)" }}>
                {p.aviso ?? "Sem posts com imagem para mostrar."}
              </div>
            )}
          </div>

          <div className="absolute flex flex-col" style={{ left: v(1297), top: v(510), width: v(576), height: v(530), borderRadius: v(18), background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", padding: v(28) }}>
            <div className="flex items-center" style={{ gap: v(22) }}>
              {p.foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.foto} alt="" className="rounded-full object-cover shrink-0" style={{ width: v(120), height: v(120), border: `${v(4)} solid ${cor}` }} />
              ) : (
                <div className="rounded-full shrink-0" style={{ width: v(120), height: v(120), background: cor }} />
              )}
              <div className="min-w-0">
                <div className="truncate" style={{ fontSize: v(38), fontWeight: 900, lineHeight: 1.1 }}>{p.nome}</div>
                {p.seguidores != null && (
                  <div style={{ fontSize: v(28), marginTop: v(6) }}>
                    <b style={{ color: cor }}>{numero(p.seguidores)}</b> seguidores
                  </div>
                )}
              </div>
            </div>
            {p.bio && (
              <p className="overflow-hidden" style={{ fontSize: v(23), lineHeight: 1.35, color: "rgba(255,255,255,.85)", marginTop: v(20), maxHeight: v(124), whiteSpace: "pre-line" }}>
                {p.bio}
              </p>
            )}
            <div className="flex items-center mt-auto" style={{ gap: v(22) }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.qr} alt="" style={{ width: v(170), height: v(170), borderRadius: v(10), background: "#fff", padding: v(8) }} />
              <div>
                <div style={{ fontSize: v(30), fontWeight: 900 }}>Siga no Instagram</div>
                <div style={{ fontSize: v(22), color: "rgba(255,255,255,.75)", marginTop: v(4) }}>instagram.com/{p.username}</div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="absolute flex items-center justify-center" style={{ left: v(40), top: v(160), width: v(1200), height: v(790), borderRadius: v(18), border: `${v(3)} dashed rgba(255,255,255,.2)`, fontSize: v(32), color: "rgba(255,255,255,.6)" }}>
          Nenhum convidado com Instagram no episódio de hoje.
        </div>
      )}
    </div>
  );
}

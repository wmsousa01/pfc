"use client";

import { useState } from "react";
import Image from "next/image";
import { PlayIcon } from "@/components/icons";

/**
 * Capa clicável no lugar do iframe do YouTube. O player embutido pesa perto de
 * 1 MB de script e derruba o carregamento no celular — que é onde o
 * comerciante abre o link do WhatsApp. O iframe só entra depois do clique.
 */
export default function VideoFacade({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className="relative aspect-video rounded-2xl overflow-hidden border border-[#2a2a2a] bg-black">
        <iframe
          className="absolute inset-0 w-full h-full"
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Assistir: ${title}`}
      className="group relative block w-full aspect-video rounded-2xl overflow-hidden border border-[#2a2a2a] bg-black"
    >
      <Image
        src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
        alt=""
        fill
        sizes="(min-width: 1024px) 640px, 100vw"
        className="object-cover opacity-80 group-hover:opacity-100 transition-opacity"
      />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="w-16 h-16 rounded-full bg-gold-500 text-black flex items-center justify-center shadow-[0_0_40px_rgba(255,215,0,0.35)] group-hover:scale-110 transition-transform">
          <PlayIcon className="w-7 h-7 ml-1" />
        </span>
      </span>
    </button>
  );
}

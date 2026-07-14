import Image from "next/image";
import { social } from "@/lib/config";
import { getIgHighlights } from "@/lib/partners";
import { YouTubeIcon, InstagramIcon, PlayIcon } from "./icons";

const platforms = [
  {
    name: "YouTube",
    handle: "@PapoForadaCaixa",
    desc: "Lives semanais e episódios completos.",
    href: social.youtube,
    cls: "hover:border-red-500/40",
    icon: <YouTubeIcon className="w-6 h-6 text-red-500" />,
  },
  {
    name: "Instagram",
    handle: social.instagramHandle,
    desc: "Bastidores, Stories e cortes diários.",
    href: social.instagram,
    cls: "hover:border-pink-500/40",
    icon: <InstagramIcon className="w-6 h-6 text-pink-500" />,
  },
  {
    name: "Shorts & Reels",
    handle: "~40 por semana",
    desc: "Clips curtos extraídos das lives.",
    href: social.youtube,
    cls: "hover:border-gold-500/40",
    icon: <PlayIcon className="w-6 h-6 text-gold-500" />,
  },
];

export default async function OndeAssistir() {
  const highlights = await getIgHighlights();

  return (
    <section className="section-py bg-[#0a0a0a]">
      <div className="container-px">
        <div className="text-center mb-12 max-w-2xl mx-auto">
          <span className="section-tag">Onde assistir</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mt-3 leading-tight">
            O Fora da Caixa está em{" "}
            <span className="text-gradient-gold">todas as telas</span>
          </h2>
        </div>

        <div className="grid sm:grid-cols-3 gap-5 mb-10">
          {platforms.map((p) => (
            <a
              key={p.name}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`card-hover bg-[#111] border border-[#222] rounded-2xl p-6 flex flex-col gap-4 ${p.cls}`}
            >
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                {p.icon}
              </div>
              <div>
                <div className="text-white font-bold text-lg">{p.name}</div>
                <div className="text-gold-500/80 text-sm">{p.handle}</div>
                <div className="text-white/45 text-sm mt-1">{p.desc}</div>
              </div>
            </a>
          ))}
        </div>

        {/* Destaques do Instagram (curados) */}
        {highlights.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <InstagramIcon className="w-4 h-4 text-pink-500" />
              <span className="text-white/60 text-sm font-semibold">
                Destaques do Instagram
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {highlights.map((h) => (
                <a
                  key={h.id}
                  href={h.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative aspect-[9/16] rounded-xl overflow-hidden border border-[#222] hover:border-pink-500/40 transition-colors"
                  title={h.title ?? "Destaque"}
                >
                  <Image
                    src={h.image_url}
                    alt={h.title ?? "Destaque do Instagram"}
                    fill
                    sizes="(max-width: 640px) 50vw, 220px"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  {h.title && (
                    <span className="absolute bottom-2 left-2 right-2 text-white text-xs font-medium line-clamp-2">
                      {h.title}
                    </span>
                  )}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

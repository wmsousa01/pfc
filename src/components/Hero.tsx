import Image from "next/image";
import { getVideosSplit, type YouTubeVideo } from "@/lib/youtube";
import { social, channelStats } from "@/lib/config";
import { PlayIcon, YouTubeIcon, ArrowRight } from "./icons";

function timeAgo(iso: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const day = 86_400_000;
  const d = Math.floor(diff / day);
  if (d <= 0) return "hoje";
  if (d === 1) return "ontem";
  if (d < 7) return `há ${d} dias`;
  if (d < 30) return `há ${Math.floor(d / 7)} sem`;
  return `há ${Math.floor(d / 30)} mês${Math.floor(d / 30) > 1 ? "es" : ""}`;
}

function FeaturedCard({ video }: { video: YouTubeVideo }) {
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block rounded-2xl overflow-hidden border border-[#333] bg-[#111] aspect-video card-hover"
    >
      <Image
        src={video.thumbnail}
        alt={video.title}
        fill
        sizes="(max-width: 1024px) 100vw, 560px"
        className="object-cover transition-transform duration-500 group-hover:scale-105"
        priority
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

      {/* Latest badge */}
      <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-black/70 backdrop-blur-sm border border-white/10 rounded-full">
        <span className="w-2 h-2 rounded-full bg-gold-500 animate-pulse" />
        <span className="text-white text-xs font-bold uppercase tracking-wider">
          Último episódio
        </span>
      </div>

      {/* Play button */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-gold-500/90 flex items-center justify-center shadow-2xl transition-transform duration-300 group-hover:scale-110">
          <PlayIcon className="w-7 h-7 text-black ml-1" />
        </div>
      </div>

      {/* Title */}
      <div className="absolute bottom-0 left-0 right-0 p-5">
        <h3 className="text-white font-bold text-lg leading-snug line-clamp-2">
          {video.title}
        </h3>
        <p className="text-white/50 text-sm mt-1">{timeAgo(video.published)}</p>
      </div>
    </a>
  );
}

function StaticVisual() {
  return (
    <div className="relative rounded-2xl overflow-hidden border border-[#333] bg-[#111] aspect-video flex flex-col items-center justify-center gap-5">
      <div className="w-20 h-20 rounded-full bg-gold-500/10 border border-gold-500/20 flex items-center justify-center animate-float">
        <YouTubeIcon className="w-10 h-10 text-gold-500" />
      </div>
      <a
        href={social.youtube}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-primary px-6 py-3 rounded-xl text-sm flex items-center gap-2"
      >
        <YouTubeIcon className="w-4 h-4" />
        Ver no YouTube
      </a>
    </div>
  );
}

export default async function Hero() {
  const { episodes, shorts, latest } = await getVideosSplit();
  const featured = episodes[0] ?? latest;
  const strip = [...shorts, ...episodes.slice(1)].slice(0, 4);

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-[#0a0a0a] pt-16">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gold-500/5 rounded-full blur-[120px] -translate-x-1/2 translate-y-1/4" />
        <div className="absolute top-1/4 right-0 w-[400px] h-[400px] bg-gold-500/[0.03] rounded-full blur-[100px] translate-x-1/2" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,215,0,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,215,0,0.3) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="container-px relative z-10 py-16 lg:py-20 w-full">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Content */}
          <div className="flex flex-col gap-6 animate-fade-in-up">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gold-500 animate-pulse" />
              <span className="section-tag">Podcast · Mogi Guaçu · SP</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight">
              Histórias que conectam.{" "}
              <span className="text-gradient-gold">Conversas que transformam.</span>
            </h1>

            <p className="text-lg text-white/70 leading-relaxed max-w-xl">
              O <strong className="text-white">Fora da Caixa</strong> é o
              ecossistema de conteúdo de Mogi Guaçu: lives semanais, quadros
              especializados e Shorts diários com as vozes que movem a região.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <a
                href={social.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary px-8 py-4 rounded-xl text-base flex items-center justify-center gap-3"
              >
                <YouTubeIcon className="w-5 h-5" />
                Assistir agora
              </a>
              <a
                href="#quadros"
                className="btn-outline px-8 py-4 rounded-xl text-base flex items-center justify-center gap-2"
              >
                Conheça os quadros
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            {/* Inline stats */}
            <div className="flex flex-wrap gap-x-8 gap-y-3 pt-4">
              {[
                { v: channelStats.views12m, l: "views em 12 meses" },
                { v: channelStats.subscribers, l: "inscritos" },
                { v: channelStats.weeklyContent, l: "conteúdos/semana" },
              ].map((s, i) => (
                <div key={i}>
                  <div className="text-gold-500 font-black text-xl leading-none">
                    {s.v}
                  </div>
                  <div className="text-white/40 text-xs mt-1">{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Featured content */}
          <div className="animate-fade-in" style={{ animationDelay: "0.15s", opacity: 0 }}>
            {featured ? <FeaturedCard video={featured} /> : <StaticVisual />}

            {/* Recent strip */}
            {strip.length > 0 && (
              <div className="mt-4" id="episodios">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white/50 text-xs font-bold uppercase tracking-widest">
                    Recentes
                  </span>
                  <a
                    href={social.youtube}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gold-500 text-xs font-semibold hover:text-gold-400 flex items-center gap-1"
                  >
                    Ver tudo <ArrowRight className="w-3 h-3" />
                  </a>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {strip.map((v) => (
                    <a
                      key={v.id}
                      href={v.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative aspect-video rounded-lg overflow-hidden border border-[#222] hover:border-gold-500/40 transition-colors"
                      title={v.title}
                    >
                      <Image
                        src={v.thumbnail}
                        alt={v.title}
                        fill
                        sizes="140px"
                        className="object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#0a0a0a] to-transparent pointer-events-none" />
    </section>
  );
}

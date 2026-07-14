import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import { ArrowRight, MicIcon } from "@/components/icons";
import { getPartnerBySlug, getActivePartnerSlugs } from "@/lib/partners";
import { site } from "@/lib/config";
import { getPreset, readableOn, withAlpha, brandDefaults } from "@/lib/brandkit";

export const revalidate = 300;

export async function generateStaticParams() {
  const slugs = await getActivePartnerSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const partner = await getPartnerBySlug(params.slug);
  if (!partner) return { title: "Parceiro não encontrado | Fora da Caixa" };
  return {
    title: `${partner.name} | Parceiro Fora da Caixa`,
    description: partner.tagline ?? partner.description ?? undefined,
  };
}

export default async function PartnerPage({
  params,
}: {
  params: { slug: string };
}) {
  const partner = await getPartnerBySlug(params.slug);
  if (!partner) notFound();

  // Kit de marca
  const primary = partner.accent || brandDefaults.primary;
  const secondary = partner.color_secondary || brandDefaults.secondary;
  const bg = partner.color_bg || brandDefaults.bg;
  const preset = getPreset(partner.style_preset);
  const fg = readableOn(bg);
  const fgMuted = withAlpha(fg, "aa");
  const fgSubtle = withAlpha(fg, "66");
  const cardBg = withAlpha(fg, "08");
  const cardBorder = withAlpha(fg, "18");
  const radius = preset.radius;

  const headingStyle: React.CSSProperties = {
    fontWeight: preset.headingWeight,
    letterSpacing: preset.headingSpacing,
    textTransform: preset.headingTransform,
  };

  const sections = partner.sections ?? [];

  return (
    <main
      className="overflow-x-hidden min-h-screen"
      style={{ backgroundColor: bg, color: fg, fontFamily: preset.fontFamily }}
    >
      <Navbar />

      {/* Hero */}
      <section className="relative pt-24 pb-14 lg:pt-32 lg:pb-20 overflow-hidden">
        {partner.cover_url ? (
          <div className="absolute inset-0">
            <Image src={partner.cover_url} alt={partner.name} fill className="object-cover opacity-30" priority />
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(to bottom, ${withAlpha(bg, "cc")}, ${withAlpha(bg, "ee")} 70%, ${bg})` }}
            />
          </div>
        ) : (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(circle at 50% 0%, ${withAlpha(primary, "22")} 0%, ${withAlpha(secondary, "11")} 45%, transparent 70%)` }}
          />
        )}

        <div className="container-px relative max-w-3xl mx-auto text-center flex flex-col items-center gap-6">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider"
            style={{ borderRadius: 999, border: `1px solid ${withAlpha(primary, "55")}`, color: primary }}
          >
            <MicIcon className="w-3.5 h-3.5" />
            Parceiro Fora da Caixa
          </div>

          {partner.logo_url ? (
            <div
              className="relative w-24 h-24 overflow-hidden flex items-center justify-center"
              style={{ borderRadius: radius, backgroundColor: withAlpha(fg, "0d"), border: `1px solid ${cardBorder}` }}
            >
              <Image src={partner.logo_url} alt={partner.name} fill className="object-contain p-2" sizes="96px" />
            </div>
          ) : (
            <div
              className="w-24 h-24 flex items-center justify-center text-4xl"
              style={{ borderRadius: radius, backgroundColor: withAlpha(primary, "22"), color: primary, fontWeight: 800 }}
            >
              {partner.name.charAt(0)}
            </div>
          )}

          <div>
            <h1 className="text-4xl sm:text-5xl leading-tight" style={headingStyle}>
              {partner.name}
            </h1>
            {partner.plan && (
              <p className="text-sm mt-2 uppercase tracking-widest" style={{ color: fgSubtle }}>
                Plano {partner.plan}
              </p>
            )}
          </div>

          {partner.tagline && (
            <p className="text-xl leading-relaxed max-w-xl" style={{ color: fgMuted }}>
              {partner.tagline}
            </p>
          )}

          {partner.cta_url && (
            <a
              href={partner.cta_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 text-base font-bold flex items-center gap-3 transition-transform hover:-translate-y-0.5"
              style={{
                backgroundColor: primary,
                color: readableOn(primary),
                borderRadius: radius,
                boxShadow: preset.glow ? `0 10px 30px ${withAlpha(primary, "55")}` : "none",
              }}
            >
              {partner.cta_label || "Saiba mais"}
              <ArrowRight className="w-4 h-4" />
            </a>
          )}
        </div>
      </section>

      {/* Descrição */}
      {partner.description && (
        <section className="pb-8">
          <div className="container-px max-w-3xl mx-auto">
            <p className="text-lg leading-relaxed whitespace-pre-line" style={{ color: fgMuted }}>
              {partner.description}
            </p>
          </div>
        </section>
      )}

      {/* Seções livres */}
      {sections.length > 0 && (
        <section className="section-py pt-8">
          <div className="container-px max-w-3xl mx-auto flex flex-col gap-6">
            {sections.map((s, i) => (
              <div key={i} className="p-7" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: radius }}>
                <h2 className="text-xl" style={{ color: primary, ...headingStyle }}>
                  {s.heading}
                </h2>
                <p className="mt-3 leading-relaxed whitespace-pre-line" style={{ color: fgMuted }}>
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Rodapé do parceiro */}
      <section className="section-py">
        <div className="container-px max-w-3xl mx-auto">
          <div
            className="p-8 text-center flex flex-col items-center gap-4"
            style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: radius }}
          >
            <MicIcon className="w-8 h-8" />
            <p style={{ color: fgMuted }}>
              Você conheceu <strong style={{ color: fg }}>{partner.name}</strong>{" "}
              através do <strong style={{ color: primary }}>{site.brand}</strong>.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              {partner.website && (
                <a
                  href={partner.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 text-sm font-semibold"
                  style={{ borderRadius: radius, border: `1px solid ${withAlpha(primary, "66")}`, color: primary }}
                >
                  Visitar site do parceiro
                </a>
              )}
              <a
                href="/"
                className="px-6 py-3 text-sm font-bold"
                style={{ backgroundColor: primary, color: readableOn(primary), borderRadius: radius }}
              >
                Conhecer o Fora da Caixa
              </a>
            </div>
          </div>
        </div>
      </section>

      <Footer />
      <WhatsAppButton />
    </main>
  );
}

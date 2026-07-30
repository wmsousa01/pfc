import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import PartnerLeadForm from "@/components/partner/PartnerLeadForm";
import { PartnerIcon, CheckIcon, PinIcon, ClockIcon } from "@/components/partner/icons";
import { ArrowRight, MicIcon, InstagramIcon, WhatsAppIcon } from "@/components/icons";
import { getPartnerBySlug, getActivePartnerSlugs } from "@/lib/partners";
import { site } from "@/lib/config";
import { buildPartnerTheme, withAlpha } from "@/lib/brandkit";
import type { PartnerContent } from "@/lib/types";

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
  const description = partner.tagline ?? partner.description ?? undefined;
  return {
    title: `${partner.name} | Parceiro Fora da Caixa`,
    description,
    openGraph: {
      title: `${partner.name} | Parceiro Fora da Caixa`,
      description,
      images: partner.cover_url ? [partner.cover_url] : undefined,
    },
  };
}

export default async function PartnerPage({
  params,
}: {
  params: { slug: string };
}) {
  const partner = await getPartnerBySlug(params.slug);
  if (!partner) notFound();

  const t = buildPartnerTheme(partner);
  const content: PartnerContent = partner.content ?? {};
  const sections = partner.sections ?? [];
  const triage = content.triage;
  const triageOn = triage?.enabled !== false && Boolean(partner.whatsapp);

  const waHref = partner.whatsapp
    ? `https://wa.me/${partner.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
        content.whatsapp_message ?? `Olá! Vim pela página de vocês no ${site.brand}.`
      )}`
    : partner.cta_url;

  const card = {
    backgroundColor: t.surface,
    border: `1px solid ${t.border}`,
    borderRadius: t.radius,
  } as const;

  return (
    <main
      className="overflow-x-hidden min-h-screen"
      style={{ backgroundColor: t.bg, color: t.fg, fontFamily: t.fontFamily }}
    >
      <Navbar />

      {/* ============================== HERO ============================== */}
      <section className="relative pt-28 pb-16 lg:pt-36 lg:pb-24 overflow-hidden">
        {/* Fundo: capa do parceiro ou malha de gradiente da marca */}
        {partner.cover_url ? (
          <div className="absolute inset-0">
            <Image
              src={partner.cover_url}
              alt=""
              fill
              className="object-cover opacity-25"
              priority
            />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to bottom, ${withAlpha(t.bg, "cc")}, ${withAlpha(t.bg, "f0")} 65%, ${t.bg})`,
              }}
            />
          </div>
        ) : null}

        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[520px] partner-float"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${withAlpha(t.primary, "2e")} 0%, ${withAlpha(t.secondary, "14")} 45%, transparent 70%)`,
            }}
          />
          <div
            className="absolute bottom-0 right-0 w-[420px] h-[420px] rounded-full blur-[120px] opacity-25"
            style={{ backgroundColor: t.secondary }}
          />
        </div>

        <div className="container-px relative">
          <div className="max-w-3xl mx-auto text-center flex flex-col items-center gap-6 partner-rise">
            <div
              className="inline-flex items-center gap-2 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em]"
              style={{
                borderRadius: 999,
                border: `1px solid ${withAlpha(t.primary, "4d")}`,
                backgroundColor: withAlpha(t.primary, "12"),
                color: t.primaryText,
              }}
            >
              <MicIcon className="w-3.5 h-3.5" />
              {content.eyebrow ?? `Parceiro ${site.brand}`}
            </div>

            {partner.logo_url ? (
              <div
                className="relative w-28 h-28 overflow-hidden flex items-center justify-center"
                style={{
                  borderRadius: t.radius + 6,
                  backgroundColor: withAlpha(t.fg, "0d"),
                  border: `1px solid ${t.border}`,
                  boxShadow: `0 18px 50px ${withAlpha(t.primary, "33")}`,
                }}
              >
                <Image
                  src={partner.logo_url}
                  alt={partner.name}
                  fill
                  className="object-contain p-2.5"
                  sizes="112px"
                  priority
                />
              </div>
            ) : (
              <div
                className="w-28 h-28 flex items-center justify-center text-5xl"
                style={{
                  borderRadius: t.radius + 6,
                  backgroundColor: withAlpha(t.primary, "22"),
                  color: t.primaryText,
                  fontWeight: 800,
                }}
              >
                {partner.name.charAt(0)}
              </div>
            )}

            <div>
              <h1
                className="text-4xl sm:text-5xl lg:text-[3.4rem] leading-[1.05]"
                style={t.heading}
              >
                {partner.name}
              </h1>
              {partner.plan && (
                <p
                  className="text-[11px] mt-3 uppercase tracking-[0.2em] font-semibold"
                  style={{ color: t.fgSubtle }}
                >
                  {partner.plan} · {site.brand}
                </p>
              )}
            </div>

            {partner.tagline && (
              <p
                className="text-xl sm:text-2xl leading-snug max-w-2xl font-medium"
                style={{ color: t.fgMuted }}
              >
                {partner.tagline}
              </p>
            )}

            {content.highlights?.length ? (
              <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-1">
                {content.highlights.map((h) => (
                  <li
                    key={h}
                    className="flex items-center gap-2 text-sm"
                    style={{ color: t.fgMuted }}
                  >
                    <CheckIcon className="w-4 h-4 shrink-0" />
                    {h}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
              {triageOn ? (
                <a
                  href="#orcamento"
                  className="px-8 py-4 text-base font-bold flex items-center gap-3 transition-transform hover:-translate-y-0.5"
                  style={{
                    backgroundColor: t.primary,
                    color: t.onPrimary,
                    borderRadius: t.radius,
                    boxShadow: `0 14px 36px ${withAlpha(t.primary, "55")}`,
                  }}
                >
                  Pedir minha proposta
                  <ArrowRight className="w-4 h-4" />
                </a>
              ) : (
                partner.cta_url && (
                  <a
                    href={partner.cta_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-8 py-4 text-base font-bold flex items-center gap-3 transition-transform hover:-translate-y-0.5"
                    style={{
                      backgroundColor: t.primary,
                      color: t.onPrimary,
                      borderRadius: t.radius,
                      boxShadow: `0 14px 36px ${withAlpha(t.primary, "55")}`,
                    }}
                  >
                    {partner.cta_label || "Saiba mais"}
                    <ArrowRight className="w-4 h-4" />
                  </a>
                )
              )}

              {waHref && (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-8 py-4 text-base font-semibold flex items-center gap-3 transition-colors"
                  style={{
                    borderRadius: t.radius,
                    border: `1px solid ${t.borderStrong}`,
                    color: t.fg,
                    backgroundColor: t.surface,
                  }}
                >
                  <WhatsAppIcon className="w-5 h-5" />
                  Chamar no WhatsApp
                </a>
              )}
            </div>
          </div>

          {/* Faixa de números */}
          {content.stats?.length ? (
            <div className="max-w-4xl mx-auto mt-14 grid grid-cols-2 lg:grid-cols-4 gap-3">
              {content.stats.map((s) => {
                const inner = (
                  <>
                    <div
                      className="text-2xl sm:text-3xl font-black"
                      style={{ color: t.primaryText }}
                    >
                      {s.value}
                    </div>
                    <div className="text-xs mt-1.5 leading-snug" style={{ color: t.fgSubtle }}>
                      {s.label}
                    </div>
                  </>
                );
                return s.href ? (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-5 text-center transition-transform hover:-translate-y-0.5"
                    style={card}
                  >
                    {inner}
                  </a>
                ) : (
                  <div key={s.label} className="p-5 text-center" style={card}>
                    {inner}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>

      {/* ============================ DESCRIÇÃO =========================== */}
      {partner.description && (
        <section className="pb-4">
          <div className="container-px max-w-3xl mx-auto">
            <p
              className="text-lg leading-relaxed whitespace-pre-line text-center"
              style={{ color: t.fgMuted }}
            >
              {partner.description}
            </p>
          </div>
        </section>
      )}

      {/* ============================= PRODUTOS =========================== */}
      {content.products?.length ? (
        <section className="section-py">
          <div className="container-px max-w-5xl mx-auto">
            <h2 className="text-3xl sm:text-4xl text-center leading-tight" style={t.heading}>
              O que a gente entrega
            </h2>
            <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {content.products.map((p) => (
                <div
                  key={p.name}
                  className="p-6 flex flex-col gap-3 transition-transform hover:-translate-y-1"
                  style={card}
                >
                  {p.image_url ? (
                    <div
                      className="relative w-full h-40 overflow-hidden"
                      style={{ borderRadius: Math.max(8, t.radius - 6) }}
                    >
                      <Image
                        src={p.image_url}
                        alt={p.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, 320px"
                      />
                    </div>
                  ) : (
                    <div
                      className="w-12 h-12 flex items-center justify-center"
                      style={{
                        borderRadius: Math.max(8, t.radius - 6),
                        backgroundColor: withAlpha(t.primary, "1f"),
                        color: t.primaryText,
                      }}
                    >
                      <PartnerIcon name={p.need} className="w-6 h-6" />
                    </div>
                  )}

                  <h3 className="text-xl" style={{ color: t.fg, ...t.heading }}>
                    {p.name}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: t.fgMuted }}>
                    {p.body}
                  </p>

                  {p.tags?.length ? (
                    <div className="flex flex-wrap gap-1.5 mt-auto pt-2">
                      {p.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[11px] font-semibold px-2.5 py-1"
                          style={{
                            borderRadius: 999,
                            backgroundColor: withAlpha(t.primary, "14"),
                            color: t.primaryText,
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ============================ DIFERENCIAIS ======================== */}
      {content.perks?.length ? (
        <section
          className="section-py"
          style={{
            background: `linear-gradient(180deg, transparent, ${withAlpha(t.secondary, "1f")}, transparent)`,
          }}
        >
          <div className="container-px max-w-5xl mx-auto">
            <div className="grid sm:grid-cols-2 gap-4">
              {content.perks.map((p) => (
                <div key={p.title} className="p-6 flex gap-4" style={card}>
                  <div
                    className="w-11 h-11 shrink-0 flex items-center justify-center"
                    style={{
                      borderRadius: Math.max(8, t.radius - 4),
                      backgroundColor: withAlpha(t.primary, "1a"),
                      color: t.primaryText,
                    }}
                  >
                    <PartnerIcon name={p.icon} className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[17px]" style={{ color: t.fg }}>
                      {p.title}
                    </h3>
                    <p className="text-sm mt-1.5 leading-relaxed" style={{ color: t.fgMuted }}>
                      {p.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* =========================== COMO FUNCIONA ======================== */}
      {content.steps?.length ? (
        <section className="section-py pt-0">
          <div className="container-px max-w-4xl mx-auto">
            <h2 className="text-3xl sm:text-4xl text-center leading-tight" style={t.heading}>
              Como funciona
            </h2>
            <ol className="mt-10 grid sm:grid-cols-3 gap-4">
              {content.steps.map((s, i) => (
                <li key={s.title} className="p-6" style={card}>
                  <div
                    className="w-9 h-9 flex items-center justify-center font-black text-sm"
                    style={{
                      borderRadius: 999,
                      backgroundColor: t.primary,
                      color: t.onPrimary,
                    }}
                  >
                    {i + 1}
                  </div>
                  <h3 className="font-bold mt-4" style={{ color: t.fg }}>
                    {s.title}
                  </h3>
                  <p className="text-sm mt-1.5 leading-relaxed" style={{ color: t.fgMuted }}>
                    {s.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}

      {/* ========================== SEÇÕES LIVRES ========================= */}
      {sections.length > 0 && (
        <section className="section-py pt-0">
          <div className="container-px max-w-3xl mx-auto flex flex-col gap-5">
            {sections.map((s, i) => (
              <div key={i} className="p-7" style={card}>
                <h2 className="text-xl" style={{ color: t.primaryText, ...t.heading }}>
                  {s.heading}
                </h2>
                <p
                  className="mt-3 leading-relaxed whitespace-pre-line"
                  style={{ color: t.fgMuted }}
                >
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ============================== TRIAGEM =========================== */}
      {triageOn && (
        <section id="orcamento" className="section-py scroll-mt-20">
          <div className="container-px max-w-5xl mx-auto">
            <div className="grid lg:grid-cols-[1fr_1.1fr] gap-10 items-center">
              <div>
                <span
                  className="text-[11px] font-bold uppercase tracking-[0.18em]"
                  style={{ color: t.primaryText }}
                >
                  {triage?.title ?? "Proposta na medida"}
                </span>
                <h2 className="text-3xl sm:text-4xl mt-3 leading-tight" style={t.heading}>
                  {triage?.subtitle ?? "Responda 5 perguntas e receba a solução certa"}
                </h2>
                <p className="mt-4 leading-relaxed" style={{ color: t.fgMuted }}>
                  Leva menos de um minuto. Suas respostas chegam prontas para a{" "}
                  {partner.name} — sem precisar repetir tudo no WhatsApp.
                </p>
                <ul className="mt-6 flex flex-col gap-3">
                  {[
                    "Atendimento de quem entende do seu tipo de negócio",
                    "Indicação do equipamento certo para o seu espaço",
                    "Resposta direta no seu WhatsApp",
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2.5 text-sm"
                      style={{ color: t.fgMuted }}
                    >
                      <span style={{ color: t.primaryText }} className="mt-0.5">
                        <CheckIcon className="w-4 h-4" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <PartnerLeadForm
                slug={partner.slug}
                partnerName={partner.name}
                theme={t}
                triage={triage}
              />
            </div>
          </div>
        </section>
      )}

      {/* ================================ FAQ ============================= */}
      {content.faq?.length ? (
        <section className="section-py pt-0">
          <div className="container-px max-w-3xl mx-auto">
            <h2 className="text-3xl text-center leading-tight" style={t.heading}>
              Perguntas frequentes
            </h2>
            <div className="mt-8 flex flex-col gap-3">
              {content.faq.map((f) => (
                <details key={f.q} className="group p-5" style={card}>
                  <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-semibold">
                    <span style={{ color: t.fg }}>{f.q}</span>
                    <span
                      className="shrink-0 transition-transform group-open:rotate-45 text-xl leading-none"
                      style={{ color: t.primaryText }}
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: t.fgMuted }}>
                    {f.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ============================== CONTATO =========================== */}
      {(content.address || content.hours?.length || partner.instagram || waHref) && (
        <section className="section-py pt-0">
          <div className="container-px max-w-4xl mx-auto">
            <div className="p-8 grid sm:grid-cols-2 gap-8" style={card}>
              <div className="flex flex-col gap-5">
                {content.address && (
                  <div className="flex gap-3">
                    <PinIcon className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-sm" style={{ color: t.fg }}>
                        Onde estamos
                      </div>
                      <p className="text-sm mt-1 leading-relaxed" style={{ color: t.fgMuted }}>
                        {content.address}
                      </p>
                    </div>
                  </div>
                )}
                {content.hours?.length ? (
                  <div className="flex gap-3">
                    <ClockIcon className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-sm" style={{ color: t.fg }}>
                        Horário
                      </div>
                      {content.hours.map((h) => (
                        <p key={h} className="text-sm mt-1" style={{ color: t.fgMuted }}>
                          {h}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-3 sm:justify-center">
                {waHref && (
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3.5 font-bold flex items-center justify-center gap-2.5 transition-transform hover:-translate-y-0.5"
                    style={{
                      backgroundColor: t.primary,
                      color: t.onPrimary,
                      borderRadius: t.radius,
                    }}
                  >
                    <WhatsAppIcon className="w-5 h-5" />
                    Falar no WhatsApp
                  </a>
                )}
                {partner.instagram && (
                  <a
                    href={`https://instagram.com/${partner.instagram.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3.5 font-semibold flex items-center justify-center gap-2.5"
                    style={{
                      borderRadius: t.radius,
                      border: `1px solid ${t.border}`,
                      color: t.fg,
                    }}
                  >
                    <InstagramIcon className="w-5 h-5" />@
                    {partner.instagram.replace(/^@/, "")}
                  </a>
                )}
                {partner.website && (
                  <a
                    href={partner.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3.5 font-semibold text-center"
                    style={{
                      borderRadius: t.radius,
                      border: `1px solid ${t.border}`,
                      color: t.fg,
                    }}
                  >
                    Visitar o site
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========================= ASSINATURA DO PFC ====================== */}
      <section className="pb-24">
        <div className="container-px max-w-3xl mx-auto">
          <div
            className="p-8 text-center flex flex-col items-center gap-4"
            style={{
              ...card,
              background: `linear-gradient(135deg, ${withAlpha(t.primary, "12")}, transparent)`,
            }}
          >
            <MicIcon className="w-8 h-8" />
            <p style={{ color: t.fgMuted }}>
              Você conheceu <strong style={{ color: t.fg }}>{partner.name}</strong> através do{" "}
              <strong style={{ color: t.primaryText }}>{site.brand}</strong>.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="/"
                className="px-6 py-3 text-sm font-bold"
                style={{
                  backgroundColor: t.primary,
                  color: t.onPrimary,
                  borderRadius: t.radius,
                }}
              >
                Conhecer o {site.brand}
              </a>
              <a
                href="/parcerias"
                className="px-6 py-3 text-sm font-semibold"
                style={{
                  borderRadius: t.radius,
                  border: `1px solid ${t.border}`,
                  color: t.fg,
                }}
              >
                Quero minha marca aqui
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== BARRA FIXA (MOBILE) ======================= */}
      {triageOn && (
        <div
          className="fixed bottom-0 inset-x-0 z-40 sm:hidden p-3 flex gap-2 backdrop-blur"
          style={{
            backgroundColor: withAlpha(t.bg, "e6"),
            borderTop: `1px solid ${t.border}`,
          }}
        >
          <a
            href="#orcamento"
            className="flex-1 py-3.5 text-center font-bold text-sm"
            style={{
              backgroundColor: t.primary,
              color: t.onPrimary,
              borderRadius: t.radius,
            }}
          >
            Pedir proposta
          </a>
          {waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Falar no WhatsApp"
              className="w-14 flex items-center justify-center"
              style={{
                borderRadius: t.radius,
                border: `1px solid ${t.borderStrong}`,
                color: t.fg,
              }}
            >
              <WhatsAppIcon className="w-5 h-5" />
            </a>
          )}
        </div>
      )}

      <Footer />
      {/* Sem o botão flutuante do PFC quando a página tem CTA próprio do
          parceiro: dois WhatsApps na mesma tela confundem quem vai comprar. */}
      {!triageOn && <WhatsAppButton />}
    </main>
  );
}

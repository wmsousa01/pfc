import { notFound } from "next/navigation";
import AdminHeader from "@/components/admin/AdminHeader";
import { requireAdmin } from "@/lib/auth";
import { getPartnerById } from "@/lib/admin";
import {
  countForSection,
  PARTNER_CONTENT_SECTIONS,
} from "@/lib/partner-content-schema";

export const dynamic = "force-dynamic";

export default async function PartnerContentIndex({
  params,
}: {
  params: { id: string };
}) {
  await requireAdmin();

  const partner = await getPartnerById(params.id);
  if (!partner) notFound();

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <a
          href={`/admin/parceiros/${partner.id}`}
          className="text-white/40 hover:text-white text-sm"
        >
          ← Voltar para o cadastro
        </a>

        <div className="flex flex-wrap items-start justify-between gap-4 mt-3 mb-2">
          <h1 className="text-2xl font-bold text-white">
            Conteúdo da página:{" "}
            <span className="text-gold-500">{partner.name}</span>
          </h1>
          <a
            href={`/parceiros/${partner.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold-500 hover:text-gold-400 text-sm font-medium whitespace-nowrap"
          >
            Ver página ↗
          </a>
        </div>

        <p className="text-white/45 text-sm leading-relaxed max-w-2xl">
          Cada bloco da landing é editado aqui. Seção sem nenhum item
          simplesmente não é renderizada — é assim que se tira um bloco da
          página, sem precisar de deploy.
        </p>

        <div className="flex flex-col gap-3 mt-8">
          {PARTNER_CONTENT_SECTIONS.map((section) => {
            const count = countForSection(section, partner.content);
            return (
              <a
                key={section.slug}
                href={`/admin/parceiros/${partner.id}/conteudo/${section.slug}`}
                className="bg-[#111] border border-[#222] hover:border-gold-500/40 rounded-xl p-5 transition-colors group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-white font-bold group-hover:text-gold-400 transition-colors">
                        {section.label}
                      </span>
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                          count > 0
                            ? "bg-gold-500/10 border-gold-500/30 text-gold-400"
                            : "bg-white/5 border-white/10 text-white/35"
                        }`}
                      >
                        {section.kind === "list"
                          ? `${count} ${count === 1 ? "item" : "itens"}`
                          : count > 0
                            ? `${count} preenchido${count === 1 ? "" : "s"}`
                            : "vazio"}
                      </span>
                    </div>
                    <p className="text-white/45 text-sm mt-1 leading-relaxed">
                      {section.description}
                    </p>
                    {section.kind === "list" && count === 0 && (
                      <p className="text-white/25 text-xs mt-1.5">
                        {section.emptyEffect}
                      </p>
                    )}
                  </div>
                  <span className="text-white/25 group-hover:text-gold-500 transition-colors shrink-0">
                    →
                  </span>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}

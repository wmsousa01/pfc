import { notFound } from "next/navigation";
import AdminHeader from "@/components/admin/AdminHeader";
import ContentSectionForm from "@/components/admin/ContentSectionForm";
import { requireAdmin } from "@/lib/auth";
import { getPartnerById } from "@/lib/admin";
import { findContentSection } from "@/lib/partner-content-schema";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

export default async function PartnerContentSectionPage({
  params,
}: {
  params: { id: string; secao: string };
}) {
  await requireAdmin();

  const section = findContentSection(params.secao);
  if (!section) notFound();

  const partner = await getPartnerById(params.id);
  if (!partner) notFound();

  const content = (partner.content ?? {}) as Record<string, unknown>;

  // O que já está salvo, no formato que o formulário espera.
  let initial: Row[] | Row;
  if (section.kind === "list") {
    const saved = content[section.contentKey as string];
    initial = Array.isArray(saved) ? (saved as Row[]) : [];
  } else if (section.container) {
    const saved = content[section.container];
    initial = saved && typeof saved === "object" ? (saved as Row) : {};
  } else {
    initial = Object.fromEntries(
      section.fields.map((f) => [f.name, content[f.name]])
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <a
          href={`/admin/parceiros/${partner.id}/conteudo`}
          className="text-white/40 hover:text-white text-sm"
        >
          ← Todas as seções
        </a>

        <div className="flex flex-wrap items-start justify-between gap-4 mt-3 mb-2">
          <h1 className="text-2xl font-bold text-white">{section.label}</h1>
          <a
            href={`/parceiros/${partner.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold-500 hover:text-gold-400 text-sm font-medium whitespace-nowrap"
          >
            Ver página ↗
          </a>
        </div>

        <p className="text-white/45 text-sm leading-relaxed">
          {section.description}{" "}
          <span className="text-white/30">
            Parceiro: {partner.name}.
          </span>
        </p>

        {section.kind === "list" && (
          <p className="text-white/30 text-xs mt-2 leading-relaxed">
            Remover todos os itens tira o bloco inteiro da página.
          </p>
        )}

        <div className="mt-8">
          <ContentSectionForm
            partnerId={partner.id}
            section={section}
            initial={initial}
          />
        </div>
      </div>
    </div>
  );
}

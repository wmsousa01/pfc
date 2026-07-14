import { notFound } from "next/navigation";
import { headers } from "next/headers";
import AdminHeader from "@/components/admin/AdminHeader";
import PartnerForm from "@/components/admin/PartnerForm";
import { getPartnerById, getPartnerClickTotal } from "@/lib/admin";
import { qrDataUrl, trackingUrl } from "@/lib/qr";

export const dynamic = "force-dynamic";

function baseUrlFromHeaders(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function EditPartnerPage({
  params,
}: {
  params: { id: string };
}) {
  const partner = await getPartnerById(params.id);
  if (!partner) notFound();

  const totalClicks = await getPartnerClickTotal(partner.id);
  const base = baseUrlFromHeaders();
  const track = trackingUrl(base, partner.slug);
  const qr = await qrDataUrl(track);

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <a href="/admin" className="text-white/40 hover:text-white text-sm">← Voltar</a>
        <h1 className="text-2xl font-bold text-white mt-3 mb-8">
          Editar: <span className="text-gold-500">{partner.name}</span>
        </h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-2">
            <PartnerForm partner={partner} />
          </div>

          {/* Sidebar: QR + stats */}
          <div className="flex flex-col gap-6">
            <div className="bg-[#111] border border-[#222] rounded-xl p-5">
              <h3 className="text-white font-semibold mb-1">QR code do episódio</h3>
              <p className="text-white/40 text-xs mb-4">
                Exiba na tela durante a live. Cada leitura conta como acesso.
              </p>
              <div className="bg-white rounded-xl p-3 w-fit mx-auto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="QR code" className="w-44 h-44" />
              </div>
              <a
                href={qr}
                download={`qr-${partner.slug}.png`}
                className="btn-primary block text-center py-2.5 rounded-lg text-sm font-bold mt-4"
              >
                Baixar QR (PNG)
              </a>
              <div className="mt-3 text-center">
                <a href={`/parceiros/${partner.slug}`} target="_blank" className="text-gold-500 hover:text-gold-400 text-xs">
                  Ver página do parceiro ↗
                </a>
              </div>
              <p className="text-white/25 text-[10px] mt-3 break-all">{track}</p>
            </div>

            <div className="bg-[#111] border border-[#222] rounded-xl p-5">
              <h3 className="text-white font-semibold mb-3">Acessos</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-2xl font-black text-gold-500">{totalClicks}</div>
                  <div className="text-white/40 text-xs">Total</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-white">{partner.active ? "Ativo" : "Off"}</div>
                  <div className="text-white/40 text-xs">Status</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

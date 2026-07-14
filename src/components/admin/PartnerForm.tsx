"use client";

import { useState } from "react";
import { savePartner, deletePartner } from "@/app/admin/actions";
import type { Partner, PartnerSection } from "@/lib/types";
import {
  stylePresets,
  getPreset,
  readableOn,
  withAlpha,
  brandDefaults,
} from "@/lib/brandkit";

function AssetField({
  kind,
  label,
  current,
  aspect,
}: {
  kind: "logo" | "cover";
  label: string;
  current: string | null;
  aspect: string;
}) {
  const [preview, setPreview] = useState<string | null>(current);
  const [remove, setRemove] = useState(false);

  return (
    <div>
      <label className="admin-label">{label}</label>
      <input type="hidden" name={`${kind}_url`} value={current ?? ""} />
      <div className="mt-1.5 flex items-center gap-3">
        <div
          className={`${aspect} rounded-lg overflow-hidden bg-[#0a0a0a] border border-[#2a2a2a] flex items-center justify-center shrink-0`}
        >
          {preview && !remove ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="preview" className="w-full h-full object-contain" />
          ) : (
            <span className="text-white/20 text-xs">sem imagem</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <input
            type="file"
            name={`${kind}_file`}
            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setPreview(URL.createObjectURL(f));
                setRemove(false);
              }
            }}
            className="text-xs text-white/60 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-gold-500 file:text-black file:text-xs file:font-semibold file:cursor-pointer"
          />
          {current && (
            <label className="flex items-center gap-2 text-white/40 text-xs cursor-pointer">
              <input
                type="checkbox"
                name={`${kind}_remove`}
                checked={remove}
                onChange={(e) => setRemove(e.target.checked)}
                className="accent-red-500"
              />
              Remover imagem atual
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

function ColorField({
  name,
  label,
  value,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="admin-label">{label}</label>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-lg bg-transparent border border-[#2a2a2a] cursor-pointer p-0.5"
          aria-label={label}
        />
        <input
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="admin-input font-mono uppercase"
        />
      </div>
    </div>
  );
}

export default function PartnerForm({ partner }: { partner?: Partner }) {
  const [sections, setSections] = useState<PartnerSection[]>(
    partner?.sections?.length ? partner.sections : [{ heading: "", body: "" }]
  );

  const [primary, setPrimary] = useState(partner?.accent ?? brandDefaults.primary);
  const [secondary, setSecondary] = useState(partner?.color_secondary ?? brandDefaults.secondary);
  const [bg, setBg] = useState(partner?.color_bg ?? brandDefaults.bg);
  const [presetKey, setPresetKey] = useState(partner?.style_preset ?? brandDefaults.preset);
  const [name, setName] = useState(partner?.name ?? "");
  const [tagline, setTagline] = useState(partner?.tagline ?? "");

  const preset = getPreset(presetKey);

  function updateSection(i: number, key: keyof PartnerSection, value: string) {
    setSections((prev) => prev.map((s, idx) => (idx === i ? { ...s, [key]: value } : s)));
  }

  return (
    <form action={savePartner} className="flex flex-col gap-6">
      {partner && <input type="hidden" name="id" value={partner.id} />}

      {/* ============ KIT DE MARCA ============ */}
      <fieldset className="border border-[#222] rounded-xl p-5">
        <legend className="px-2 text-gold-500 text-sm font-bold">Kit de marca</legend>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Controles */}
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3">
              <ColorField name="accent" label="Primária" value={primary} onChange={setPrimary} />
              <ColorField name="color_secondary" label="Secundária" value={secondary} onChange={setSecondary} />
              <ColorField name="color_bg" label="Fundo" value={bg} onChange={setBg} />
            </div>

            <div>
              <label className="admin-label">Estilo visual (tom de voz)</label>
              <select
                name="style_preset"
                value={presetKey}
                onChange={(e) => setPresetKey(e.target.value)}
                className="admin-input mt-1.5"
              >
                {stylePresets.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label} — {p.description}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <AssetField kind="logo" label="Logo" current={partner?.logo_url ?? null} aspect="w-16 h-16" />
              <AssetField kind="cover" label="Capa" current={partner?.cover_url ?? null} aspect="w-24 h-16" />
            </div>
          </div>

          {/* Preview ao vivo */}
          <div>
            <label className="admin-label">Prévia da página</label>
            <div
              className="mt-1.5 rounded-xl overflow-hidden border border-[#2a2a2a]"
              style={{ backgroundColor: bg, fontFamily: preset.fontFamily }}
            >
              <div
                className="h-16"
                style={{
                  background: `linear-gradient(135deg, ${withAlpha(primary, "33")} 0%, ${withAlpha(secondary, "22")} 60%, transparent 100%)`,
                }}
              />
              <div className="px-5 pb-5 -mt-8">
                <div
                  className="w-16 h-16 flex items-center justify-center overflow-hidden border"
                  style={{
                    borderRadius: preset.radius,
                    backgroundColor: withAlpha(primary, "22"),
                    borderColor: withAlpha(primary, "55"),
                  }}
                >
                  {partner?.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={partner.logo_url} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <span style={{ color: primary, fontWeight: 800, fontSize: 24 }}>
                      {(name || "P").charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <h4
                  className="mt-3"
                  style={{
                    color: readableOn(bg),
                    fontWeight: preset.headingWeight,
                    letterSpacing: preset.headingSpacing,
                    textTransform: preset.headingTransform,
                    fontSize: 22,
                  }}
                >
                  {name || "Nome do parceiro"}
                </h4>
                <p style={{ color: withAlpha(readableOn(bg), "99"), fontSize: 13, marginTop: 4 }}>
                  {tagline || "Tagline da marca aparece aqui."}
                </p>
                <button
                  type="button"
                  className="mt-4 px-4 py-2 text-sm font-bold"
                  style={{
                    backgroundColor: primary,
                    color: readableOn(primary),
                    borderRadius: preset.radius,
                    boxShadow: preset.glow ? `0 8px 24px ${withAlpha(primary, "55")}` : "none",
                  }}
                >
                  Botão de ação
                </button>
              </div>
            </div>
            <p className="text-white/30 text-xs mt-2">
              Reflete cores, fonte e cantos do estilo escolhido.
            </p>
          </div>
        </div>
      </fieldset>

      {/* ============ IDENTIFICAÇÃO ============ */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="admin-label">Nome *</label>
          <input name="name" required value={name} onChange={(e) => setName(e.target.value)} className="admin-input mt-1.5" placeholder="Padaria do Zé" />
        </div>
        <div>
          <label className="admin-label">Slug (URL)</label>
          <input name="slug" defaultValue={partner?.slug} className="admin-input mt-1.5" placeholder="deixe vazio p/ gerar do nome" />
        </div>
      </div>

      <div>
        <label className="admin-label">Plano / relação</label>
        <input name="plan" defaultValue={partner?.plan ?? ""} className="admin-input mt-1.5" placeholder="Patrocinador" />
      </div>

      <div>
        <label className="admin-label">Tagline</label>
        <input name="tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} className="admin-input mt-1.5" placeholder="Frase curta de destaque" />
      </div>

      <div>
        <label className="admin-label">Descrição</label>
        <textarea name="description" defaultValue={partner?.description ?? ""} rows={4} className="admin-input mt-1.5" placeholder="Texto principal da página do parceiro" />
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label className="admin-label">Site do parceiro</label>
          <input name="website" defaultValue={partner?.website ?? ""} className="admin-input mt-1.5" placeholder="https://..." />
        </div>
        <div>
          <label className="admin-label">URL do botão (CTA)</label>
          <input name="cta_url" defaultValue={partner?.cta_url ?? ""} className="admin-input mt-1.5" placeholder="https://wa.me/... ou site" />
        </div>
        <div>
          <label className="admin-label">Texto do botão</label>
          <input name="cta_label" defaultValue={partner?.cta_label ?? ""} className="admin-input mt-1.5" placeholder="Falar no WhatsApp" />
        </div>
      </div>

      {/* Sections */}
      <div>
        <label className="admin-label">Seções da página</label>
        <div className="flex flex-col gap-3 mt-1.5">
          {sections.map((s, i) => (
            <div key={i} className="bg-[#0d0d0d] border border-[#222] rounded-lg p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  name="section_heading"
                  value={s.heading}
                  onChange={(e) => updateSection(i, "heading", e.target.value)}
                  className="admin-input"
                  placeholder="Título da seção"
                />
                <button
                  type="button"
                  onClick={() => setSections((p) => p.filter((_, idx) => idx !== i))}
                  className="text-red-400/70 hover:text-red-400 text-sm px-2 shrink-0"
                >
                  Remover
                </button>
              </div>
              <textarea
                name="section_body"
                value={s.body}
                onChange={(e) => updateSection(i, "body", e.target.value)}
                rows={3}
                className="admin-input"
                placeholder="Conteúdo da seção"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setSections((p) => [...p, { heading: "", body: "" }])}
            className="btn-outline py-2.5 rounded-lg text-sm w-fit px-4"
          >
            + Adicionar seção
          </button>
        </div>
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" name="active" defaultChecked={partner ? partner.active : true} className="w-4 h-4 accent-gold-500" />
        <span className="text-white/70 text-sm">Parceiro ativo (visível no site)</span>
      </label>

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" className="btn-primary px-6 py-3 rounded-lg font-bold">
          {partner ? "Salvar alterações" : "Criar parceiro"}
        </button>
        <a href="/admin" className="btn-outline px-6 py-3 rounded-lg">Cancelar</a>

        {partner && (
          <button formAction={deletePartner} formNoValidate className="ml-auto text-red-400/70 hover:text-red-400 text-sm">
            Excluir parceiro
          </button>
        )}
      </div>
    </form>
  );
}

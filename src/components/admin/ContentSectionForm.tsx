"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  savePartnerContentSection,
  type ContentFormState,
} from "@/app/admin/parceiros/actions";
import type { ContentField, ContentSection } from "@/lib/partner-content-schema";

const initialState: ContentFormState = { ok: false, error: null };

const inputCls =
  "mt-1.5 w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-gold-500/50 transition-colors";

type Row = Record<string, unknown>;

/** Valor de um campo já pronto para caber num <input>. */
function toInput(field: ContentField, value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(String).join(field.kind === "csv" ? ", " : "\n");
  }
  return value === undefined || value === null ? "" : String(value);
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="btn-primary px-6 py-3 rounded-lg font-bold disabled:opacity-50"
    >
      {pending ? "Salvando..." : "Salvar seção"}
    </button>
  );
}

function Field({
  field,
  value,
  onChange,
}: {
  field: ContentField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (field.kind === "boolean") {
    return (
      <label className="flex items-start gap-2.5 text-white/70 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 accent-gold-500 mt-0.5"
        />
        <span>
          {field.label}
          {field.help && (
            <span className="block text-white/30 text-xs mt-0.5">{field.help}</span>
          )}
        </span>
      </label>
    );
  }

  const shared = {
    value: toInput(field, value),
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => onChange(e.target.value),
    placeholder: field.placeholder,
    className: inputCls,
  };

  return (
    <div>
      <label className="admin-label">{field.label}</label>
      {field.kind === "select" ? (
        <select {...shared}>
          <option value="">(padrão)</option>
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : field.kind === "textarea" || field.kind === "lines" ? (
        <textarea {...shared} rows={field.kind === "lines" ? 4 : 3} />
      ) : (
        <input {...shared} type={field.kind === "url" ? "url" : "text"} />
      )}
      {field.help && (
        <p className="text-white/30 text-xs mt-1.5 leading-relaxed">{field.help}</p>
      )}
    </div>
  );
}

/**
 * Editor de uma seção do conteúdo do parceiro.
 *
 * O estado vai para o servidor como JSON num campo escondido, em vez de
 * inputs indexados: as linhas são adicionadas e removidas na tela, e alinhar
 * `formData.getAll()` de vários campos opcionais depois disso é onde esse tipo
 * de formulário costuma silenciosamente trocar valor de linha. O servidor
 * normaliza tudo pelo schema — este componente não é fonte de verdade.
 */
export default function ContentSectionForm({
  partnerId,
  section,
  initial,
}: {
  partnerId: string;
  section: ContentSection;
  /** Lista de itens (seção `list`) ou objeto de campos (seção `fields`). */
  initial: Row[] | Row;
}) {
  const [state, formAction] = useFormState(savePartnerContentSection, initialState);
  const [rows, setRows] = useState<Row[]>(
    section.kind === "list" ? ((initial as Row[]) ?? []) : []
  );
  const [bag, setBag] = useState<Row>(
    section.kind === "fields" ? ((initial as Row) ?? {}) : {}
  );

  const payload = JSON.stringify(section.kind === "list" ? rows : bag);

  function patchRow(index: number, name: string, value: unknown) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [name]: value } : r))
    );
  }

  function move(index: number, delta: number) {
    setRows((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="partner_id" value={partnerId} />
      <input type="hidden" name="section" value={section.slug} />
      <input type="hidden" name="payload" value={payload} />

      {section.kind === "fields" ? (
        <div className="bg-[#111] border border-[#222] rounded-xl p-5 flex flex-col gap-4">
          {section.fields.map((f) => (
            <Field
              key={f.name}
              field={f}
              value={bag[f.name]}
              onChange={(v) => setBag((prev) => ({ ...prev, [f.name]: v }))}
            />
          ))}
        </div>
      ) : (
        <>
          {rows.length === 0 ? (
            <div className="bg-[#111] border border-[#222] rounded-xl p-8 text-center">
              <p className="text-white/40 text-sm">
                Nenhum item. {section.emptyEffect}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {rows.map((row, i) => (
                <div
                  key={i}
                  className="bg-[#111] border border-[#222] rounded-xl p-5"
                >
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <span className="text-white/40 text-xs uppercase tracking-wider font-medium">
                      {section.itemLabel} {i + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        aria-label="Mover para cima"
                        className="text-white/40 hover:text-white text-xs px-2 py-1 rounded disabled:opacity-20"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => move(i, 1)}
                        disabled={i === rows.length - 1}
                        aria-label="Mover para baixo"
                        className="text-white/40 hover:text-white text-xs px-2 py-1 rounded disabled:opacity-20"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setRows((prev) => prev.filter((_, j) => j !== i))
                        }
                        className="text-red-400/70 hover:text-red-400 text-xs px-2 py-1 rounded ml-1"
                      >
                        Remover
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    {section.fields.map((f) => (
                      <Field
                        key={f.name}
                        field={f}
                        value={row[f.name]}
                        onChange={(v) => patchRow(i, f.name, v)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, {}])}
            className="text-gold-500 hover:text-gold-400 text-sm font-medium border border-dashed border-[#2a2a2a] hover:border-gold-500/40 rounded-xl py-3 transition-colors"
          >
            + Adicionar {section.itemLabel.toLowerCase()}
          </button>
        </>
      )}

      {state.error && <p className="text-red-400 text-sm">{state.error}</p>}
      {state.ok && (
        <p className="text-emerald-400 text-sm">
          Seção salva. A página do parceiro já está atualizada.
        </p>
      )}

      <div className="flex gap-3">
        <SubmitButton />
        <a
          href={`/admin/parceiros/${partnerId}/conteudo`}
          className="px-6 py-3 rounded-lg border border-[#2a2a2a] text-white/60 hover:text-white text-sm font-medium flex items-center"
        >
          Voltar
        </a>
      </div>
    </form>
  );
}

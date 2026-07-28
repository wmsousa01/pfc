"use client";

/**
 * Select que envia o formulário ao mudar — evita um botão "salvar" por linha
 * nas tabelas de pedidos.
 */
export default function StatusSelect({
  name,
  value,
  options,
  className = "",
}: {
  name: string;
  value: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <select
      name={name}
      defaultValue={value}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className={`bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-gold-500/50 ${className}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

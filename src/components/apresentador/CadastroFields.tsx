import { inputCls } from "@/components/agenda/BriefingFields";
import type { Cadastro } from "@/lib/apresentadores/store";
import { QUADROS, QUADRO_IDS } from "@/lib/producao/quadros";

const label = "block text-white/70 text-sm font-semibold mb-1.5";
const hint = "text-white/35 text-xs mt-1";

/** Dados do apresentador: os mesmos no cadastro e na página pessoal. */
export default function CadastroFields({ c, quadrosTravados = false }: { c?: Cadastro | null; quadrosTravados?: boolean }) {
  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={label} htmlFor="nome">Seu nome no programa *</label>
          <input id="nome" name="nome" required maxLength={120} defaultValue={c?.nome} className={inputCls} placeholder="Como você é chamado no ar" />
        </div>
        <div>
          <label className={label} htmlFor="papel">Como aparece na arte</label>
          <input id="papel" name="papel" maxLength={60} defaultValue={c?.papel ?? ""} className={inputCls} placeholder="Ex.: APRESENTADOR · HOST · COMENTARISTA" />
          <p className={hint}>Sai embaixo do seu nome nas artes de divulgação.</p>
        </div>
        <div>
          <label className={label} htmlFor="whatsapp">WhatsApp *</label>
          <input id="whatsapp" name="whatsapp" required inputMode="tel" defaultValue={c?.whatsapp ?? ""} className={inputCls} placeholder="(19) 99999-9999" />
        </div>
        <div>
          <label className={label} htmlFor="email">E-mail *</label>
          <input id="email" name="email" type="email" required defaultValue={c?.email ?? ""} className={inputCls} placeholder="voce@email.com" />
        </div>
        <div className="sm:col-span-2">
          <label className={label} htmlFor="instagram">Instagram</label>
          <input id="instagram" name="instagram" defaultValue={c?.instagram ? `@${c.instagram}` : ""} className={inputCls} placeholder="@seuperfil" />
          <p className={hint}>Para marcar você nas artes e nos posts em collab.</p>
        </div>
      </div>

      <fieldset>
        <legend className={label}>Quadro que você apresenta *</legend>
        <div className="flex flex-wrap gap-2">
          {QUADRO_IDS.map((q) => (
            <label
              key={q}
              className="flex items-center gap-2 bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white/80 has-[:checked]:border-gold-500/60 has-[:checked]:text-white"
            >
              <input type="checkbox" name="quadro" value={q} defaultChecked={c?.quadros.includes(q)} disabled={quadrosTravados} className="accent-gold-500" />
              {QUADROS[q].name}
            </label>
          ))}
        </div>
        {quadrosTravados && (
          <>
            {c?.quadros.map((q) => <input key={q} type="hidden" name="quadro" value={q} />)}
            <p className={hint}>Para mudar de quadro, fale com a produção.</p>
          </>
        )}
      </fieldset>

      <div>
        <label className={label} htmlFor="bio">Sobre você</label>
        <textarea id="bio" name="bio" rows={4} maxLength={2000} defaultValue={c?.bio ?? ""} className={inputCls} placeholder="Algumas linhas para a produção usar na apresentação e nas legendas." />
      </div>
    </div>
  );
}

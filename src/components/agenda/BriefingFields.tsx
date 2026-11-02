import type { Convidado } from "@/lib/agenda/store";

export const inputCls =
  "w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold-500/60 transition-colors";
const label = "block text-white/70 text-sm font-semibold mb-1.5";
const hint = "text-white/35 text-xs mt-1";

/** Os dados e o briefing do convidado: os mesmos no pedido e no link dele. */
export default function BriefingFields({ c }: { c?: Convidado | null }) {
  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={label} htmlFor="nome">Seu nome *</label>
          <input id="nome" name="nome" required maxLength={120} defaultValue={c?.nome} className={inputCls} placeholder="Como quer ser chamado no programa" />
        </div>
        <div>
          <label className={label} htmlFor="instagram">Instagram</label>
          <input id="instagram" name="instagram" defaultValue={c?.instagram ? `@${c.instagram}` : ""} className={inputCls} placeholder="@seuperfil" />
          <p className={hint}>Vamos te marcar na arte e convidar para um post em collab.</p>
        </div>
        <div className="sm:col-span-2">
          <label className={label} htmlFor="cargo">Como você quer aparecer na arte</label>
          <input id="cargo" name="cargo" maxLength={60} defaultValue={c?.cargo ?? ""} className={inputCls} placeholder="Ex.: EMPRESÁRIO · GCM CLASSE ESPECIAL | GOC · FUNDADORA DA MARCA X" />
          <p className={hint}>Sai embaixo do seu nome na divulgação.</p>
        </div>
        <div>
          <label className={label} htmlFor="whatsapp">WhatsApp *</label>
          <input id="whatsapp" name="whatsapp" required inputMode="tel" defaultValue={c?.whatsapp ?? ""} className={inputCls} placeholder="(19) 99999-9999" />
        </div>
        <div>
          <label className={label} htmlFor="email">E-mail *</label>
          <input id="email" name="email" type="email" required defaultValue={c?.email ?? ""} className={inputCls} placeholder="voce@email.com" />
          <p className={hint}>O convite da agenda chega aqui.</p>
        </div>
      </div>

      <div>
        <label className={label} htmlFor="foto">Sua foto {c?.foto_path && <span className="text-emerald-400 font-normal">· já enviada (mande outra para trocar)</span>}</label>
        <input id="foto" name="foto" type="file" accept="image/jpeg,image/png,image/webp" className="text-sm text-white/60" />
        <p className={hint}>
          Do peito para cima, de frente, com boa luz e fundo simples, até 6 MB. Ela vai para a arte de divulgação —
          sem foto, usamos a do seu Instagram. Mais fotos, logo e outros materiais você manda na página do seu link.
        </p>
      </div>

      <div>
        <label className={label} htmlFor="bio">Quem é você</label>
        <textarea id="bio" name="bio" rows={3} defaultValue={c?.bio ?? ""} className={inputCls} placeholder="O que você faz, sua empresa ou projeto, sua história em poucas linhas" />
      </div>
      <div>
        <label className={label} htmlFor="temas">Sobre o que quer conversar</label>
        <textarea id="temas" name="temas" rows={3} defaultValue={c?.temas ?? ""} className={inputCls} placeholder="Assuntos, histórias boas, o que ninguém te pergunta e deveria" />
      </div>
      <div>
        <label className={label} htmlFor="divulgar">O que quer divulgar</label>
        <textarea id="divulgar" name="divulgar" rows={2} defaultValue={c?.divulgar ?? ""} className={inputCls} placeholder="Empresa, evento, lançamento, causa..." />
      </div>
      <div>
        <label className={label} htmlFor="links">Links</label>
        <input id="links" name="links" defaultValue={c?.links ?? ""} className={inputCls} placeholder="Site, LinkedIn, outro perfil" />
      </div>
    </div>
  );
}

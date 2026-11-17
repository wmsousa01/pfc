import CampanhaFundador from "@/components/CampanhaFundador";
import QuadroLogo from "@/components/QuadroLogo";
import { quadros, quadroSponsorship, whatsapp, type CotaStatus } from "@/lib/config";
import { WhatsAppIcon } from "@/components/icons";

/**
 * Vitrine do patrocínio por quadro (/parcerias#patrocinio-por-quadro).
 * Só entram os quadros com `cota` em config.ts; o status da cota master é
 * mudado lá (disponivel → negociacao → vendida).
 */

const STATUS: Record<CotaStatus, { label: string; cls: string }> = {
  disponivel: {
    label: "Cota master disponível",
    cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
  },
  negociacao: {
    label: "Cota master em negociação",
    cls: "bg-amber-500/10 text-amber-400 border-amber-500/25",
  },
  vendida: {
    label: "Cota master vendida",
    cls: "bg-white/5 text-white/45 border-white/10",
  },
};

const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;

export default function QuadroSponsorship() {
  const comCota = quadros.filter((q) => q.cota);
  const { master, apoio, minMonths } = quadroSponsorship;

  return (
    <section id="patrocinio-por-quadro" className="section-py bg-[#0a0a0a] border-y border-[#1e1e1e]">
      <div className="container-px">
        <div className="text-center mb-12 max-w-2xl mx-auto">
          <span className="section-tag">Patrocínio por quadro</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mt-3 leading-tight">
            Sua marca <span className="text-gradient-gold">apresenta um quadro</span>
          </h2>
          <p className="text-white/50 mt-4 leading-relaxed">
            Em vez de aparecer no canal inteiro, sua marca fica com o quadro que conversa com o seu cliente. Uma cota
            master exclusiva por quadro e cotas de apoio a partir de {brl(apoio.modalidadePrice)}/mês para quem quer
            começar menor. Contratação mínima de{" "}
            {minMonths} meses.
          </p>
        </div>

        <CampanhaFundador className="max-w-4xl mx-auto mb-8" />

        {/* As duas cotas */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <div className="bg-[#0d0d0d] border-2 border-gold-500 rounded-2xl p-7 flex flex-col">
            <span className="text-xs font-bold uppercase tracking-widest text-gold-500">Exclusiva · 1 por quadro</span>
            <h3 className="text-2xl font-black mt-2">{master.name}</h3>
            <div className="flex items-baseline gap-2 mt-4">
              <span className="text-3xl font-black text-gold-500">{brl(master.monthlyPrice)}</span>
              <span className="text-white/40 text-sm">/mês</span>
            </div>
            <p className="text-white/40 text-xs mt-1.5">
              Contrato mínimo de {minMonths} meses, cobrança mensal no Pix ou cartão. Contrato anual sob proposta.
            </p>
            <ul className="mt-5 flex flex-col gap-2.5 flex-1">
              {master.features.map((f) => (
                <li key={f} className="flex gap-3 text-sm text-white/70 leading-snug">
                  <span className="text-gold-500">✓</span>
                  {f.replace("{quadro}", "Quadro").replace("{marca}", "sua marca")}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl p-7 flex flex-col">
            <span className="text-xs font-bold uppercase tracking-widest text-white/40">Sem exclusividade</span>
            <h3 className="text-2xl font-black mt-2">{apoio.name}</h3>
            <div className="flex items-baseline gap-2 mt-4">
              <span className="text-3xl font-black text-white">{brl(apoio.monthlyPrice)}</span>
              <span className="text-white/40 text-sm">/mês</span>
            </div>
            <p className="text-white/40 text-xs mt-1.5">
              Contrato mínimo de {minMonths} meses, cobrança mensal no Pix ou cartão.
            </p>
            <p className="text-white/60 text-sm mt-4 leading-relaxed bg-white/[0.03] border border-white/[0.08] rounded-xl p-3">
              <span className="text-gold-500 font-semibold">Por modalidade ({brl(apoio.modalidadePrice)}/mês): </span>
              {apoio.modalidade}
            </p>
            <ul className="mt-5 flex flex-col gap-2.5 flex-1">
              {apoio.features.map((f) => (
                <li key={f} className="flex gap-3 text-sm text-white/70 leading-snug">
                  <span className="text-white/40">✓</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Quadros com cota */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
          {comCota.map((q) => {
            const st = STATUS[q.cota!.status];
            const vendida = q.cota!.status === "vendida";
            return (
              <div
                key={q.slug}
                className="relative bg-[#111] border border-[#222] rounded-2xl p-5 flex flex-col gap-3"
              >
                {q.isNew && (
                  <span className="absolute -top-3 right-4 bg-gold-500 text-black text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest">
                    Novo
                  </span>
                )}
                <div className="flex items-center gap-3">
                  <QuadroLogo quadro={q.slug} nome={q.name} className="w-12 h-12" />
                  <div className="text-white font-bold leading-tight">{q.name}</div>
                </div>
                <span className={`self-start text-[11px] font-semibold px-2.5 py-1 rounded-full border ${st.cls}`}>
                  {vendida && q.cota!.sponsor ? `Apresentado por ${q.cota!.sponsor}` : st.label}
                </span>
                <p className="text-white/40 text-xs leading-relaxed flex-1">
                  <span className="text-white/60 font-semibold">Combina com: </span>
                  {q.sponsorProfile}
                </p>
                {q.modalidades && q.modalidades.length > 0 && (
                  <div className="flex flex-col gap-2 border-t border-[#222] pt-3">
                    <span className="text-white/50 text-[11px] font-bold uppercase tracking-widest">
                      Apoio por modalidade
                    </span>
                    {q.modalidades.map((m) => {
                      const livre = m.status !== "vendida";
                      return (
                        <a
                          key={m.nome}
                          href={
                            livre
                              ? whatsapp(`Quero a cota de apoio de ${m.nome} no quadro ${q.name}`)
                              : undefined
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${
                            livre
                              ? "border-white/10 text-white/75 hover:border-gold-500/50 hover:text-white transition-colors"
                              : "border-white/5 text-white/35 pointer-events-none"
                          }`}
                        >
                          <span className="font-semibold">{m.nome}</span>
                          <span className={`px-2 py-0.5 rounded-full border ${STATUS[m.status].cls}`}>
                            {m.status === "vendida" && m.sponsor
                              ? m.sponsor
                              : m.status === "disponivel"
                                ? "Disponível"
                                : m.status === "negociacao"
                                  ? "Em negociação"
                                  : "Vendida"}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                )}
                <a
                  href={whatsapp(
                    vendida
                      ? `Quero uma cota de apoio no quadro ${q.name}`
                      : `Quero patrocinar o quadro ${q.name} (cota master ou apoio)`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold text-white/80 hover:border-gold-500/50 hover:text-white transition-colors"
                >
                  <WhatsAppIcon className="w-4 h-4" />
                  {vendida ? "Quero ser apoio" : "Quero patrocinar"}
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

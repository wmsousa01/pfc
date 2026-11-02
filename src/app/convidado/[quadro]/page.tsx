import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProducaoForm from "@/components/admin/ProducaoForm";
import BriefingFields from "@/components/agenda/BriefingFields";
import { TZ, WEEKDAYS, brtDate, vagasLivres } from "@/lib/agenda/store";
import { QUADROS, isQuadroId } from "@/lib/producao/quadros";
import { agendarAction } from "../actions";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { quadro: string } }): Metadata {
  const nome = isQuadroId(params.quadro) ? QUADROS[params.quadro].name : "Fora da Caixa";
  return { title: `Agende sua participação no ${nome} | Fora da Caixa` };
}

function diaLabel(iso: string): string {
  const d = new Date(iso);
  const wd = WEEKDAYS[new Date(`${brtDate(d)}T12:00:00-03:00`).getUTCDay()];
  return `${wd}, ${d.toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "long" })}`;
}

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

export default async function AgendarPage({ params }: { params: { quadro: string } }) {
  if (!isQuadroId(params.quadro)) notFound();
  const t = QUADROS[params.quadro];
  const vagas = await vagasLivres(params.quadro);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#0a0a0a] pt-28 pb-20">
        <div className="container-px max-w-3xl">
          <a href="/convidado" className="text-white/40 hover:text-white text-sm">← Quadros</a>
          <h1 className="text-3xl sm:text-4xl font-black mt-3 leading-tight">
            Sua participação no <span style={{ color: t.accent[1] }}>{t.name}</span>
          </h1>

          {vagas.length === 0 ? (
            <p className="text-white/55 mt-8">
              Os horários das próximas semanas já foram preenchidos. Volte em alguns dias ou fale com a produção.
            </p>
          ) : (
            <ProducaoForm
              action={agendarAction}
              label="Pedir este horário"
              pending="Enviando..."
              className="mt-8 space-y-8"
              buttonClassName="btn-primary w-full py-4 rounded-xl text-base font-bold"
            >
              <input type="hidden" name="quadro" value={t.id} />
              <input type="text" name="site_url" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

              <fieldset>
                <legend className="text-white font-bold mb-3">1. Escolha o horário</legend>
                <div className="grid sm:grid-cols-2 gap-2">
                  {vagas.map((v, i) => (
                    <label
                      key={v.inicio}
                      className="flex items-center gap-3 bg-[#111] border border-[#222] rounded-xl px-4 py-3 cursor-pointer has-[:checked]:border-gold-500/70 has-[:checked]:bg-gold-500/10"
                    >
                      <input type="radio" name="inicio" value={v.inicio} required defaultChecked={i === 0} className="accent-yellow-400" />
                      <span className="text-sm">
                        <span className="text-white font-semibold capitalize">{diaLabel(v.inicio)}</span>
                        <span className="text-white/50"> · {hora(v.inicio)}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-white font-bold mb-3">2. Conte sobre você</legend>
                <BriefingFields />
              </fieldset>
            </ProducaoForm>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

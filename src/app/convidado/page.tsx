import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { WEEKDAYS, listSlots, quadrosAbertos } from "@/lib/agenda/store";
import { QUADROS } from "@/lib/producao/quadros";

export const metadata: Metadata = {
  title: "Seja convidado | Fora da Caixa",
  description: "Escolha o quadro e o horário da sua participação ao vivo no Fora da Caixa, de Mogi Guaçu.",
};

export const dynamic = "force-dynamic";

/** Entrada do link público: o convidado escolhe o quadro e segue para os horários. */
export default async function ConvidadoPage() {
  const [quadros, slots] = await Promise.all([quadrosAbertos(), listSlots()]);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#0a0a0a] pt-28 pb-20">
        <div className="container-px max-w-3xl">
          <span className="section-tag">Seja convidado</span>
          <h1 className="text-3xl sm:text-4xl font-black mt-3 leading-tight">
            Escolha o quadro e <span className="text-gradient-gold">marque seu horário</span>
          </h1>
          <p className="text-white/55 mt-4 leading-relaxed">
            Os episódios são gravados ao vivo no estúdio, em Mogi Guaçu, e ficam no YouTube. Escolha o horário, conte
            um pouco sobre você e a produção confirma pelo WhatsApp.
          </p>

          {quadros.length === 0 ? (
            <p className="text-white/50 mt-10">Nenhum quadro com agenda aberta agora. Volte em breve.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4 mt-10">
              {quadros.map((q) => {
                const t = QUADROS[q];
                const dias = slots
                  .filter((s) => s.quadro === q && s.ativo)
                  .map((s) => `${WEEKDAYS[s.weekday]}s, ${s.hora.replace(":00", "h")}`);
                return (
                  <a
                    key={q}
                    href={`/convidado/${q}`}
                    className="card-hover block bg-[#111] border border-[#222] rounded-2xl p-6 hover:border-gold-500/40"
                  >
                    <span
                      className="text-xs font-black px-2.5 py-1 rounded-md"
                      style={{
                        color: t.selo.text,
                        background: t.selo.bg2 ? `linear-gradient(90deg, ${t.selo.bg} 50%, ${t.selo.bg2} 50%)` : t.selo.bg,
                      }}
                    >
                      {t.name.toUpperCase()}
                    </span>
                    <p className="text-white/60 text-sm mt-4">{dias.join(" · ")}</p>
                    <p className="text-gold-400 text-sm font-semibold mt-3">Ver horários →</p>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

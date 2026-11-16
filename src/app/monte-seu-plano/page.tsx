import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import MonteSeuPlano from "@/components/MonteSeuPlano";

export const metadata: Metadata = {
  title: "Monte seu plano | Fora da Caixa",
  description:
    "Conte da sua marca e dos seus objetivos e veja na hora a combinação de patrocínio que faz sentido, com o preço estimado. Sem pagamento: o comercial confirma e fecha com você.",
};

export default function MonteSeuPlanoPage() {
  return (
    <main className="bg-dark-900 text-white overflow-x-hidden">
      <Navbar />
      <section className="pt-32 pb-20 lg:pt-40 bg-[#0a0a0a] min-h-screen">
        <div className="container-px max-w-3xl mx-auto text-center mb-10">
          <span className="section-tag">Monte seu plano</span>
          <h1 className="text-4xl sm:text-5xl font-black mt-3 leading-[1.05] tracking-tight">
            Em 2 minutos, o plano certo <span className="text-gradient-gold">com o preço na tela</span>
          </h1>
          <p className="text-white/60 mt-4 leading-relaxed">
            Conte sobre a sua marca e o que você quer alcançar. A gente sugere a combinação, você ajusta como quiser e
            o comercial só confirma.
          </p>
        </div>
        <MonteSeuPlano />
      </section>
      <Footer />
      <WhatsAppButton />
    </main>
  );
}

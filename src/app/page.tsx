import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import ChannelStats from "@/components/ChannelStats";
import Quadros from "@/components/Quadros";
import OndeAssistir from "@/components/OndeAssistir";
import About from "@/components/About";
import ParceriasTeaser from "@/components/ParceriasTeaser";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";

// ISR: revalida a home a cada 30 min (mantém os vídeos do YouTube atualizados).
export const revalidate = 1800;

export default function Home() {
  return (
    <main className="bg-dark-900 text-white overflow-x-hidden">
      <Navbar />
      <Hero />
      <ChannelStats />
      <Quadros />
      <OndeAssistir />
      <About />
      <ParceriasTeaser />
      <FinalCTA />
      <Footer />
      <WhatsAppButton />
    </main>
  );
}

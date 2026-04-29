import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import SocialProof from "@/components/SocialProof";
import About from "@/components/About";
import Ecosystem from "@/components/Ecosystem";
import Exposure from "@/components/Exposure";
import Plans from "@/components/Plans";
import Differentials from "@/components/Differentials";
import HowItWorks from "@/components/HowItWorks";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";

export default function Home() {
  return (
    <main className="bg-dark-900 text-white overflow-x-hidden">
      <Navbar />
      <Hero />
      <SocialProof />
      <About />
      <Ecosystem />
      <Exposure />
      <Plans />
      <Differentials />
      <HowItWorks />
      <FinalCTA />
      <Footer />
      <WhatsAppButton />
    </main>
  );
}

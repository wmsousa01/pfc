import type { Metadata } from "next";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import VideoFacade from "@/components/VideoFacade";
import { channelStats, whatsapp } from "@/lib/config";
import { WhatsAppIcon, ArrowRight, InstagramIcon } from "@/components/icons";
import { installmentLabel, PAYMENT_TERMS_CASH } from "@/lib/payment";

export const metadata: Metadata = {
  title: "PFC Visita: um episódio inteiro sobre o seu negócio | Fora da Caixa",
  description:
    "A câmera do Fora da Caixa vai até a sua empresa em Mogi Guaçu e grava um episódio contando a sua história. Episódio no canal, shorts, post em collab, QR rastreado e os arquivos são seus.",
};

/**
 * Página de venda do PFC Visita como produto AVULSO.
 *
 * A Visita é um quadro à parte: não entra obrigatoriamente em nenhum plano de
 * patrocínio. Quem já é cliente (qualquer plano ativo) paga menos — é o motivo
 * para assinar, sem forçar ninguém a subir de plano só por causa dela.
 *
 * O que a página NÃO faz: prometer views por episódio. Os episódios de Visita
 * ficaram entre dezenas e algumas centenas de visualizações no YouTube; a venda
 * se apoia no que o cliente leva (um episódio sobre ele, para sempre no ar, e
 * os arquivos) e nos números do canal, nunca em audiência garantida.
 *
 * Preço definido em 10/2026: acima do pacote "Do Zero" de /cortes (R$ 1.390),
 * porque além da produção externa a Visita sai no canal do PFC.
 */

/**
 * Avulso parcela até 3x sem juros (líquido ~R$ 1.498, ainda acima do "Do
 * Zero"). O preço de cliente já é desconto: só à vista — ver lib/payment.
 */
const VALOR_AVULSO = 1690;
const PRECO_AVULSO = "R$ 1.690";
const PRECO_CLIENTE = "R$ 1.350";

const CTA_MSG = "Vi a página do PFC Visita e quero levar a câmera para o meu negócio";

/** Episódios publicados do quadro (playlist PFC Visita), mais recente primeiro. */
const episodios = [
  {
    id: "YTH0BPYZo6c",
    negocio: "TFY",
    ramo: "Moda masculina e feminina",
    titulo: "Você sabe o que é elegância de verdade?",
  },
  {
    id: "ht--Kxrmg9s",
    negocio: "Silvério Filtros",
    ramo: "Filtros e purificadores de água",
    titulo: "Do estoque numa caixa de papelão a referência na cidade",
  },
  {
    id: "1vw48WTJkPg",
    negocio: "Geladeiras & Cia",
    ramo: "Venda e aluguel de refrigeração",
    titulo: "A verdade sobre freezer, cervejeira e geladeira",
  },
  {
    id: "F0IVRhuFn_M",
    negocio: "Churros Pappito",
    ramo: "Confeitaria e food service",
    titulo: "Churros que não é churro",
  },
];

/**
 * Posts em collab das Visitas no @papoforadacaixapdc. Números lidos à mão em
 * 22/10/2026; o Instagram não expõe contagem sem login, então só entram os
 * que deu para conferir.
 */
const postsInstagram = [
  {
    url: "https://www.instagram.com/p/DWWfPWjEyio/",
    negocio: "Silvério Filtros",
    legenda: "Começou do zero, vendeu tudo para apostar em purificadores de água.",
    prova: "73 curtidas · 11 comentários",
  },
  {
    url: "https://www.instagram.com/p/DU045mGjbYd/",
    negocio: "Geladeiras & Cia",
    legenda: "A diferença entre geladeira, cervejeira e freezer.",
    prova: "Anúncio da estreia, em collab",
  },
  {
    url: "https://www.instagram.com/p/DczXeBohhtv/",
    negocio: "Corte da Visita",
    legenda: "Cliente não quer produto, quer solução.",
    prova: "Short publicado pelo PFC",
  },
];

const entregas = [
  {
    t: "Um episódio inteiro sobre você",
    d: "De 20 a 40 minutos no canal do Fora da Caixa, contando a história, o produto e o jeito do seu negócio. Fica no ar para sempre e aparece para quem procura o seu ramo no YouTube.",
  },
  {
    t: "4 shorts verticais",
    d: "Os melhores momentos viram Reels e Shorts publicados pelo PFC — o formato que mais roda no canal.",
  },
  {
    t: "Post em collab no Instagram",
    d: "Publicado no perfil do PFC e no seu ao mesmo tempo. Os seguidores dos dois veem.",
  },
  {
    t: "QR rastreado + página da sua marca",
    d: "Durante 30 dias, o QR leva o público a uma página sua no site do PFC, com botão direto para o seu WhatsApp.",
  },
  {
    t: "Relatório de 30 dias",
    d: "Quantas pessoas acessaram, quantas vieram pelo QR e quantas chamaram você. Número, não impressão.",
  },
  {
    t: "Os arquivos são seus",
    d: "Você recebe os shorts para postar no seu perfil, usar em anúncio, mandar no WhatsApp e mostrar na loja.",
  },
];

const passos = [
  {
    n: "1",
    t: "Conversa de 10 minutos",
    d: "No WhatsApp. Entendemos o seu negócio e o que vale mostrar.",
  },
  {
    n: "2",
    t: "Agendamos a gravação",
    d: "Combinamos com você o dia e o horário que melhor encaixam no seu movimento.",
  },
  {
    n: "3",
    t: "Até 2 horas no seu espaço",
    d: "A equipe chega, monta e conduz a conversa. Você só mostra o que já faz todo dia.",
  },
  {
    n: "4",
    t: "Episódio no ar",
    d: "Editamos e publicamos o episódio no canal, junto com os shorts e o post em collab.",
  },
];

const faq = [
  {
    q: "Não sei falar em câmera. Vai dar certo?",
    a: "Vai. Quem conduz é o apresentador: ele pergunta, você responde sobre o que conhece melhor que ninguém — o seu negócio. É conversa, não discurso. Ninguém decora texto.",
  },
  {
    q: "Vira propaganda chata?",
    a: "Não, e é por isso que funciona. A Visita conta a história de quem está por trás do balcão e ensina alguma coisa útil sobre o seu ramo. Veja o da Geladeiras & Cia: é sobre a diferença entre freezer e cervejeira, e no caminho todo mundo descobre onde alugar.",
  },
  {
    q: "Preciso fechar a loja?",
    a: "Não. A gravação leva até 2 horas e a gente se adapta ao movimento. Muitas vezes o cliente entrando e o dia a dia acontecendo deixam o episódio melhor.",
  },
  {
    q: "Quantas pessoas vão assistir?",
    a: `Não prometemos número por episódio — quem promete está chutando. O canal somou ${channelStats.views12m} visualizações nos últimos 12 meses, quase tudo de Mogi Guaçu e região. O que garantimos é medir: o relatório mostra quem foi atrás de você pelo QR.`,
  },
  {
    q: "Minha empresa fica fora de Mogi Guaçu.",
    a: "Atendemos a região. Até 30 km de Mogi Guaçu, somamos R$ 150 de deslocamento. Mais longe que isso, a gente conversa.",
  },
  {
    q: "Já sou patrocinador. A Visita está inclusa?",
    a: `A Visita é um quadro à parte, contratado separadamente. Mas quem tem plano ativo paga ${PRECO_CLIENTE} em vez de ${PRECO_AVULSO}.`,
  },
];

export default function PfcVisitaPage() {
  const cta = whatsapp(CTA_MSG);

  return (
    <main className="bg-dark-900 text-white overflow-x-hidden pb-20 lg:pb-0">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-32 pb-16 lg:pt-40 lg:pb-20 overflow-hidden bg-[#0a0a0a]">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gold-500/[0.06] rounded-full blur-[120px]" />
        </div>
        <div className="container-px relative max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <div className="flex flex-col gap-6 text-center lg:text-left items-center lg:items-start">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gold-500 animate-pulse" />
              <span className="section-tag">PFC Visita · Gravado no seu negócio</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-[3.4rem] font-black leading-[1.05] tracking-tight">
              A câmera do PFC vai até o seu negócio.{" "}
              <span className="text-gradient-gold">
                E a cidade conhece quem está por trás do balcão.
              </span>
            </h1>
            <p className="text-lg text-white/65 leading-relaxed max-w-xl">
              Um episódio inteiro gravado no seu espaço, contando a sua história.
              Anúncio diz o preço. A Visita mostra por que vale confiar em você.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <a
                href={cta}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary px-8 py-4 rounded-xl text-base flex items-center gap-3"
              >
                <WhatsAppIcon className="w-5 h-5" />
                Quero agendar minha Visita
              </a>
              <a
                href="#preco"
                className="px-6 py-4 rounded-xl text-base font-bold text-white/70 hover:text-white transition-colors flex items-center gap-2"
              >
                Ver o que está incluso
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
            <p className="text-white/40 text-sm">
              A partir de{" "}
              <strong className="text-white/75">{PRECO_CLIENTE}</strong> para
              clientes do PFC · {PRECO_AVULSO} avulso
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <VideoFacade
              id="1vw48WTJkPg"
              title="PFC Visita na Geladeiras & Cia"
            />
            <p className="text-white/40 text-xs text-center lg:text-left">
              Assista: o PFC Visita na Geladeiras & Cia, em Mogi Guaçu.
            </p>
          </div>
        </div>
      </section>

      {/* Números do canal */}
      <section className="border-y border-[#1e1e1e] bg-[#111]">
        <div className="container-px max-w-5xl mx-auto grid grid-cols-3 divide-x divide-[#222] py-8">
          {[
            { v: channelStats.views12m, l: "visualizações em 12 meses" },
            { v: channelStats.weeklyContent, l: "conteúdos por semana" },
            { v: String(episodios.length), l: "negócios da região já visitados" },
          ].map((s) => (
            <div key={s.l} className="text-center px-2">
              <div className="text-gradient-gold font-black text-2xl sm:text-3xl">
                {s.v}
              </div>
              <div className="text-white/45 text-xs sm:text-sm mt-1 leading-snug">
                {s.l}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Problema */}
      <section className="section-py">
        <div className="container-px max-w-3xl mx-auto text-center">
          <span className="section-tag">Por que a Visita</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mt-3 leading-tight">
            Seu cliente compra de quem ele{" "}
            <span className="text-gradient-gold">sente que conhece</span>
          </h2>
          <p className="text-white/60 mt-6 leading-relaxed text-lg">
            Panfleto, carro de som e post patrocinado falam de produto e preço.
            Nenhum deles conta que você começou do zero, que atende pelo nome,
            que entende do assunto melhor que a concorrência. É isso que faz
            alguém atravessar a cidade para comprar de você — e é isso que a
            Visita grava.
          </p>
        </div>
      </section>

      {/* Episódios */}
      <section className="section-py bg-[#111] border-y border-[#1e1e1e]">
        <div className="container-px max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="section-tag">Quem já recebeu a Visita</span>
            <h2 className="text-3xl sm:text-4xl font-black mt-3 leading-tight">
              Negócios daqui, contados por inteiro
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {episodios.map((e) => (
              <a
                key={e.id}
                href={`https://www.youtube.com/watch?v=${e.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="card-hover group bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl overflow-hidden flex flex-col"
              >
                <div className="relative aspect-video bg-black">
                  <Image
                    src={`https://i.ytimg.com/vi/${e.id}/hqdefault.jpg`}
                    alt={`PFC Visita na ${e.negocio}`}
                    fill
                    sizes="(min-width: 1024px) 280px, (min-width: 640px) 50vw, 100vw"
                    className="object-cover opacity-85 group-hover:opacity-100 transition-opacity"
                  />
                </div>
                <div className="p-5 flex flex-col gap-1">
                  <div className="text-white font-black">{e.negocio}</div>
                  <div className="text-gold-500/80 text-xs font-semibold">
                    {e.ramo}
                  </div>
                  <div className="text-white/50 text-sm leading-snug mt-2">
                    {e.titulo}
                  </div>
                </div>
              </a>
            ))}
          </div>

          <div className="mt-14">
            <div className="flex items-center gap-3 mb-5">
              <span className="text-white/35 text-[11px] font-bold uppercase tracking-widest">
                E no Instagram, em collab com o negócio
              </span>
              <div className="h-px flex-1 bg-[#222]" />
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {postsInstagram.map((p) => (
                <a
                  key={p.url}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card-hover bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl p-6 flex flex-col gap-3"
                >
                  <div className="flex items-center gap-2 text-white/45 text-xs">
                    <InstagramIcon className="w-4 h-4" />
                    @papoforadacaixapdc · {p.negocio}
                  </div>
                  <p className="text-white/75 leading-snug flex-1">
                    “{p.legenda}”
                  </p>
                  <div className="text-gold-500/80 text-xs font-semibold">
                    {p.prova}
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Entregas */}
      <section className="section-py">
        <div className="container-px max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="section-tag">O que você leva</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mt-3 leading-tight">
              Uma gravação.{" "}
              <span className="text-gradient-gold">Conteúdo para meses.</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {entregas.map((e) => (
              <div
                key={e.t}
                className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl p-7"
              >
                <div className="w-8 h-8 rounded-full bg-gold-500/15 border border-gold-500/30 flex items-center justify-center mb-4">
                  <span className="w-2 h-2 rounded-full bg-gold-500" />
                </div>
                <div className="text-white font-bold text-lg">{e.t}</div>
                <p className="text-white/50 text-sm leading-relaxed mt-2">
                  {e.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section className="section-py bg-[#111] border-y border-[#1e1e1e]">
        <div className="container-px max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="section-tag">Como funciona</span>
            <h2 className="text-3xl sm:text-4xl font-black mt-3 leading-tight">
              Você não precisa preparar nada
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {passos.map((p) => (
              <div key={p.n} className="flex flex-col gap-3">
                <span className="w-10 h-10 rounded-full bg-gold-500 text-black font-black flex items-center justify-center">
                  {p.n}
                </span>
                <div className="text-white font-bold">{p.t}</div>
                <p className="text-white/50 text-sm leading-relaxed">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Preço */}
      <section id="preco" className="section-py scroll-mt-20">
        <div className="container-px max-w-4xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="section-tag">Investimento</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mt-3 leading-tight">
              Preço fechado, tudo incluso
            </h2>
            <p className="text-white/55 mt-4 leading-relaxed">
              Sem mensalidade e sem fidelidade.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl p-8 flex flex-col">
              <div className="text-white/45 text-xs font-bold uppercase tracking-widest">
                Avulso
              </div>
              <div className="text-white font-black text-4xl mt-3">
                {PRECO_AVULSO}
              </div>
              <p className="text-white/55 text-sm mt-2">
                Pix à vista ou{" "}
                <strong className="text-white/80">
                  {installmentLabel(VALOR_AVULSO)}
                </strong>
              </p>
              <p className="text-white/50 text-sm mt-3 leading-relaxed flex-1">
                Para quem quer conhecer o PFC começando pela Visita.
              </p>
              <a
                href={cta}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-7 px-6 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border border-white/15 text-white/80 hover:border-gold-500/50 hover:text-white transition-colors"
              >
                <WhatsAppIcon className="w-4 h-4" />
                Agendar minha Visita
              </a>
            </div>

            <div className="relative rounded-2xl p-8 flex flex-col border-2 border-gold-500 bg-gradient-to-br from-gold-500/[0.08] to-transparent shadow-[0_0_50px_rgba(255,215,0,0.12)]">
              <span className="absolute -top-3.5 left-8 bg-gold-500 text-black text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                20% para clientes
              </span>
              <div className="text-gold-500 text-xs font-bold uppercase tracking-widest">
                Cliente do PFC
              </div>
              <div className="flex items-baseline gap-3 mt-3">
                <span className="text-gradient-gold font-black text-4xl">
                  {PRECO_CLIENTE}
                </span>
                <span className="text-white/35 line-through">
                  {PRECO_AVULSO}
                </span>
              </div>
              <p className="text-white/55 text-sm mt-2">
                {PAYMENT_TERMS_CASH}
              </p>
              <p className="text-white/55 text-sm mt-3 leading-relaxed flex-1">
                Para quem tem qualquer plano de patrocínio ativo: Apoio,
                Patrocinador ou Master.
              </p>
              <a
                href={whatsapp(
                  "Sou cliente do PFC e quero agendar o PFC Visita com o valor de cliente"
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary mt-7 px-6 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
              >
                <WhatsAppIcon className="w-4 h-4" />
                Sou cliente, quero agendar
              </a>
            </div>
          </div>

          <p className="text-center text-white/35 text-xs mt-6 leading-relaxed">
            Fora de Mogi Guaçu, até 30 km: + R$ 150 de deslocamento. Ainda não é
            cliente?{" "}
            <a href="/parcerias" className="text-gold-500/80 hover:text-gold-500">
              Conheça os planos de patrocínio
            </a>
            .
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-py bg-[#111] border-y border-[#1e1e1e]">
        <div className="container-px max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <span className="section-tag">Dúvidas</span>
            <h2 className="text-3xl sm:text-4xl font-black mt-3 leading-tight">
              O que perguntam antes de agendar
            </h2>
          </div>
          <div className="flex flex-col gap-4">
            {faq.map((o) => (
              <div
                key={o.q}
                className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl p-6"
              >
                <div className="text-white font-bold">{o.q}</div>
                <p className="text-white/50 text-sm leading-relaxed mt-2">
                  {o.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="section-py">
        <div className="container-px max-w-3xl mx-auto text-center flex flex-col items-center gap-6">
          <span className="section-tag">Agenda limitada</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight">
            A cidade já conhece o seu produto.{" "}
            <span className="text-gradient-gold">
              Agora deixa ela conhecer você.
            </span>
          </h2>
          <p className="text-white/55 leading-relaxed max-w-xl">
            São poucas Visitas por mês, agendadas por ordem de confirmação.
            Chama no WhatsApp e a gente marca o dia da sua gravação.
          </p>
          <a
            href={cta}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary px-8 py-4 rounded-xl text-base flex items-center gap-3"
          >
            <WhatsAppIcon className="w-5 h-5" />
            Quero agendar minha Visita
          </a>
        </div>
      </section>

      <Footer />

      {/* Barra fixa no celular: o link chega pelo WhatsApp e é lido no telefone */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0a0a0a]/95 backdrop-blur border-t border-[#222] px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-white font-black text-sm leading-tight">
            PFC Visita
          </div>
          <div className="text-white/45 text-xs">
            A partir de {PRECO_CLIENTE}
          </div>
        </div>
        <a
          href={cta}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary px-5 py-3 rounded-xl text-sm font-bold flex items-center gap-2 flex-shrink-0"
        >
          <WhatsAppIcon className="w-4 h-4" />
          Agendar
        </a>
      </div>
    </main>
  );
}

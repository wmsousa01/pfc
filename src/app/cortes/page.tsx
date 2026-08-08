import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import { whatsapp } from "@/lib/config";
import { WhatsAppIcon, ArrowRight } from "@/components/icons";

export const metadata: Metadata = {
  title: "Cortes para redes sociais em Mogi Guaçu | Fora da Caixa",
  description:
    "Serviço avulso de produção de cortes verticais para Reels, Shorts e TikTok. Você grava no estúdio ou envia seu material e recebe os vídeos prontos para postar nos seus canais. Sem mensalidade.",
};

/**
 * Página do produto AVULSO de cortes — deliberadamente fora do ecossistema
 * comercial do PFC.
 *
 * Regra que sustenta a página: aqui NÃO se vende patrocínio. O conteúdo é do
 * cliente, publicado nos canais do cliente. Nada de menção no episódio, nada de
 * QR rastreado, nada de relatório de alcance — isso é o produto de parceria e
 * mora em /parcerias. Misturar os dois canibaliza a tabela de patrocínio: se o
 * comerciante puder “aparecer no PFC” por R$ 690, ninguém assina o Patrocinador
 * de R$ 797. Por isso a seção “O que este serviço não é” existe e não deve ser
 * suavizada.
 *
 * O que se vende: hora de estúdio + hora de edição. Job fechado, sem
 * recorrência, sem fidelidade, sem cupom de revendedor.
 *
 * Preços definidos a partir da pesquisa de mercado de 08/2026: freelancer de
 * marketplace opera a R$ 20–50/corte e agência a R$ 100–150/corte. Ficamos na
 * faixa de agência de propósito — quem liga para um estúdio não está buscando o
 * mais barato, está buscando não ter que resolver sozinho. Margem alvo ≥55%.
 */

/** Porta A — o cliente já tem material gravado e só precisa da edição. */
const pacotesEdicao = [
  {
    nome: "Amostra",
    cortes: "3 cortes",
    preco: "R$ 390",
    unitario: "R$ 130 por corte",
    para: "Para testar o formato antes de investir mais.",
  },
  {
    nome: "Padrão",
    cortes: "6 cortes",
    preco: "R$ 690",
    unitario: "R$ 115 por corte",
    para: "Cobre três semanas postando duas vezes.",
    destaque: true,
  },
  {
    nome: "Volume",
    cortes: "10 cortes",
    preco: "R$ 1.050",
    unitario: "R$ 105 por corte",
    para: "Para quem já tem material longo acumulado.",
  },
];

/** Porta B — o cliente não tem nada gravado. É a venda maior. */
const pacotesEstudio = [
  {
    nome: "Do Zero",
    preco: "R$ 1.390",
    itens: [
      "1 hora de gravação no estúdio",
      "8 cortes verticais prontos para postar",
      "1 vídeo longo editado (16:9)",
      "Operador de câmera e áudio durante a gravação",
    ],
    destaque: true,
  },
  {
    nome: "Do Zero Plus",
    preco: "R$ 2.290",
    itens: [
      "2 horas de gravação no estúdio",
      "14 cortes verticais prontos para postar",
      "2 vídeos longos editados (16:9)",
      "Operador de câmera e áudio durante a gravação",
    ],
  },
];

const adicionais = [
  { item: "Corte extra dentro do mesmo job", preco: "R$ 120" },
  { item: "Hora extra de estúdio", preco: "R$ 390" },
  { item: "Versão 1:1 ou 16:9 de um corte já entregue", preco: "R$ 40" },
  { item: "Pauta e roteiro da gravação", preco: "R$ 290" },
  { item: "Capa (thumbnail) do vídeo longo", preco: "R$ 60" },
  { item: "Entrega express em 3 dias úteis", preco: "+30% no total" },
  { item: "Tratamento de material gravado fora de estúdio", preco: "R$ 150" },
];

const especificacao = [
  {
    t: "Formato vertical 9:16",
    d: "1080 × 1920, o mesmo arquivo serve para Reels, Shorts e TikTok.",
  },
  {
    t: "De 30 a 75 segundos",
    d: "A faixa em que o vídeo curto ainda segura a atenção até o fim.",
  },
  {
    t: "Legenda queimada no vídeo",
    d: "A maioria assiste sem som. Sem legenda, o corte não existe.",
  },
  {
    t: "Gancho nos 3 primeiros segundos",
    d: "O trecho escolhido começa no ponto que prende, não na saudação.",
  },
  {
    t: "Corte dinâmico e áudio tratado",
    d: "Pausas e repetições fora, volume nivelado, ruído reduzido.",
  },
  {
    t: "Chamada no final",
    d: "O fecho leva para o seu perfil, seu site ou seu WhatsApp.",
  },
];

const passos = [
  {
    n: "1",
    t: "Conversa de 10 minutos",
    d: "No WhatsApp. A gente entende o que você precisa, olha seu material se já existir e fecha o pacote.",
  },
  {
    n: "2",
    t: "Metade para entrar na fila",
    d: "50% na aprovação da proposta e 50% na entrega. Abaixo de R$ 500, valor integral antecipado.",
  },
  {
    n: "3",
    t: "Gravação ou envio do material",
    d: "Você grava no estúdio em Mogi Guaçu ou nos manda os arquivos originais por link.",
  },
  {
    n: "4",
    t: "Entrega em 7 dias úteis",
    d: "Link de download com todos os vídeos, disponível por 30 dias. Uma rodada de ajustes inclusa.",
  },
];

const regras = [
  {
    t: "Prazo",
    d: "7 dias úteis contados da aprovação do material. Express em 3 dias úteis por +30%.",
  },
  {
    t: "Revisão",
    d: "Uma rodada inclusa: ajuste de legenda, corte de ponta, troca de trilha. A partir da segunda rodada, R$ 90 por corte.",
  },
  {
    t: "Troca de trecho",
    d: "Escolher outro momento do vídeo não é revisão, é corte novo — R$ 120. É a regra que mantém o prazo de todo mundo de pé.",
  },
  {
    t: "Pagamento",
    d: "50% para entrar na fila, 50% na entrega. Jobs abaixo de R$ 500 são integralmente antecipados. Proposta válida por 15 dias.",
  },
  {
    t: "Direitos",
    d: "O material bruto e os vídeos entregues são seus. Podemos usar trechos em portfólio — basta avisar se você não quiser.",
  },
  {
    t: "Sem amarra",
    d: "Sem contrato de fidelidade, sem renovação automática, sem mensalidade. Acabou o job, acabou o compromisso.",
  },
];

const requisitos = [
  "Áudio captado por microfone dedicado — celular apoiado na mesa não sustenta um corte.",
  "Vídeo em 1080p ou superior.",
  "Arquivo original, não o vídeo reenviado pelo WhatsApp (a compressão destrói a imagem).",
];

const faq = [
  {
    q: "Os cortes vão para o canal do Fora da Caixa?",
    a: "Não. Aqui você está contratando produção: o conteúdo é seu e vai para os seus perfis. Aparecer dentro do canal e dos episódios do PFC é outra coisa — chama-se patrocínio e está em /parcerias.",
  },
  {
    q: "Vocês mandam relatório de visualizações?",
    a: "Não, e não teria como: quem publica é você, então os números ficam no painel do seu perfil. Na entrega a gente aponta o que vale olhar nas primeiras semanas, mas o relatório de desempenho é do lado de quem posta.",
  },
  {
    q: "Não sei falar em câmera. Consigo gravar?",
    a: "Consegue. Na gravação alguém do estúdio conduz a conversa e você só responde — é bem mais fácil que falar sozinho olhando para a lente. Se quiser chegar com o assunto já organizado, a pauta pronta é um adicional de R$ 290.",
  },
  {
    q: "Posso mandar uma gravação que fiz no celular?",
    a: "Depende do áudio. Imagem ruim a gente disfarça, áudio ruim não. Se o som estiver aproveitável, entra a taxa de tratamento de R$ 150. Se não estiver, é mais honesto regravar no estúdio do que entregar um corte que ninguém vai assistir até o fim.",
  },
  {
    q: "Por que não é mais barato? Vi gente cobrando R$ 40 por corte.",
    a: "Existe mesmo esse mercado, e ele entrega um arquivo cortado. O que muda aqui é quem escolhe o trecho: a maior parte do trabalho não é editar, é assistir uma hora de vídeo e achar os seis momentos que merecem virar peça. É isso que decide se o corte funciona.",
  },
  {
    q: "Preciso fechar quantos por mês?",
    a: "Nenhum. Este é um serviço avulso. Se depois do primeiro pacote você quiser manter frequência, a gente conversa sobre isso olhando o que aconteceu com os primeiros vídeos — não antes.",
  },
];

export default function CortesPage() {
  return (
    <main className="bg-dark-900 text-white overflow-x-hidden">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-32 pb-16 lg:pt-40 lg:pb-20 overflow-hidden bg-[#0a0a0a]">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gold-500/[0.06] rounded-full blur-[120px]" />
        </div>
        <div className="container-px relative max-w-3xl mx-auto text-center flex flex-col items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gold-500 animate-pulse" />
            <span className="section-tag">Serviço avulso · Sem mensalidade</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight">
            Você precisa aparecer toda semana.{" "}
            <span className="text-gradient-gold">
              Não precisa virar editor de vídeo.
            </span>
          </h1>
          <p className="text-lg text-white/65 leading-relaxed max-w-xl">
            Grave no nosso estúdio em Mogi Guaçu — ou mande o vídeo que você já
            tem — e receba os cortes prontos para postar no seu Instagram, TikTok
            e YouTube. Preço fechado por job. Sem contrato, sem fidelidade.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <a
              href="#pacotes"
              className="btn-primary px-8 py-4 rounded-xl text-base flex items-center gap-3"
            >
              Ver pacotes e preços
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href={whatsapp(
                "Vi a página de Cortes e quero um orçamento"
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 rounded-xl text-base font-bold border border-white/15 text-white/80 hover:border-gold-500/50 hover:text-white transition-colors flex items-center gap-2"
            >
              <WhatsAppIcon className="w-5 h-5" />
              Pedir orçamento
            </a>
          </div>
        </div>
      </section>

      {/* Para quem é / o que não é */}
      <section className="section-py bg-[#111] border-y border-[#1e1e1e]">
        <div className="container-px max-w-5xl mx-auto grid lg:grid-cols-2 gap-6">
          <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl p-8">
            <span className="section-tag">Para quem é</span>
            <h2 className="text-2xl sm:text-3xl font-black mt-3 leading-tight">
              Quem precisa de conteúdo próprio e não tem estrutura
            </h2>
            <ul className="mt-6 flex flex-col gap-3">
              {[
                "Profissional liberal que precisa aparecer para ser lembrado — advogado, médico, arquiteto, corretor, contador.",
                "Dono de negócio que sabe que devia postar vídeo e nunca senta para editar.",
                "Quem já grava live, aula ou reunião e não aproveita nada daquilo depois.",
                "Quem tentou fazer sozinho, viu quanto tempo consome e desistiu na terceira semana.",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gold-500 flex-shrink-0" />
                  <span className="text-white/55 text-sm leading-relaxed">
                    {t}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl p-8">
            <span className="section-tag">O que este serviço não é</span>
            <h2 className="text-2xl sm:text-3xl font-black mt-3 leading-tight">
              Aqui você não está comprando a nossa audiência
            </h2>
            <p className="text-white/55 mt-4 leading-relaxed text-sm">
              Vale dizer isso logo, para ninguém contratar esperando outra coisa.
              Este é um serviço de produção: usamos o estúdio, a câmera e a
              edição do Fora da Caixa para gerar vídeos que são{" "}
              <strong className="text-white/80">seus</strong>, publicados nos{" "}
              <strong className="text-white/80">seus</strong> canais.
            </p>
            <ul className="mt-5 flex flex-col gap-2.5 text-sm">
              {[
                "Não sai no canal do Fora da Caixa.",
                "Não tem menção do apresentador nem QR rastreado.",
                "Não vem com relatório de alcance — quem publica é você.",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="mt-1.5 text-white/25 font-bold">—</span>
                  <span className="text-white/50 leading-relaxed">{t}</span>
                </li>
              ))}
            </ul>
            <p className="text-white/40 text-sm leading-relaxed mt-5">
              Se o que você quer é justamente estar dentro dos episódios, na
              frente do público da cidade e com número no final, isso existe e é
              outro caminho.
            </p>
            <a
              href="/parcerias"
              className="inline-flex items-center gap-2 text-gold-500 font-bold text-sm mt-4 hover:gap-3 transition-all"
            >
              Ver planos de patrocínio
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Pacotes */}
      <section id="pacotes" className="section-py">
        <div className="container-px">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="section-tag">Preços</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mt-3 leading-tight">
              Dois caminhos:{" "}
              <span className="text-gradient-gold">
                você já gravou ou vai gravar
              </span>
            </h2>
            <p className="text-white/55 mt-4 leading-relaxed">
              O preço é fechado antes de começar. Nada de orçamento por hora que
              cresce no meio do caminho.
            </p>
          </div>

          {/* Porta B primeiro — é a venda maior e a que resolve quem não tem nada */}
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-3 mb-5">
              <span className="text-white/35 text-[11px] font-bold uppercase tracking-widest">
                Não tenho nada gravado
              </span>
              <div className="h-px flex-1 bg-[#222]" />
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {pacotesEstudio.map((p) => (
                <div
                  key={p.nome}
                  className={`card-hover rounded-2xl p-8 flex flex-col ${
                    p.destaque
                      ? "border border-gold-500/40 bg-gradient-to-br from-gold-500/[0.08] to-transparent"
                      : "border border-[#2a2a2a] bg-[#0d0d0d]"
                  }`}
                >
                  {p.destaque && (
                    <span className="self-start bg-gold-500 text-black text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md mb-4">
                      Mais pedido
                    </span>
                  )}
                  <div className="text-white font-black text-2xl">{p.nome}</div>
                  <div className="flex items-baseline gap-2 mt-3">
                    <span className="text-gradient-gold font-black text-4xl">
                      {p.preco}
                    </span>
                    <span className="text-white/35 text-sm">à vista</span>
                  </div>
                  <ul className="mt-6 flex flex-col gap-3 flex-1">
                    {p.itens.map((i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gold-500 flex-shrink-0" />
                        <span className="text-white/60 text-sm leading-relaxed">
                          {i}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href={whatsapp(
                      `Quero contratar o pacote ${p.nome} (${p.preco}) de cortes`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`mt-7 px-6 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 ${
                      p.destaque
                        ? "btn-primary"
                        : "border border-white/15 text-white/80 hover:border-gold-500/50 hover:text-white transition-colors"
                    }`}
                  >
                    <WhatsAppIcon className="w-4 h-4" />
                    Quero o {p.nome}
                  </a>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 mt-14 mb-5">
              <span className="text-white/35 text-[11px] font-bold uppercase tracking-widest">
                Já tenho o material gravado
              </span>
              <div className="h-px flex-1 bg-[#222]" />
            </div>

            <div className="grid sm:grid-cols-3 gap-5">
              {pacotesEdicao.map((p) => (
                <div
                  key={p.nome}
                  className={`card-hover rounded-2xl p-6 flex flex-col ${
                    p.destaque
                      ? "border border-gold-500/30 bg-[#0f0d08]"
                      : "border border-[#2a2a2a] bg-[#0d0d0d]"
                  }`}
                >
                  <div className="text-white font-bold">{p.nome}</div>
                  <div className="text-white/45 text-sm mt-0.5">{p.cortes}</div>
                  <div className="text-gradient-gold font-black text-3xl mt-4">
                    {p.preco}
                  </div>
                  <div className="text-white/30 text-xs mt-1">{p.unitario}</div>
                  <p className="text-white/45 text-sm leading-relaxed mt-4 flex-1">
                    {p.para}
                  </p>
                  <a
                    href={whatsapp(
                      `Já tenho material gravado e quero o pacote ${p.nome} (${p.cortes} — ${p.preco})`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 text-gold-500 font-bold text-sm inline-flex items-center gap-2 hover:gap-3 transition-all"
                  >
                    Pedir este
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              ))}
            </div>

            <p className="text-white/30 text-xs mt-6 leading-relaxed max-w-3xl">
              Valores para material com áudio e imagem aproveitáveis — as
              condições estão logo abaixo. Gravações longas (acima de 2 horas de
              bruto) podem ter acréscimo por tempo de triagem, sempre combinado
              antes.
            </p>
          </div>
        </div>
      </section>

      {/* Adicionais */}
      <section className="section-py bg-[#111] border-y border-[#1e1e1e]">
        <div className="container-px max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <span className="section-tag">Adicionais</span>
            <h2 className="text-3xl sm:text-4xl font-black mt-3 leading-tight">
              Tudo o que pode entrar,{" "}
              <span className="text-gradient-gold">com preço na mesa</span>
            </h2>
            <p className="text-white/55 mt-4 leading-relaxed">
              Ninguém gosta de descobrir custo depois. Se você pedir algo desta
              lista no meio do job, é este o valor.
            </p>
          </div>

          <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl overflow-hidden">
            {adicionais.map((a) => (
              <div
                key={a.item}
                className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4 border-b border-[#1e1e1e] last:border-0"
              >
                <span className="text-white/65 text-sm leading-relaxed">
                  {a.item}
                </span>
                <span className="text-gold-500 font-bold text-sm whitespace-nowrap">
                  {a.preco}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* O que você recebe */}
      <section className="section-py">
        <div className="container-px max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="section-tag">A entrega</span>
            <h2 className="text-3xl sm:text-4xl font-black mt-3 leading-tight">
              Como cada corte{" "}
              <span className="text-gradient-gold">sai daqui</span>
            </h2>
            <p className="text-white/55 mt-4 leading-relaxed">
              Não é o vídeo longo picado em pedaços. Cada peça é montada para
              funcionar sozinha, para quem nunca ouviu falar de você.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {especificacao.map((e) => (
              <div
                key={e.t}
                className="card-hover bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl p-6"
              >
                <div className="text-white font-bold">{e.t}</div>
                <div className="text-white/45 text-sm leading-relaxed mt-2">
                  {e.d}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section className="section-py bg-[#111] border-y border-[#1e1e1e]">
        <div className="container-px max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="section-tag">Como funciona</span>
            <h2 className="text-3xl sm:text-4xl font-black mt-3 leading-tight">
              Do primeiro contato{" "}
              <span className="text-gradient-gold">ao link de download</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {passos.map((p) => (
              <div
                key={p.n}
                className="card-hover bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl p-6 flex flex-col gap-3"
              >
                <div className="w-9 h-9 rounded-full bg-gold-500 text-black font-black flex items-center justify-center">
                  {p.n}
                </div>
                <div className="text-white font-bold leading-snug">{p.t}</div>
                <div className="text-white/45 text-sm leading-relaxed">
                  {p.d}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Requisitos + Regras */}
      <section className="section-py">
        <div className="container-px max-w-5xl mx-auto grid lg:grid-cols-[0.9fr_1.1fr] gap-6">
          <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl p-8">
            <span className="section-tag">Se você já tem o material</span>
            <h3 className="text-2xl font-black mt-3 leading-tight">
              O que o arquivo precisa ter
            </h3>
            <ul className="mt-6 flex flex-col gap-3">
              {requisitos.map((r) => (
                <li key={r} className="flex items-start gap-3">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gold-500 flex-shrink-0" />
                  <span className="text-white/55 text-sm leading-relaxed">
                    {r}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-white/40 text-sm leading-relaxed mt-6">
              Se o material não estiver nessa condição, a gente diz na hora — e
              propõe o tratamento de R$ 150 ou a regravação no estúdio. É mais
              barato descobrir isso antes de pagar do que depois de receber seis
              vídeos que você não vai querer postar.
            </p>
            <p className="text-white/30 text-xs leading-relaxed mt-4">
              Na dúvida, mande dois minutos do vídeo pelo WhatsApp. A avaliação
              não custa nada.
            </p>
          </div>

          <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl p-8">
            <span className="section-tag">As regras, escritas antes</span>
            <h3 className="text-2xl font-black mt-3 leading-tight">
              Prazo, revisão e pagamento
            </h3>
            <div className="mt-6 flex flex-col divide-y divide-[#1e1e1e]">
              {regras.map((r) => (
                <div key={r.t} className="py-3.5 first:pt-0 last:pb-0">
                  <div className="text-white font-semibold text-sm">{r.t}</div>
                  <div className="text-white/45 text-sm leading-relaxed mt-1">
                    {r.d}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-py bg-[#111] border-y border-[#1e1e1e]">
        <div className="container-px max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <span className="section-tag">Perguntas honestas</span>
            <h2 className="text-3xl sm:text-4xl font-black mt-3 leading-tight">
              O que a gente mais{" "}
              <span className="text-gradient-gold">escuta</span>
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
          <span className="section-tag">Sem compromisso</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight">
            Manda o que você tem —{" "}
            <span className="text-gradient-gold">ou vem gravar</span>
          </h2>
          <p className="text-white/60 leading-relaxed max-w-xl">
            Em dez minutos de conversa dá para saber qual pacote resolve o seu
            caso, se o seu material serve e quando fica pronto. Se não fizer
            sentido, a gente fala isso também.
          </p>
          <a
            href={whatsapp(
              "Vi a página de Cortes do Fora da Caixa e quero conversar sobre um pacote"
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary px-8 py-4 rounded-xl text-base flex items-center gap-3"
          >
            <WhatsAppIcon className="w-5 h-5" />
            Falar no WhatsApp
          </a>
          <p className="text-white/30 text-xs">
            Estúdio em Mogi Guaçu · SP. Atendemos a região.
          </p>
        </div>
      </section>

      <Footer />
      <WhatsAppButton />
    </main>
  );
}

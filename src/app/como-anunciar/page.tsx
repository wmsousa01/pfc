import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import { channelStats, whatsapp } from "@/lib/config";
import { WhatsAppIcon, ArrowRight } from "@/components/icons";

export const metadata: Metadata = {
  title: "Como anunciar em Mogi Guaçu | Fora da Caixa",
  description:
    "Guia para quem já anuncia em rádio, TV e jornal e quer entender como funciona anunciar em podcast: o que muda, o que continua igual e como medir o resultado.",
};

export const revalidate = 3600;

/**
 * Página-ponte para o decisor que vem de rádio/TV/jornal.
 *
 * Regra editorial (docs/estrategia-social-patrocinadores.md §5): NÃO atacar
 * rádio, TV ou carro de som. O comerciante já investiu neles — desqualificar o
 * meio faz ele se sentir bobo pela escolha passada, e ninguém compra de quem o
 * fez se sentir bobo. A página traduz o vocabulário dele e depois soma o que
 * ele nunca teve: a régua. Por isso a tabela comparativa lista as forças reais
 * de cada meio, e não só as nossas.
 */

/** Glossário-ponte: o termo que ele já usa → o equivalente aqui. */
const glossario = [
  {
    conhecido: "Spot de 30 segundos",
    aqui: "Menção do apresentador dentro do episódio",
    nota: "Mesma função: seu nome dito por uma voz em que a cidade confia.",
  },
  {
    conhecido: "Inserção / veiculação",
    aqui: "Aparição no episódio + nos cortes da semana",
    nota: "Uma gravação vira dezenas de peças distribuídas.",
  },
  {
    conhecido: "Audiência / tiragem",
    aqui: `${channelStats.views12m} de visualizações em 12 meses`,
    nota: "Quase tudo de Mogi Guaçu e região.",
  },
  {
    conhecido: "Panfleto / encarte",
    aqui: "QR code na tela",
    nota: "A diferença é que aqui você sabe quantas pessoas pegaram.",
  },
  {
    conhecido: "Patrocinar o time da cidade",
    aqui: "Patrocinar um quadro",
    nota: "O mesmo orgulho de estar junto do que a cidade gosta — com relatório.",
  },
  {
    conhecido: "Carro de som",
    aqui: "Shorts diários",
    nota: "Repetição na cidade, todo dia, sem incomodar ninguém.",
  },
  {
    conhecido: "Outdoor",
    aqui: "Página fixa da sua marca no site",
    nota: "No ar 24h, com link e endereço, sem prazo de locação.",
  },
];

/**
 * Comparativo honesto. Cada meio aparece com a força que ele realmente tem —
 * é isso que dá credibilidade à coluna do PFC. Uma tabela em que só nós somos
 * bons não convence ninguém que já assinou contrato com rádio.
 */
const comparativo = [
  {
    criterio: "O que faz muito bem",
    radio: "Presença ampla e simultânea na cidade inteira",
    tv: "Credibilidade e impacto visual de massa",
    pfc: "Conversa longa: dá pra explicar seu negócio de verdade",
  },
  {
    criterio: "Quanto tempo o anúncio existe",
    radio: "30 segundos, e acabou",
    tv: "30 segundos, e acabou",
    pfc: "Fica no YouTube e continua sendo visto meses depois",
    destaque: true,
  },
  {
    criterio: "Você sabe quantas pessoas viram?",
    radio: "Estimativa de cobertura",
    tv: "Estimativa de cobertura",
    pfc: "Número exato, por peça",
    destaque: true,
  },
  {
    criterio: "Dá pra provar que gerou procura?",
    radio: "Só perguntando ao cliente na loja",
    tv: "Só perguntando ao cliente na loja",
    pfc: "Sim — QR code rastreado e relatório de acessos",
    destaque: true,
  },
  {
    criterio: "Quantas peças por mês",
    radio: "Conforme o pacote de inserções",
    tv: "Conforme o pacote de inserções",
    pfc: `${channelStats.weeklyContent} conteúdos por semana saem do estúdio`,
  },
  {
    criterio: "Seu concorrente pode anunciar junto?",
    radio: "Pode",
    tv: "Pode",
    pfc: "No plano Master, não — exclusividade por segmento",
    destaque: true,
  },
  {
    criterio: "Ponto fraco honesto",
    radio: "Você não sabe quem ouviu",
    tv: "Custo alto para comércio de bairro",
    pfc: "Alcance instantâneo menor que o do rádio",
  },
];

/** As três perguntas do vídeo 3 da trilha — o conteúdo que reprograma o critério de compra. */
const perguntas = [
  {
    n: "1",
    pergunta: "Quantas pessoas vão ver o meu anúncio?",
    porque:
      "Se a resposta for uma faixa vaga (“alcançamos toda a região”), isso é cobertura de sinal, não audiência. São coisas diferentes.",
  },
  {
    n: "2",
    pergunta: "Como você me prova isso depois?",
    porque:
      "Essa é a pergunta que separa quem vende espaço de quem entrega resultado. Peça para ver o relatório antes de fechar.",
  },
  {
    n: "3",
    pergunta: "Quanto tempo o meu anúncio fica no ar?",
    porque:
      "Tem anúncio que dura 30 segundos e tem anúncio que continua trabalhando daqui a um ano. O preço parecido esconde essa diferença.",
  },
];

const objecoes = [
  {
    q: "Eu já anuncio no rádio. Preciso trocar?",
    a: "Não. Rádio dá presença na cidade e isso ninguém discute. A proposta aqui não é substituir — é ter pelo menos um canal em que você consegue medir. A maioria dos nossos parceiros mantém as duas coisas.",
  },
  {
    q: "Meu cliente não está na internet.",
    a: `Esse é justamente o ponto: são ${channelStats.views12m} de visualizações em 12 meses, quase tudo de Mogi Guaçu e região. Não é audiência de internet genérica — é a sua vizinhança, no celular dela. E o QR mede exatamente quantas pessoas daqui foram atrás da sua marca.`,
  },
  {
    q: "Podcast não é coisa de jovem?",
    a: "É o que parece de fora. Na prática, quem assiste episódio de uma hora sobre a cidade é quem mora aqui, tem contas para pagar e conhece o comércio local. O formato longo atrai justamente o público mais velho e mais paciente.",
  },
  {
    q: "É caro?",
    a: "Depende do que você compara. Antes de falar de plano mensal, existe um piloto de 30 dias sem contrato: menção no episódio, story, QR na tela e o relatório no fim. A ideia é você ver o número antes de decidir qualquer recorrência.",
  },
  {
    q: "Preciso saber falar em vídeo?",
    a: "Não. Na maioria dos formatos quem fala é o apresentador. Se você quiser aparecer, a gente conduz a conversa — e existe o PFC Visita, em que a câmera vai até o seu estabelecimento e você só mostra o que já faz todo dia.",
  },
];

export default function ComoAnunciarPage() {
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
            <span className="section-tag">Guia · Como anunciar</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight">
            Rádio funciona. TV funciona.{" "}
            <span className="text-gradient-gold">O que faltava era a régua.</span>
          </h1>
          <p className="text-lg text-white/65 leading-relaxed max-w-xl">
            Esta página é para quem já investe em mídia em Mogi Guaçu e ouviu
            falar em podcast, views e QR code sem entender direito o que muda.
            Sem jargão e sem enrolação: o que continua igual, o que é diferente
            e como conferir o resultado.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <a
              href="#comparativo"
              className="btn-primary px-8 py-4 rounded-xl text-base flex items-center gap-3"
            >
              Ver o comparativo
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="#autoridades"
              className="px-8 py-4 rounded-xl text-base font-bold border border-white/15 text-white/80 hover:border-gold-500/50 hover:text-white transition-colors"
            >
              Sou do poder público
            </a>
          </div>
        </div>
      </section>

      {/* Validação — desarma antes de explicar */}
      <section className="section-py bg-[#111] border-y border-[#1e1e1e]">
        <div className="container-px max-w-4xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="section-tag">Primeiro, o mais importante</span>
            <h2 className="text-3xl sm:text-4xl font-black mt-3 leading-tight">
              Se você já anunciou e não soube o resultado,{" "}
              <span className="text-gradient-gold">o problema não foi você</span>
            </h2>
            <p className="text-white/55 mt-4 leading-relaxed">
              Rádio, jornal, carro de som e patrocínio do time da cidade
              funcionam há décadas porque colocam seu nome na boca das pessoas.
              O que nenhum deles consegue fazer — por natureza do meio, não por
              má vontade de ninguém — é te dizer quantas pessoas de fato viram e
              quantas foram atrás.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-5">
            {[
              {
                t: "Exposição",
                d: "Seu nome apareceu. Isso todo meio entrega, e o rádio entrega muito bem.",
              },
              {
                t: "Exposição medida",
                d: "Seu nome apareceu e existe um número dizendo para quantos. Isso é raro na mídia local.",
              },
              {
                t: "A diferença prática",
                d: "Sem número, no ano seguinte você decide de novo no achismo — e renova ou corta sem saber por quê.",
              },
            ].map((c) => (
              <div
                key={c.t}
                className="card-hover bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl p-6"
              >
                <div className="text-white font-bold">{c.t}</div>
                <div className="text-white/45 text-sm leading-relaxed mt-2">
                  {c.d}
                </div>
              </div>
            ))}
          </div>

          <blockquote className="mt-10 border-l-2 border-gold-500 pl-5 text-white/70 text-lg leading-relaxed italic">
            O problema nunca foi o meio. É que ninguém te entregou o número.
          </blockquote>
        </div>
      </section>

      {/* Glossário-ponte */}
      <section className="section-py">
        <div className="container-px max-w-4xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="section-tag">Tradução</span>
            <h2 className="text-3xl sm:text-4xl font-black mt-3 leading-tight">
              É a mesma coisa que você já conhece,{" "}
              <span className="text-gradient-gold">com outro nome</span>
            </h2>
            <p className="text-white/55 mt-4 leading-relaxed">
              Metade da confusão com mídia digital é vocabulário. Do lado
              esquerdo, o que você já compra há anos. Do lado direito, como isso
              se chama aqui dentro.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {glossario.map((g) => (
              <div
                key={g.conhecido}
                className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl p-5 sm:p-6 grid sm:grid-cols-[1fr_auto_1fr] gap-3 sm:gap-5 sm:items-center"
              >
                <div>
                  <div className="text-white/35 text-[11px] font-bold uppercase tracking-widest mb-1">
                    Você conhece como
                  </div>
                  <div className="text-white/80 font-semibold">
                    {g.conhecido}
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gold-500 flex-shrink-0 rotate-90 sm:rotate-0" />
                <div>
                  <div className="text-gold-500/70 text-[11px] font-bold uppercase tracking-widest mb-1">
                    Aqui se chama
                  </div>
                  <div className="text-white font-semibold">{g.aqui}</div>
                  <div className="text-white/40 text-sm leading-relaxed mt-1">
                    {g.nota}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparativo */}
      <section
        id="comparativo"
        className="section-py bg-[#111] border-y border-[#1e1e1e]"
      >
        <div className="container-px">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="section-tag">Comparativo</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mt-3 leading-tight">
              Lado a lado, <span className="text-gradient-gold">sem torcida</span>
            </h2>
            <p className="text-white/55 mt-4 leading-relaxed">
              Incluímos o ponto fraco de cada meio — inclusive o nosso. Se a
              tabela só nos elogiasse, ela não serviria para você decidir nada.
            </p>
          </div>

          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="text-left text-white/35 text-[11px] font-bold uppercase tracking-widest pb-4 pr-4 w-[22%]">
                    Critério
                  </th>
                  <th className="text-left text-white/60 font-bold pb-4 px-4 w-[26%]">
                    Rádio local
                  </th>
                  <th className="text-left text-white/60 font-bold pb-4 px-4 w-[26%]">
                    TV regional
                  </th>
                  <th className="text-left text-gold-500 font-bold pb-4 pl-4 w-[26%]">
                    Fora da Caixa
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparativo.map((row) => (
                  <tr
                    key={row.criterio}
                    className="border-t border-[#222] align-top"
                  >
                    <td className="py-4 pr-4 text-white/70 font-semibold">
                      {row.criterio}
                    </td>
                    <td className="py-4 px-4 text-white/45 leading-relaxed">
                      {row.radio}
                    </td>
                    <td className="py-4 px-4 text-white/45 leading-relaxed">
                      {row.tv}
                    </td>
                    <td
                      className={`py-4 pl-4 leading-relaxed ${
                        row.destaque
                          ? "text-white font-semibold bg-gold-500/[0.05]"
                          : "text-white/60"
                      }`}
                    >
                      {row.pfc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-white/30 text-xs mt-5 max-w-3xl leading-relaxed">
            As colunas de rádio e TV descrevem a natureza desses meios, não
            emissoras específicas. Números de alcance divulgados por qualquer
            veículo local — incluindo os nossos — devem sempre ser lidos junto da
            pergunta “como você me prova isso depois?”.
          </p>
        </div>
      </section>

      {/* As 3 perguntas */}
      <section className="section-py">
        <div className="container-px max-w-4xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="section-tag">Leve para qualquer reunião</span>
            <h2 className="text-3xl sm:text-4xl font-black mt-3 leading-tight">
              3 perguntas para fazer a{" "}
              <span className="text-gradient-gold">qualquer vendedor de anúncio</span>
            </h2>
            <p className="text-white/55 mt-4 leading-relaxed">
              Inclusive para nós. Se alguém travar em alguma delas, você já sabe
              o que está comprando de verdade.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-5">
            {perguntas.map((p) => (
              <div
                key={p.n}
                className="card-hover bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl p-6 flex flex-col gap-3"
              >
                <div className="w-9 h-9 rounded-full bg-gold-500 text-black font-black flex items-center justify-center">
                  {p.n}
                </div>
                <div className="text-white font-bold leading-snug">
                  {p.pergunta}
                </div>
                <div className="text-white/45 text-sm leading-relaxed">
                  {p.porque}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Permanência + QR */}
      <section className="section-py bg-[#111] border-y border-[#1e1e1e]">
        <div className="container-px max-w-5xl mx-auto grid lg:grid-cols-2 gap-6">
          <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl p-8">
            <span className="section-tag">Permanência</span>
            <h3 className="text-2xl sm:text-3xl font-black mt-3 leading-tight">
              Tem anúncio que acaba e anúncio que fica
            </h3>
            <p className="text-white/55 mt-4 leading-relaxed">
              Um spot de 30 segundos existe enquanto está tocando. Um episódio
              fica no YouTube, aparece na busca e continua sendo assistido meses
              depois — junto com os cortes que saem dele durante a semana.
            </p>
            <p className="text-white/55 mt-3 leading-relaxed">
              Na prática: você paga uma vez pela gravação e ela continua
              trabalhando enquanto o canal existir. É a diferença entre alugar
              um espaço e construir um.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {[
                { k: channelStats.views12m, v: "views em 12 meses" },
                { k: channelStats.weeklyContent, v: "conteúdos por semana" },
                { k: channelStats.watchHoursYear, v: "horas assistidas no ano" },
              ].map((s) => (
                <div
                  key={s.v}
                  className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3"
                >
                  <div className="text-gold-500 font-black text-lg">{s.k}</div>
                  <div className="text-white/40 text-xs">{s.v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl p-8">
            <span className="section-tag">A régua</span>
            <h3 className="text-2xl sm:text-3xl font-black mt-3 leading-tight">
              Que quadradinho é esse na tela?
            </h3>
            <p className="text-white/55 mt-4 leading-relaxed">
              É um QR code. Quem está assistindo aponta a câmera do celular e cai
              direto numa página só da sua marca dentro do nosso site. Cada
              acesso fica registrado.
            </p>
            <ol className="mt-6 flex flex-col gap-3">
              {[
                {
                  n: "1",
                  t: "Sua página é criada",
                  d: "Com sua logo, seu texto, seu endereço e seu WhatsApp.",
                },
                {
                  n: "2",
                  t: "O QR aparece no episódio",
                  d: "Quem se interessou escaneia na hora, sem anotar nada.",
                },
                {
                  n: "3",
                  t: "Você recebe o relatório",
                  d: "Quantas pessoas escanearam e em que período. Preto no branco.",
                },
              ].map((s) => (
                <li key={s.n} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gold-500/15 border border-gold-500/30 text-gold-500 font-black text-xs flex items-center justify-center">
                    {s.n}
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm">{s.t}</div>
                    <div className="text-white/40 text-sm leading-relaxed">
                      {s.d}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <p className="text-white/35 text-xs mt-6 leading-relaxed">
              É o mesmo princípio do panfleto — a diferença é que o panfleto no
              chão e o panfleto guardado na carteira parecem iguais para você. O
              QR não.
            </p>
          </div>
        </div>
      </section>

      {/* Poder público */}
      <section id="autoridades" className="section-py">
        <div className="container-px max-w-4xl mx-auto">
          <div className="rounded-2xl border border-gold-500/25 bg-gradient-to-br from-gold-500/[0.08] to-transparent p-8 lg:p-12">
            <span className="section-tag">Para o poder público</span>
            <h2 className="text-3xl sm:text-4xl font-black mt-3 leading-tight">
              Comunicação oficial precisa provar que{" "}
              <span className="text-gradient-gold">informou</span>, não só que
              apareceu
            </h2>
            <p className="text-white/60 mt-4 leading-relaxed max-w-2xl">
              Campanhas de utilidade pública — vacinação, calendário de
              tributos, matrícula escolar, prazos, obras, serviços novos —
              carregam uma exigência que a publicidade comercial não tem: além
              de alcançar o cidadão, é preciso demonstrar depois que a
              informação circulou.
            </p>

            <div className="grid sm:grid-cols-2 gap-4 mt-8">
              {[
                {
                  t: "Relatório por campanha",
                  d: "Visualizações das peças e acessos ao QR no período, com data de início e fim. Documento anexável ao processo.",
                },
                {
                  t: "Página que permanece no ar",
                  d: "A página da campanha continua acessível depois da veiculação — o cidadão que procurar daqui a três meses ainda encontra.",
                },
                {
                  t: "A explicação na voz do gestor",
                  d: "Episódio ou bloco com o secretário ou responsável explicando a medida com tempo, sem o corte de 30 segundos.",
                },
                {
                  t: "Público efetivamente local",
                  d: "A audiência é de Mogi Guaçu e região — não é alcance nacional diluído que não vira comparecimento.",
                },
              ].map((c) => (
                <div
                  key={c.t}
                  className="bg-[#0d0d0d] border border-[#222] rounded-xl p-5"
                >
                  <div className="text-white font-semibold">{c.t}</div>
                  <div className="text-white/45 text-sm leading-relaxed mt-2">
                    {c.d}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-white/45 text-sm leading-relaxed mt-6">
              Emitimos proposta formal com descrição de entregáveis, período de
              veiculação e relatório de execução ao final, para instrução de
              processo administrativo. A contratação segue os ritos e as normas
              do órgão — a assessoria jurídica de cada administração define o
              enquadramento aplicável.
            </p>

            <a
              href={whatsapp(
                "Sou do poder público e quero entender os formatos de campanha do Fora da Caixa"
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary px-7 py-3.5 rounded-xl font-bold inline-flex items-center gap-2 mt-8"
            >
              <WhatsAppIcon className="w-5 h-5" />
              Falar sobre campanha institucional
            </a>
          </div>
        </div>
      </section>

      {/* Objeções */}
      <section className="section-py bg-[#111] border-y border-[#1e1e1e]">
        <div className="container-px max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <span className="section-tag">Perguntas honestas</span>
            <h2 className="text-3xl sm:text-4xl font-black mt-3 leading-tight">
              O que a gente mais <span className="text-gradient-gold">escuta</span>
            </h2>
          </div>

          <div className="flex flex-col gap-4">
            {objecoes.map((o) => (
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
            Comece testando,{" "}
            <span className="text-gradient-gold">não assinando</span>
          </h2>
          <p className="text-white/60 leading-relaxed max-w-xl">
            Existe um piloto de 30 dias sem contrato: menção no episódio, story,
            QR na tela e o relatório de acessos no final. A conversa sobre
            recorrência acontece depois, olhando para o número — não para a
            promessa.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <a
              href={whatsapp(
                "Li a página Como Anunciar e quero entender o piloto de 30 dias"
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary px-8 py-4 rounded-xl text-base flex items-center gap-3"
            >
              <WhatsAppIcon className="w-5 h-5" />
              Quero entender o piloto
            </a>
            <a
              href="/parcerias"
              className="px-8 py-4 rounded-xl text-base font-bold border border-white/15 text-white/80 hover:border-gold-500/50 hover:text-white transition-colors"
            >
              Ver planos e formatos
            </a>
          </div>
        </div>
      </section>

      <Footer />
      <WhatsAppButton />
    </main>
  );
}

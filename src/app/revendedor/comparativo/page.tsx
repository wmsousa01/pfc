import Link from "next/link";
import { requireResellerOrAdmin } from "@/lib/auth";
import { channelStats, whatsapp } from "@/lib/config";
import {
  atualizadoEm,
  criterios,
  mesesAtivo,
  nf,
  PROCEDENCIA_LABEL,
  rankingYouTube,
  referenciasRegionais,
  veiculosOrdenados,
  viewsPorMes,
  viewsPorVideo,
  type Celula,
  type CriterioId,
  type Tom,
  type Veiculo,
} from "@/lib/benchmark";
import { MicIcon, WhatsAppIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

/** Critérios do resumo de topo — onde o PFC é o único "sim". */
const RESUMO: CriterioId[] = [
  "relatorio",
  "rastreio",
  "permanencia",
  "exclusividade",
];

/**
 * Cor por tom. Ausência é neutra de propósito: nunca vermelho na coluna do
 * concorrente. Toda célula carrega a palavra ("Sim" / "Não" / "Não divulgado"),
 * então a cor é reforço e nunca o único portador da informação — o que mantém
 * a leitura correta para quem não distingue cores.
 */
const TOM_TEXTO: Record<Tom, string> = {
  forte: "text-emerald-400",
  neutro: "text-white/70",
  ausente: "text-white/30",
};

function Selo({ celula }: { celula: Celula }) {
  const forte =
    celula.procedencia === "medido" ||
    celula.procedencia === "publico-conferivel";
  return (
    <span
      className={`inline-block text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${
        forte
          ? "bg-gold-500/15 text-gold-500 border border-gold-500/30"
          : "text-white/30"
      }`}
    >
      {PROCEDENCIA_LABEL[celula.procedencia]}
    </span>
  );
}

/**
 * Barras de visualizações por mês.
 *
 * Uma série só, então não há legenda: o rótulo direto em cada barra carrega a
 * identidade, e a cor é apenas ênfase no nosso canal. Barras minúsculas ganham
 * 3px de largura mínima para não sumirem — a proporção real continua legível
 * porque o número vem escrito ao lado, nunca só desenhado.
 */
function BarrasViewsMes() {
  const max = Math.max(...rankingYouTube.map((v) => viewsPorMes(v.youtube)));

  return (
    <div className="flex flex-col gap-2.5">
      {rankingYouTube.map((v) => {
        const vm = viewsPorMes(v.youtube);
        const pct = (vm / max) * 100;
        return (
          <div key={v.id} className="grid sm:grid-cols-[190px_1fr] gap-1 sm:gap-4 sm:items-center">
            <div className="min-w-0">
              <div
                className={`text-sm font-semibold truncate ${
                  v.destaque ? "text-gold-500" : "text-white/70"
                }`}
              >
                {v.nome}
              </div>
              <div className="text-white/25 text-[11px] truncate">
                {v.cidade} · {v.tipo}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="h-5 rounded-r-[4px] shrink-0"
                style={{
                  width: `max(3px, ${pct}%)`,
                  background: v.destaque
                    ? "#FFD700"
                    : "rgba(255,255,255,0.22)",
                }}
              />
              <span
                className={`text-sm font-semibold tabular-nums whitespace-nowrap ${
                  v.destaque ? "text-gold-500" : "text-white/50"
                }`}
              >
                {nf.format(vm)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CardVeiculo({ v }: { v: Veiculo }) {
  return (
    <article
      className={`rounded-2xl border p-5 sm:p-6 ${
        v.destaque
          ? "border-gold-500/30 bg-gradient-to-br from-gold-500/[0.07] to-transparent"
          : "border-[#222] bg-[#111]"
      }`}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3
            className={`font-black text-xl ${
              v.destaque ? "text-gold-500" : "text-white"
            }`}
          >
            {v.nome}
          </h3>
          <div className="text-white/35 text-xs mt-0.5">
            {v.tipo} · {v.cidade}
          </div>
        </div>
        {v.youtube && (
          <div className="text-right">
            <div className="text-white/70 font-bold text-sm">
              {v.youtube.inscritosLabel}
            </div>
            <div className="text-white/25 text-[11px]">inscritos</div>
          </div>
        )}
      </div>

      <p className="text-white/60 text-sm leading-relaxed mt-3">
        <span className="text-white/35 text-[11px] uppercase tracking-wider font-bold block mb-1">
          O que faz bem
        </span>
        {v.forca}
      </p>

      {v.youtube && (
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[
            { v: nf.format(v.youtube.viewsTotais), l: "views totais" },
            { v: nf.format(viewsPorMes(v.youtube)), l: "views por mês" },
            { v: nf.format(viewsPorVideo(v.youtube)), l: "views por vídeo" },
          ].map((s) => (
            <div
              key={s.l}
              className="bg-black/30 border border-[#222] rounded-lg px-3 py-2"
            >
              <div
                className={`font-bold text-sm tabular-nums ${
                  v.destaque ? "text-gold-500" : "text-white/70"
                }`}
              >
                {s.v}
              </div>
              <div className="text-white/30 text-[10px]">{s.l}</div>
            </div>
          ))}
        </div>
      )}

      <dl className="mt-5 flex flex-col gap-3">
        {criterios.map((crit) => {
          const c = v.indicadores[crit.id];
          return (
            <div
              key={crit.id}
              className="grid sm:grid-cols-[220px_1fr] gap-1 sm:gap-4 border-t border-[#1c1c1c] pt-3"
            >
              <dt className="text-white/40 text-xs sm:text-sm leading-snug">
                {crit.label}
              </dt>
              <dd>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-semibold text-sm ${TOM_TEXTO[c.tom]}`}>
                    {c.valor}
                  </span>
                  <Selo celula={c} />
                </div>
                {c.nota && (
                  <div className="text-white/35 text-xs leading-relaxed mt-1">
                    {c.nota}
                  </div>
                )}
              </dd>
            </div>
          );
        })}
      </dl>

      <div className="text-white/25 text-xs mt-5 pt-4 border-t border-[#1c1c1c]">
        Fonte:{" "}
        {v.fonteUrl ? (
          <a
            href={v.fonteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white/50"
          >
            {v.fonte}
          </a>
        ) : (
          v.fonte
        )}
        {v.youtube && (
          <>
            {" "}
            · canal criado em {v.youtube.desde.split("-").reverse().join("/")} ·{" "}
            {mesesAtivo(v.youtube)} meses no ar
          </>
        )}
      </div>
    </article>
  );
}

export default async function ComparativoPage() {
  const role = await requireResellerOrAdmin();
  const apresentador =
    role.kind === "reseller" ? role.reseller.name : "Fora da Caixa";
  const voltarHref = role.kind === "admin" ? "/admin" : "/revendedor";

  const pfc = rankingYouTube.find((v) => v.destaque)!;
  const novaOnda = rankingYouTube.find((v) => v.id === "nova-onda")!;

  const tiles = [
    { v: nf.format(pfc.youtube.viewsTotais), l: "visualizações no canal" },
    { v: nf.format(viewsPorMes(pfc.youtube)), l: "visualizações por mês" },
    { v: nf.format(pfc.youtube.videos), l: "vídeos publicados" },
    { v: `${mesesAtivo(pfc.youtube)} meses`, l: "de canal no ar" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-24">
      <header className="border-b border-[#1a1a1a] bg-[#0d0d0d] print:hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center justify-center w-7 h-7 bg-gold-500 rounded-lg shrink-0">
              <MicIcon className="w-4 h-4 text-black" />
            </div>
            <span className="text-white/50 text-sm truncate">
              Material de apoio ·{" "}
              <span className="text-white/80">{apresentador}</span>
            </span>
          </div>
          <Link
            href={voltarHref}
            className="text-white/40 hover:text-white text-sm border border-[#2a2a2a] rounded-lg px-3 py-1.5 hover:border-[#3a3a3a] transition-colors whitespace-nowrap"
          >
            Voltar
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Abertura */}
        <div className="pt-10 sm:pt-14">
          <span className="section-tag">Mídia local · Mogi Guaçu e região</span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mt-3 leading-[1.1]">
            Onde anunciar na cidade,{" "}
            <span className="text-gradient-gold">com os números na mesa</span>
          </h1>
          <p className="text-white/55 mt-4 leading-relaxed max-w-2xl">
            Todo número de YouTube desta página é público: você abre o canal, vai
            em “Sobre” e confere na hora — o nosso e o dos outros. Onde o veículo
            não publica o dado, está escrito que não publica.
          </p>
          <p className="text-white/30 text-xs mt-3">
            Coletado em {atualizadoEm} nas páginas públicas dos canais.
          </p>
        </div>

        {/* Nossos números */}
        <section className="mt-10">
          <h2 className="text-white font-bold text-lg">
            Os números do Fora da Caixa
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            {tiles.map((t) => (
              <div
                key={t.l}
                className="bg-[#111] border border-[#222] rounded-xl p-5"
              >
                <div className="text-2xl sm:text-3xl font-black text-gold-500 break-words tabular-nums">
                  {t.v}
                </div>
                <div className="text-white/50 text-sm mt-1 leading-snug">
                  {t.l}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Gráfico */}
        <section className="mt-14">
          <h2 className="text-white font-bold text-lg">
            Visualizações por mês no YouTube
          </h2>
          <p className="text-white/40 text-sm mt-1 max-w-2xl leading-relaxed">
            Total do canal dividido pelos meses desde que ele existe. Sem isso um
            canal de 2014 pareceria maior só por ser mais velho.
          </p>

          <div className="bg-[#111] border border-[#222] rounded-2xl p-5 sm:p-6 mt-5">
            <BarrasViewsMes />
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <p className="text-white/50 text-sm leading-relaxed">
              <strong className="text-white/80">
                Isto mede só o YouTube.
              </strong>{" "}
              A audiência de rádio da Nova Onda está no FM, não entra neste
              gráfico e é real — são 30 anos alcançando quem não usa rede social.
              O que o gráfico mostra é uma coisa só: quem entrega mais vídeo por
              mês em Mogi Guaçu.
            </p>
          </div>
        </section>

        {/* O argumento dos inscritos */}
        <section className="mt-14">
          <div className="rounded-2xl border border-gold-500/25 bg-gradient-to-br from-gold-500/[0.08] to-transparent p-6 sm:p-8">
            <span className="section-tag">Por que inscrito não é a medida</span>
            <h2 className="text-2xl sm:text-3xl font-black text-white mt-3 leading-tight">
              Tem canal aqui com mais inscritos que o nosso{" "}
              <span className="text-gradient-gold">
                e um quarto das visualizações
              </span>
            </h2>
            <div className="grid sm:grid-cols-2 gap-4 mt-6">
              {[
                {
                  nome: novaOnda.nome,
                  sub: novaOnda.youtube.inscritosLabel,
                  views: nf.format(novaOnda.youtube.viewsTotais),
                  destaque: false,
                },
                {
                  nome: pfc.nome,
                  sub: pfc.youtube.inscritosLabel,
                  views: nf.format(pfc.youtube.viewsTotais),
                  destaque: true,
                },
              ].map((c) => (
                <div
                  key={c.nome}
                  className={`rounded-xl border p-5 ${
                    c.destaque
                      ? "border-gold-500/30 bg-black/30"
                      : "border-[#222] bg-black/30"
                  }`}
                >
                  <div
                    className={`font-bold ${
                      c.destaque ? "text-gold-500" : "text-white/80"
                    }`}
                  >
                    {c.nome}
                  </div>
                  <div className="flex items-end gap-6 mt-3">
                    <div>
                      <div className="text-white/70 font-black text-xl tabular-nums">
                        {c.sub}
                      </div>
                      <div className="text-white/30 text-xs">inscritos</div>
                    </div>
                    <div>
                      <div
                        className={`font-black text-xl tabular-nums ${
                          c.destaque ? "text-gold-500" : "text-white/70"
                        }`}
                      >
                        {c.views}
                      </div>
                      <div className="text-white/30 text-xs">visualizações</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-white/55 text-sm leading-relaxed mt-5">
              Inscrito mede quem assinou o canal um dia. Visualização mede quem
              assistiu. Quando você paga anúncio, está comprando a segunda coisa
              — e é por isso que este material não lidera por inscritos, nem os
              nossos.
            </p>
          </div>
        </section>

        {/* Resumo — os 4 diferenciais */}
        <section className="mt-14">
          <h2 className="text-white font-bold text-lg">O que muda na prática</h2>
          <p className="text-white/40 text-sm mt-1">
            Quatro perguntas que separam os veículos. O resto é detalhe.
          </p>

          <div className="overflow-x-auto mt-5 -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="text-left text-white/30 text-[11px] font-bold uppercase tracking-widest pb-3 pr-4 sticky left-0 bg-[#0a0a0a]">
                    Veículo
                  </th>
                  {RESUMO.map((id) => (
                    <th
                      key={id}
                      className="text-left text-white/55 font-semibold pb-3 px-3 text-xs leading-snug"
                    >
                      {criterios.find((c) => c.id === id)?.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {veiculosOrdenados.map((v) => (
                  <tr
                    key={v.id}
                    className={`border-t border-[#1c1c1c] ${
                      v.destaque ? "bg-gold-500/[0.05]" : ""
                    }`}
                  >
                    <td
                      className={`py-3 pr-4 font-semibold whitespace-nowrap sticky left-0 ${
                        v.destaque
                          ? "text-gold-500 bg-[#161200]"
                          : "text-white/80 bg-[#0a0a0a]"
                      }`}
                    >
                      {v.nome}
                      <div className="text-white/30 text-[11px] font-normal">
                        {v.tipo}
                      </div>
                    </td>
                    {RESUMO.map((id) => {
                      const c = v.indicadores[id];
                      return (
                        <td
                          key={id}
                          className={`py-3 px-3 font-semibold ${TOM_TEXTO[c.tom]}`}
                        >
                          {c.valor}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Detalhe por veículo */}
        <section className="mt-14">
          <h2 className="text-white font-bold text-lg">Veículo por veículo</h2>
          <p className="text-white/40 text-sm mt-1">
            Cada um começa pelo que faz bem — porque cada um faz alguma coisa bem.
          </p>
          <div className="flex flex-col gap-4 mt-5">
            {veiculosOrdenados.map((v) => (
              <CardVeiculo key={v.id} v={v} />
            ))}
          </div>
        </section>

        {/* Referências regionais */}
        <section className="mt-14">
          <h2 className="text-white font-bold text-lg">
            Fora de Mogi Guaçu, para dar régua
          </h2>
          <p className="text-white/40 text-sm mt-1 max-w-2xl leading-relaxed">
            Não disputam a mesma verba, mas mostram o que é possível no interior.
            O Itapira News tem mais audiência que todo mundo desta lista — vale
            saber que existe antes que o cliente pergunte.
          </p>
          <div className="flex flex-col gap-4 mt-5">
            {referenciasRegionais.map((v) => (
              <CardVeiculo key={v.id} v={v} />
            ))}
          </div>
        </section>

        {/* Método */}
        <section className="mt-14">
          <h2 className="text-white font-bold text-lg">
            Como ler estes números
          </h2>
          <div className="grid sm:grid-cols-2 gap-4 mt-5">
            {[
              {
                t: "Todo número de YouTube aqui é conferível",
                d: "Abra qualquer canal da lista, clique em “Sobre” e o total de visualizações está lá. Não pedimos que você acredite em nós — pedimos que você confira.",
              },
              {
                t: "Cobertura não é audiência",
                d: "“Alcança 3 milhões de pessoas” quase sempre quer dizer quantas pessoas moram onde o sinal chega, não quantas estavam ouvindo. Não é malícia de ninguém: é como o rádio sempre foi medido.",
              },
              {
                t: "Seguidor não é entrega",
                d: "Um perfil com 34 mil seguidores não entrega 34 mil visualizações por post. Por isso seguidores do Instagram e visualizações do YouTube aparecem aqui separados, e nunca somados.",
              },
              {
                t: "Onde nós perdemos",
                d: `Nossa média por vídeo é ${nf.format(viewsPorVideo(pfc.youtube))}, e tem canal da cidade com média bem maior publicando muito menos. Nós ganhamos no volume, não na peça isolada — e isso está na tabela.`,
              },
            ].map((c) => (
              <div
                key={c.t}
                className="bg-[#111] border border-[#222] rounded-xl p-5"
              >
                <div className="text-white font-semibold text-sm">{c.t}</div>
                <p className="text-white/45 text-sm leading-relaxed mt-2">
                  {c.d}
                </p>
              </div>
            ))}
          </div>
          <p className="text-white/25 text-xs leading-relaxed mt-4">
            Este material descreve veículos a partir de informação pública, sem
            juízo sobre a qualidade do trabalho de ninguém. Rádio, TV, portal e
            perfil local cumprem funções que este canal não cumpre.
          </p>
        </section>

        {/* CTA */}
        <section className="mt-14">
          <div className="rounded-2xl border border-gold-500/25 bg-gradient-to-br from-gold-500/[0.08] to-transparent p-6 sm:p-8">
            <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
              O teste de 30 dias{" "}
              <span className="text-gradient-gold">responde sozinho</span>
            </h2>
            <p className="text-white/60 mt-3 leading-relaxed max-w-2xl">
              Menção no episódio, story, QR na tela e o relatório de acessos no
              final. Sem contrato. No fim, a conversa é sobre o número que
              apareceu — não sobre esta tabela.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <a
                href={whatsapp(
                  `Quero entender o piloto de 30 dias do Fora da Caixa (indicação de ${apresentador})`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary px-6 py-3.5 rounded-xl font-bold inline-flex items-center justify-center gap-2"
              >
                <WhatsAppIcon className="w-5 h-5" />
                Falar sobre o piloto
              </a>
              <Link
                href="/como-anunciar"
                className="px-6 py-3.5 rounded-xl font-bold border border-white/15 text-white/80 hover:border-gold-500/50 hover:text-white transition-colors text-center"
              >
                Abrir o guia “Como anunciar”
              </Link>
            </div>
          </div>
        </section>

        {/* Orientação interna — fechada para não abrir na frente do cliente */}
        <details className="mt-10 print:hidden">
          <summary className="cursor-pointer list-none flex items-center gap-2 text-white/40 hover:text-white/70 text-sm border border-[#222] rounded-xl px-4 py-3 bg-[#0d0d0d]">
            <span className="text-gold-500/70">▸</span>
            Só para você — como usar esta página na reunião
            <span className="text-white/20 text-xs ml-auto hidden sm:inline">
              não abra com o cliente na tela
            </span>
          </summary>
          <div className="border border-t-0 border-[#222] rounded-b-xl px-4 pb-5 pt-2 bg-[#0d0d0d] flex flex-col gap-3 text-sm text-white/50 leading-relaxed">
            <p>
              <strong className="text-white/80">
                Não use isto para falar mal de ninguém.
              </strong>{" "}
              Mogi Guaçu é pequena, e o cliente provavelmente já anunciou em pelo
              menos um dos veículos da lista. Se ele sentir que foi bobo na
              escolha passada, ele não compra de você. Comece sempre pela linha
              “o que faz bem”.
            </p>
            <p>
              <strong className="text-white/80">A frase que abre:</strong> “Rádio
              funciona, Instagram funciona. O problema nunca foi o meio — é que
              ninguém te entregou o número.”
            </p>
            <p>
              <strong className="text-white/80">
                A jogada mais forte da página:
              </strong>{" "}
              o bloco dos inscritos. A Nova Onda tem mais inscritos que a gente e
              um quarto das visualizações. Use isso para derrubar a pergunta
              “quantos inscritos você tem?” antes que ela vire objeção — e
              repare que funciona porque é contra nós que o argumento parece
              pesar primeiro.
            </p>
            <p>
              <strong className="text-white/80">Se conferirem na hora:</strong>{" "}
              ótimo, deixe conferir. Todo número de YouTube aqui está na aba
              “Sobre” do canal. Se algum estiver diferente, é porque o canal
              cresceu desde {atualizadoEm} — avise para atualizarmos.
            </p>
            <p>
              <strong className="text-white/80">Onde fechar:</strong> não tente
              fechar plano nesta tela. Feche no piloto de 30 dias. A tabela abre
              a conversa; o relatório do piloto é que vende a recorrência.
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}

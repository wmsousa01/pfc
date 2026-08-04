import Link from "next/link";
import { requireResellerOrAdmin } from "@/lib/auth";
import { channelStats, whatsapp } from "@/lib/config";
import {
  atualizadoEm,
  criterios,
  PROCEDENCIA_LABEL,
  veiculosOrdenados,
  type Celula,
  type CriterioId,
  type Tom,
} from "@/lib/benchmark";
import { MicIcon, WhatsAppIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

/** Critérios que viram o resumo de topo — são onde o PFC é o único "sim". */
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
  const destaque = celula.procedencia === "medido";
  return (
    <span
      className={`inline-block text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${
        destaque
          ? "bg-gold-500/15 text-gold-500 border border-gold-500/30"
          : "text-white/30"
      }`}
    >
      {PROCEDENCIA_LABEL[celula.procedencia]}
    </span>
  );
}

export default async function ComparativoPage() {
  const role = await requireResellerOrAdmin();
  const apresentador =
    role.kind === "reseller" ? role.reseller.name : "Fora da Caixa";
  const voltarHref = role.kind === "admin" ? "/admin" : "/revendedor";

  const tiles = [
    { v: channelStats.views12m, l: "views em 12 meses" },
    { v: channelStats.weeklyContent, l: "peças por semana" },
    { v: channelStats.watchHoursYear, l: "horas assistidas no ano" },
    { v: channelStats.bestMonth, l: `melhor mês (${channelStats.bestMonthLabel})` },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-24">
      {/* Barra de contexto — some na impressão para não sujar o material */}
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
          <span className="section-tag">
            Mídia local · Mogi Guaçu e região
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mt-3 leading-[1.1]">
            Onde anunciar na cidade,{" "}
            <span className="text-gradient-gold">lado a lado</span>
          </h1>
          <p className="text-white/55 mt-4 leading-relaxed max-w-2xl">
            Um comparativo dos veículos que disputam a mesma verba de anúncio em
            Mogi Guaçu e região. Cada número traz de onde veio — e onde o
            veículo não publica o dado, está escrito que não publica.
          </p>
          <p className="text-white/30 text-xs mt-3">
            Fontes públicas conferidas em {atualizadoEm}.
          </p>
        </div>

        {/* Nossos números */}
        <section className="mt-10">
          <h2 className="text-white font-bold text-lg">
            Os números do Fora da Caixa
          </h2>
          <p className="text-white/40 text-sm mt-1">
            Saem do painel do YouTube e podem ser conferidos na tela, ao vivo.
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
            {tiles.map((t) => (
              <div
                key={t.l}
                className="bg-[#111] border border-[#222] rounded-xl p-5"
              >
                <div className="text-2xl sm:text-3xl font-black text-gold-500 break-words">
                  {t.v}
                </div>
                <div className="text-white/50 text-sm mt-1 leading-snug">
                  {t.l}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Resumo — os 4 diferenciais */}
        <section className="mt-14">
          <h2 className="text-white font-bold text-lg">
            O que muda na prática
          </h2>
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
              <article
                key={v.id}
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
                </div>

                <p className="text-white/60 text-sm leading-relaxed mt-3">
                  <span className="text-white/35 text-[11px] uppercase tracking-wider font-bold block mb-1">
                    O que faz bem
                  </span>
                  {v.forca}
                </p>

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
                            <span
                              className={`font-semibold text-sm ${TOM_TEXTO[c.tom]}`}
                            >
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
                </div>
              </article>
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
                t: "Medido não é a mesma coisa que declarado",
                d: "Número medido sai de um painel que dá para abrir na sua frente. Número declarado é o que o veículo publica sobre si mesmo. Os dois podem estar certos — mas só um deles você consegue conferir.",
              },
              {
                t: "Cobertura não é audiência",
                d: "“Alcança 3 milhões de pessoas” quase sempre quer dizer quantas pessoas moram onde o sinal chega, não quantas estavam ouvindo. Não é malícia de ninguém: é como o rádio sempre foi medido.",
              },
              {
                t: "Seguidor não é entrega",
                d: "Um perfil com 34 mil seguidores não entrega 34 mil visualizações por post — normalmente entrega uma fração. Por isso seguidores e views aparecem aqui como coisas separadas, e não somados.",
              },
              {
                t: "As lacunas são reais",
                d: "Onde está escrito “não divulgado”, é porque o veículo não publica o dado — não porque não procuramos. Preferimos a lacuna a um número inventado, inclusive quando a lacuna é nossa.",
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
            juízo sobre a qualidade do trabalho de ninguém. Rádio, portal e
            perfil local cumprem funções que este canal não cumpre.
          </p>
        </section>

        {/* CTA — fecha a conversa com o cliente */}
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

        {/* Orientação interna — fechada por padrão para não abrir na frente do cliente */}
        <details className="mt-10 group print:hidden">
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
              escolha passada, ele não compra de você. Comece sempre pela coluna
              “o que faz bem”.
            </p>
            <p>
              <strong className="text-white/80">A frase que abre:</strong> “Rádio
              funciona, Instagram funciona. O problema nunca foi o meio — é que
              ninguém te entregou o número.”
            </p>
            <p>
              <strong className="text-white/80">
                Se perguntarem quantos inscritos temos:
              </strong>{" "}
              responda o número real e volte para views ({channelStats.views12m}{" "}
              em 12 meses). Inscrito mede quem assinou o canal; view mede quem
              assistiu. Quem paga anúncio está comprando a segunda coisa.
            </p>
            <p>
              <strong className="text-white/80">
                Se perguntarem os views do concorrente:
              </strong>{" "}
              diga que eles não publicam — e que é justamente esse o ponto.
              Nunca chute um número por eles.
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

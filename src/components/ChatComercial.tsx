"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { enviarPlano } from "@/app/monte-seu-plano/actions";
import { quadros, quadroSponsorship, whatsapp } from "@/lib/config";
import {
  OBJETIVOS,
  SEGMENTOS,
  VERBAS,
  VISITA_AVULSO,
  orcar,
  plans,
  recomendar,
  type Briefing,
  type Objetivo,
  type Orcamento,
  type Selecao,
  type Verba,
} from "@/lib/monte-plano";
import { INCLUI, placementsDe, type PlacementId } from "@/lib/placements";
import { PlacementMockup } from "@/components/PlacementMockup";
import { WhatsAppIcon } from "@/components/icons";

/**
 * Chat comercial guiado (sem IA): substitui o botão de WhatsApp nas páginas
 * comerciais. Faz o Monte seu plano em forma de conversa, com o mesmo motor
 * (recomendar/orcar) e o mesmo envio (enviarPlano, origem "chat") — o chat e a
 * página nunca dão preços diferentes. Não inventa resposta: o que não está no
 * roteiro vai para o WhatsApp de uma pessoa.
 */

type Msg = { id: number; de: "bot" | "eu"; corpo: ReactNode };
type Opcao = { label: string; acao: () => void; destaque?: boolean };
type Entrada = { placeholder: string; tipo?: "text" | "tel"; enviar: (v: string) => void } | null;

const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;
const AVISO_KEY = "pfc-chat-aviso-fechado";

function Bolha({ m }: { m: Msg }) {
  return (
    <div className={`flex ${m.de === "eu" ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          m.de === "eu" ? "bg-gold-500 text-black rounded-br-sm" : "bg-[#1c1c1c] text-white/85 rounded-bl-sm"
        }`}
      >
        {m.corpo}
      </div>
    </div>
  );
}

function CartaoPlano({ orc }: { orc: Orcamento }) {
  return (
    <div className="flex flex-col gap-2 min-w-[220px]">
      {orc.linhas.map((l) => (
        <div key={l.key} className="flex justify-between gap-3">
          <span className="text-white font-semibold">{l.label}</span>
          <span className="whitespace-nowrap">{l.valor === null ? "a consultar" : brl(l.valor)}</span>
        </div>
      ))}
      <div className="border-t border-white/10 pt-2 flex justify-between items-baseline">
        <span className="text-white/60 text-xs">
          Total em {orc.meses} {orc.meses === 1 ? "mês" : "meses"}
        </span>
        <span className="text-gold-500 font-black text-lg">{brl(orc.total)}</span>
      </div>
      {orc.pagamento.map((p) => (
        <span key={p} className="text-white/40 text-[11px] leading-snug">
          {p}
        </span>
      ))}
    </div>
  );
}

export default function ChatComercial() {
  const [aberto, setAberto] = useState(false);
  const [aviso, setAviso] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [opcoes, setOpcoes] = useState<Opcao[]>([]);
  const [entrada, setEntrada] = useState<Entrada>(null);
  const [texto, setTexto] = useState("");
  const [digitando, setDigitando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);
  const seq = useRef(0);
  const b = useRef<Briefing>({ empresa: "", segmento: "", objetivos: [], verba: "500-1000", exclusividade: false, quadro: "" });
  const sel = useRef<Selecao | null>(null);
  const contato = useRef({ nome: "" });

  // Convite discreto depois de alguns segundos, uma vez por sessão.
  useEffect(() => {
    let fechado = false;
    try {
      fechado = sessionStorage.getItem(AVISO_KEY) === "1";
    } catch {}
    if (fechado) return;
    const t = setTimeout(() => setAviso(true), 6000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, opcoes, digitando]);

  const fecharAviso = () => {
    setAviso(false);
    try {
      sessionStorage.setItem(AVISO_KEY, "1");
    } catch {}
  };

  const eu = (corpo: ReactNode) => setMsgs((m) => [...m, { id: ++seq.current, de: "eu", corpo }]);

  /** Fala do bot com um "digitando…" curto, depois mostra as opções. */
  const bot = (falas: ReactNode[], prox: Opcao[] = [], inp: Entrada = null) => {
    setOpcoes([]);
    setEntrada(null);
    setDigitando(true);
    falas.forEach((corpo, i) => {
      setTimeout(() => {
        setMsgs((m) => [...m, { id: ++seq.current, de: "bot", corpo }]);
        if (i === falas.length - 1) {
          setDigitando(false);
          setOpcoes(prox);
          setEntrada(inp);
        }
      }, 450 + i * 550);
    });
  };

  const escolha = (label: string, acao: () => void): Opcao => ({
    label,
    acao: () => {
      eu(label);
      acao();
    },
  });

  // ------------------------------------------------------------ roteiro

  const inicio = () =>
    bot(
      ["Oi! 👋 Sou o assistente comercial do Papo Fora da Caixa.", "Quer colocar sua marca no programa? Te mostro o plano e o preço em 1 minuto."],
      [
        { ...escolha("Quero montar meu plano", perguntarEmpresa), destaque: true },
        escolha("Quanto custa?", precos),
        escolha("Como funciona o QR na tela?", comoFunciona),
        escolha("Falar com uma pessoa", pessoa),
      ],
    );

  const voltarOpcoes = (): Opcao[] => [
    { ...escolha("Montar meu plano", perguntarEmpresa), destaque: true },
    escolha("Falar com uma pessoa", pessoa),
  ];

  function precos() {
    bot(
      [
        <div key="p" className="flex flex-col gap-1.5">
          <span>Os planos do canal, por mês:</span>
          {plans.map((p) => (
            <span key={p.id}>
              • <b className="text-white">{p.name}</b>: {brl(p.monthlyPrice)} <span className="text-white/40">({p.tagline.toLowerCase()})</span>
            </span>
          ))}
          <span>
            • <b className="text-white">Sua marca apresenta um quadro</b>: {brl(quadroSponsorship.master.monthlyPrice)}, mínimo de{" "}
            {quadroSponsorship.minMonths} meses
          </span>
          <span>
            • <b className="text-white">PFC Visita</b> (episódio no seu espaço): {brl(VISITA_AVULSO)} avulso
          </span>
        </div>,
        "No plano anual tem 20% de desconto. Quer que eu monte a combinação certa para a sua marca?",
      ],
      voltarOpcoes(),
    );
  }

  function comoFunciona() {
    bot(
      [
        "Durante o episódio aparece um QR code na tela. Quem está assistindo aponta o celular e cai numa página só da sua marca, com WhatsApp e endereço.",
        <div key="m" className="w-56">
          <PlacementMockup id="qr" marca={{ nome: "Sua marca", cor: "#2563eb" }} />
        </div>,
        "Cada leitura fica registrada, então você sabe quantas pessoas foram atrás da sua marca. Isso vem em todos os planos.",
      ],
      voltarOpcoes(),
    );
  }

  function pessoa() {
    bot(
      [
        <div key="w" className="flex flex-col gap-2">
          <span>Claro! O comercial responde pelo WhatsApp:</span>
          <a
            href={whatsapp("Vim pelo site do Fora da Caixa e quero falar sobre anunciar")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] text-black font-bold px-3 py-2"
          >
            <WhatsAppIcon className="w-4 h-4" /> Abrir o WhatsApp
          </a>
        </div>,
        "Se quiser chegar lá já com um plano e um preço, eu monto agora.",
      ],
      [{ ...escolha("Montar meu plano", perguntarEmpresa), destaque: true }],
    );
  }

  function perguntarEmpresa() {
    bot(["Bora! Qual é o nome da sua empresa?"], [], {
      placeholder: "Nome da empresa",
      enviar: (v) => {
        b.current.empresa = v;
        perguntarSegmento();
      },
    });
  }

  function perguntarSegmento() {
    bot(
      [`Prazer, ${b.current.empresa}! Qual é o seu segmento?`],
      SEGMENTOS.map((s) =>
        escolha(s.label, () => {
          b.current.segmento = s.label;
          b.current.objetivos = [];
          perguntarObjetivos();
        }),
      ),
    );
  }

  function opcoesObjetivos(): Opcao[] {
    const marcados = b.current.objetivos;
    return [
      ...OBJETIVOS.map((o) => ({
        label: `${marcados.includes(o.id) ? "✓ " : ""}${o.label}`,
        destaque: marcados.includes(o.id),
        acao: () => {
          const atual = b.current.objetivos;
          b.current.objetivos = atual.includes(o.id as Objetivo) ? atual.filter((x) => x !== o.id) : [...atual, o.id as Objetivo];
          setOpcoes(opcoesObjetivos());
        },
      })),
      {
        label: "Pronto →",
        acao: () => {
          if (!b.current.objetivos.length) return;
          eu(b.current.objetivos.map((id) => OBJETIVOS.find((o) => o.id === id)?.label).join(", "));
          perguntarVerba();
        },
      },
    ];
  }

  function perguntarObjetivos() {
    bot(["O que você quer com o anúncio? Pode marcar mais de um e depois tocar em Pronto."], opcoesObjetivos());
  }

  function perguntarVerba() {
    bot(
      ["Quanto pensa em investir por mês?"],
      VERBAS.map((v) =>
        escolha(v.label, () => {
          b.current.verba = v.id as Verba;
          perguntarExclusividade();
        }),
      ),
    );
  }

  function perguntarExclusividade() {
    bot(
      ["Última: é importante que nenhum concorrente direto anuncie junto com você?"],
      [
        escolha("Sim, quero exclusividade", () => {
          b.current.exclusividade = true;
          sugerir();
        }),
        escolha("Não precisa", () => {
          b.current.exclusividade = false;
          sugerir();
        }),
      ],
    );
  }

  function sugerir() {
    const r = recomendar(b.current);
    sel.current = r.selecao;
    const orc = orcar(r.selecao);
    const motivo = Object.values(r.motivos)[0];
    bot(
      [
        `Pronto! Para a ${b.current.empresa}, eu sugiro:`,
        <CartaoPlano key="c" orc={orc} />,
        ...(motivo ? [`Por quê: ${motivo}`] : []),
      ],
      opcoesPlano(),
    );
  }

  function opcoesPlano(): Opcao[] {
    return [
      { ...escolha("Enviar para o comercial", pedirNome), destaque: true },
      escolha("Ver como fica na tela", verTelas),
      {
        label: "Ajustar os itens",
        acao: () => {
          eu("Ajustar os itens");
          const url = `/monte-seu-plano?b=${encodeURIComponent(JSON.stringify(b.current))}`;
          bot(
            [
              <div key="a" className="flex flex-col gap-2">
                <span>Na página do Monte seu plano você liga e desliga cada item e vê o preço mudar. Já deixei tudo preenchido:</span>
                <a href={url} className="inline-flex justify-center rounded-xl bg-gold-500 text-black font-bold px-3 py-2">
                  Abrir meu plano
                </a>
              </div>,
            ],
            [{ ...escolha("Enviar como está", pedirNome), destaque: true }],
          );
        },
      },
    ];
  }

  function verTelas() {
    const s = sel.current;
    if (!s) return;
    const chaves = [
      ...(s.plano ? [`plano:${s.plano}`] : []),
      ...(s.quadros.length ? ["cota:master"] : []),
      ...(s.modalidades.length ? ["cota:apoio"] : []),
      ...(s.visita ? ["visita"] : []),
    ].filter((k) => INCLUI[k]);
    const ids = placementsDe(chaves).slice(0, 3) as PlacementId[];
    const marca = {
      nome: b.current.empresa,
      cor: "#2563eb",
      quadro: quadros.find((q) => s.quadros.includes(q.slug))?.name,
    };
    bot(
      [
        `Assim a ${b.current.empresa} aparece no programa:`,
        ...ids.map((id) => (
          <div key={id} className="w-56">
            <PlacementMockup id={id} marca={marca} />
          </div>
        )),
        "As outras telas estão no Monte seu plano, com a cor da sua marca.",
      ],
      opcoesPlano().filter((o) => o.label !== "Ver como fica na tela"),
    );
  }

  function pedirNome() {
    bot(["Perfeito. Qual é o seu nome?"], [], {
      placeholder: "Seu nome",
      enviar: (v) => {
        contato.current.nome = v;
        pedirWhats();
      },
    });
  }

  function pedirWhats(erro?: string) {
    bot([erro ?? "E o seu WhatsApp com DDD? O comercial te chama por lá."], [], {
      placeholder: "(19) 99999-9999",
      tipo: "tel",
      enviar: (v) => enviar(v),
    });
  }

  async function enviar(whats: string) {
    if (!sel.current) return;
    const orc = orcar(sel.current);
    const fd = new FormData();
    fd.set("name", contato.current.nome);
    fd.set("whatsapp", whats);
    fd.set("origem", "chat");
    fd.set("plano", JSON.stringify({ briefing: b.current, selecao: { ...sel.current, meses: orc.meses } }));
    setOpcoes([]);
    setEntrada(null);
    setDigitando(true);
    const r = await enviarPlano({ ok: false, error: null, resumo: null }, fd).catch(() => null);
    setDigitando(false);
    if (r && !r.ok && r.error?.includes("WhatsApp válido")) return pedirWhats("Hmm, esse número não parece certo. Pode mandar com DDD?");
    if (!r?.ok) {
      return bot(
        [
          "Não consegui enviar agora. 😕 Manda pelo WhatsApp, que o seu plano já vai junto:",
          <a
            key="w"
            href={whatsapp(r?.resumo ?? `Montei um plano no site para a ${b.current.empresa} e quero fechar`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] text-black font-bold px-3 py-2"
          >
            <WhatsAppIcon className="w-4 h-4" /> Enviar pelo WhatsApp
          </a>,
        ],
        [escolha("Começar de novo", recomecar)],
      );
    }
    bot(
      [
        `Enviado, ${contato.current.nome}! O comercial vai te chamar no WhatsApp para confirmar a disponibilidade e fechar.`,
        <a
          key="w"
          href={whatsapp(r.resumo ?? "")}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] text-black font-bold px-3 py-2"
        >
          <WhatsAppIcon className="w-4 h-4" /> Adiantar pelo WhatsApp
        </a>,
      ],
      [escolha("Começar de novo", recomecar)],
    );
  }

  function recomecar() {
    setMsgs([]);
    sel.current = null;
    inicio();
  }

  const abrir = () => {
    setAberto(true);
    fecharAviso();
    if (!msgs.length) inicio();
  };

  const mandarTexto = () => {
    const v = texto.trim();
    if (!v || !entrada) return;
    setTexto("");
    eu(v);
    entrada.enviar(v.slice(0, 120));
  };

  // ------------------------------------------------------------ tela

  return (
    <>
      {!aberto && (
        <div className="fixed bottom-6 right-6 z-50 flex items-end gap-3">
          {aviso && (
            <div className="relative max-w-[230px] rounded-2xl rounded-br-sm border border-gold-500/40 bg-[#111] p-3.5 shadow-2xl">
              <button onClick={fecharAviso} aria-label="Fechar" className="absolute top-1.5 right-2 text-white/40 hover:text-white text-sm">
                ×
              </button>
              <button onClick={abrir} className="text-left">
                <span className="block text-white text-sm font-bold pr-3">Quanto custa anunciar aqui?</span>
                <span className="block text-white/55 text-xs mt-1 leading-snug">Monto seu plano com o preço em 1 minuto.</span>
              </button>
            </div>
          )}
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-gold-500 animate-pulse-ring" />
            <button
              onClick={abrir}
              aria-label="Abrir o chat comercial"
              className="relative flex items-center justify-center w-14 h-14 bg-gold-500 rounded-full shadow-lg hover:scale-110 transition-transform"
            >
              <svg className="w-7 h-7 text-black" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm3 6.5a1.5 1.5 0 1 0 0 .01zm5 0a1.5 1.5 0 1 0 0 .01zm5 0a1.5 1.5 0 1 0 0 .01z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {aberto && (
        <div
          role="dialog"
          aria-label="Chat comercial"
          className="fixed z-50 inset-x-0 bottom-0 top-16 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[380px] sm:h-[600px] sm:max-h-[calc(100vh-3rem)] flex flex-col bg-[#0d0d0d] border border-[#2a2a2a] sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden"
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[#222] bg-[#111]">
            <div className="w-9 h-9 rounded-full bg-gold-500 text-black font-black flex items-center justify-center text-sm">PFC</div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-bold text-sm">Comercial · Fora da Caixa</div>
              <div className="text-emerald-400 text-[11px]">● Monte seu plano com preço</div>
            </div>
            <a
              href={whatsapp("Vim pelo site do Fora da Caixa e quero saber mais")}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Ir para o WhatsApp"
              className="w-8 h-8 rounded-full bg-[#25D366]/15 text-[#25D366] flex items-center justify-center"
            >
              <WhatsAppIcon className="w-4 h-4" />
            </a>
            <button onClick={() => setAberto(false)} aria-label="Fechar o chat" className="w-8 h-8 rounded-full text-white/50 hover:text-white hover:bg-white/5 text-xl leading-none">
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-2.5">
            {msgs.map((m) => (
              <Bolha key={m.id} m={m} />
            ))}
            {digitando && (
              <div className="flex">
                <div className="bg-[#1c1c1c] rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: `${i * 120}ms` }} />
                  ))}
                </div>
              </div>
            )}
            {opcoes.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-end pt-1">
                {opcoes.map((o) => (
                  <button
                    key={o.label}
                    onClick={o.acao}
                    className={`rounded-full border px-3.5 py-2 text-[13px] font-semibold text-left transition-colors ${
                      o.destaque
                        ? "border-gold-500 bg-gold-500/15 text-gold-400 hover:bg-gold-500/25"
                        : "border-white/15 text-white/80 hover:border-gold-500/50 hover:text-white"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
            <div ref={fim} />
          </div>

          {entrada && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                mandarTexto();
              }}
              className="flex gap-2 p-3 border-t border-[#222] bg-[#111]"
            >
              <input
                autoFocus
                type={entrada.tipo ?? "text"}
                inputMode={entrada.tipo === "tel" ? "tel" : undefined}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={entrada.placeholder}
                maxLength={120}
                className="flex-1 bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold-500/60"
              />
              <button type="submit" className="btn-primary px-4 rounded-xl font-bold text-sm" aria-label="Enviar">
                ➤
              </button>
            </form>
          )}
        </div>
      )}
    </>
  );
}

import AdminHeader from "@/components/admin/AdminHeader";
import { EspacoHeader } from "@/components/admin/Espaco";
import CopyButton from "@/components/CopyButton";
import CotaForm, { type CotaInicial } from "@/components/ao-vivo/CotaForm";
import { brtDate } from "@/lib/agenda/store";
import { garantirTelas, getCota, listCotas, modalidadesDo, relatorio, sessaoAtiva, type Cota } from "@/lib/ao-vivo/store";
import { MOMENTOS, TIPOS } from "@/lib/ao-vivo/tipos";
import { requireAcesso } from "@/lib/auth";
import { site } from "@/lib/config";
import { db } from "@/lib/producao/store";
import { QUADROS, QUADRO_IDS, isQuadroId } from "@/lib/producao/quadros";
import { alternarCotaAction, apagarCotaAction, trocarLinksAction } from "./actions";

export const dynamic = "force-dynamic";

const ABAS = ["quadros", "cotas", "veiculacoes"] as const;
type Aba = (typeof ABAS)[number];

const nomeDo = (q: string) => (isQuadroId(q) ? QUADROS[q].name : q);
const corDo = (q: string) => (isQuadroId(q) ? QUADROS[q].accent[1] : "#666");
const base = site.url.replace(/\/$/, "");
const dataBr = (d: string) => d.split("-").reverse().join("/");

function frequencia(c: Cota): string {
  if (c.momento !== "durante") return MOMENTOS[c.momento];
  return c.vezes ? `${c.vezes}× por episódio` : `a cada ${c.a_cada_min} min`;
}

function minutos(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return s % 60 ? `${m}min ${s % 60}s` : `${m}min`;
}

export default async function AoVivoPage({ searchParams }: { searchParams: { aba?: string; editar?: string; mes?: string } }) {
  await requireAcesso("ao_vivo.ver");
  const aba: Aba = ABAS.includes(searchParams.aba as Aba) ? (searchParams.aba as Aba) : searchParams.editar ? "cotas" : "quadros";
  const [telas, cotas] = await Promise.all([garantirTelas(), listCotas()]);
  const ativas = cotas.filter((c) => c.ativo);

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        <EspacoHeader
          area="Ao vivo"
          titulo="Inserções na live"
          abas={[
            { href: "/admin/ao-vivo", label: "Quadros e OBS", ativa: aba === "quadros" },
            { href: "/admin/ao-vivo?aba=cotas", label: "Cotas", ativa: aba === "cotas", count: ativas.length },
            { href: "/admin/ao-vivo?aba=veiculacoes", label: "Veiculações", ativa: aba === "veiculacoes" },
          ]}
        />
        {aba === "quadros" && <Quadros telas={telas} cotas={ativas} />}
        {aba === "cotas" && <Cotas cotas={cotas} editar={searchParams.editar} />}
        {aba === "veiculacoes" && <Veiculacoes mes={searchParams.mes} />}
      </div>
    </div>
  );
}

async function Quadros({ telas, cotas }: { telas: Awaited<ReturnType<typeof garantirTelas>>; cotas: Cota[] }) {
  const ordenadas = [...telas].sort((a, b) => QUADRO_IDS.indexOf(a.quadro) - QUADRO_IDS.indexOf(b.quadro));
  const sessoes = await Promise.all(ordenadas.map((t) => sessaoAtiva(t.quadro)));
  return (
    <>
      <details className="mt-5 bg-[#121212] border border-[#242424] rounded-xl p-4 text-sm text-white/70">
        <summary className="cursor-pointer text-white font-semibold">Como montar a cena no OBS (uma vez por quadro)</summary>
        <ol className="list-decimal pl-5 mt-3 space-y-1.5">
          <li>Na cena do quadro, adicione uma fonte <b>Navegador</b> no topo da lista (por cima das câmeras e do GC).</li>
          <li>Cole a URL da <b>tela do OBS</b> do quadro. Largura 1920, altura 1080. Não precisa de CSS.</li>
          <li>Marque <b>Controlar áudio via OBS</b> (é o som da vinheta) e desmarque &quot;Desligar fonte quando não visível&quot;.</li>
          <li>Pronto: ela fica transparente até a live começar. Quem opera abre a <b>régie</b> no celular e aperta &quot;Começar a live&quot;.</li>
          <li>Para conferir sem o OBS, abra a tela com <code>?teste=1</code> no navegador.</li>
        </ol>
        <p className="text-white font-semibold mt-4">Para a inserção em L encolher o vídeo (uma vez por computador)</p>
        <ol className="list-decimal pl-5 mt-2 space-y-1.5">
          <li>No OBS, abra <b>Ferramentas → Configurações do servidor WebSocket</b>, ative o servidor e copie a senha.</li>
          <li>No fim da URL da fonte Navegador, acrescente <code>#obs=SENHA</code>. O que vem depois do # fica só no OBS e não é enviado ao site.</li>
          <li>O vídeo que encolhe é a fonte <b>ATEM</b>. Se a sua tiver outro nome, acrescente <code>&amp;fonte=NOME</code>.</li>
          <li>Só encolhe quando o ATEM está em tela cheia. Em cenas como a &quot;Tela + cam&quot;, ou sem esses passos, o L cobre as bordas do vídeo.</li>
        </ol>
      </details>
      <div className="grid gap-3 mt-4 md:grid-cols-2">
        {ordenadas.map((t, i) => {
            const s = sessoes[i];
            const doQuadro = cotas.filter((c) => c.quadro === t.quadro);
            const parceiros = new Set(doQuadro.map((c) => c.partner_id)).size;
            const tela = `${base}/ao-vivo/tela/${t.token_tela}`;
            const regie = `${base}/ao-vivo/regie/${t.token_regie}`;
            return (
              <section key={t.quadro} className="bg-[#161616] border border-[#242424] rounded-xl p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-bold text-white flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: corDo(t.quadro) }} />
                    {nomeDo(t.quadro)}
                  </h2>
                  {s ? (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded border border-red-500/40 text-red-300 bg-red-500/10">
                      AO VIVO desde {new Date(s.iniciada_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
                    </span>
                  ) : (
                    <span className="text-[11px] text-white/40">sem live</span>
                  )}
                </div>
                <p className="text-xs text-white/50 mt-1">
                  {parceiros ? `${parceiros} ${parceiros === 1 ? "parceiro" : "parceiros"} · ${doQuadro.length} cotas ativas` : "Nenhuma cota ativa"}
                </p>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-white/50 w-20 shrink-0">Tela do OBS</span>
                    <code className="truncate text-white/70 flex-1">{tela}</code>
                    <CopyButton value={tela} className="text-xs" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white/50 w-20 shrink-0">Régie</span>
                    <code className="truncate text-white/70 flex-1">{regie}</code>
                    <CopyButton value={regie} className="text-xs" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 mt-3 text-xs">
                  <a href={`/ao-vivo/regie/${t.token_regie}`} target="_blank" className="text-gold-400 hover:underline">
                    Abrir régie
                  </a>
                  <a href={`/ao-vivo/tela/${t.token_tela}?teste=1`} target="_blank" className="text-gold-400 hover:underline">
                    Ver a tela
                  </a>
                  <form action={trocarLinksAction} className="ml-auto">
                    <input type="hidden" name="quadro" value={t.quadro} />
                    <button className="text-white/40 hover:text-red-300" title="Use se o link vazou. A URL da cena do OBS precisa ser trocada.">
                      Trocar links
                    </button>
                  </form>
                </div>
              </section>
            );
          })}
      </div>
    </>
  );
}

async function Cotas({ cotas, editar }: { cotas: Awaited<ReturnType<typeof listCotas>>; editar?: string }) {
  const [{ data: parceiros }, emEdicao] = await Promise.all([
    db().from("partners").select("id, name, plan, active").order("active", { ascending: false }).order("name"),
    editar ? getCota(editar) : Promise.resolve(null),
  ]);
  const quadros = QUADRO_IDS.map((id) => ({ id, nome: QUADROS[id].name, modalidades: modalidadesDo(id) }));
  const hoje = brtDate(new Date());
  const porQuadro = QUADRO_IDS.map((q) => [q, cotas.filter((c) => c.quadro === q)] as const).filter(([, cs]) => cs.length);

  return (
    <div className="mt-5 space-y-6">
      <section>
        <h2 className="text-sm font-semibold text-white mb-2">{emEdicao ? "Editar cota" : "Nova cota"}</h2>
        <CotaForm key={emEdicao?.id ?? "nova"} parceiros={parceiros ?? []} quadros={quadros} inicial={(emEdicao as CotaInicial | null) ?? undefined} />
      </section>

      {porQuadro.length === 0 && <p className="text-white/50 text-sm">Nenhuma cota cadastrada ainda.</p>}
      {porQuadro.map(([q, cs]) => (
        <section key={q}>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: corDo(q) }} />
            {nomeDo(q)}
          </h2>
          <ul className="mt-2 divide-y divide-[#222] border border-[#242424] rounded-xl overflow-hidden">
            {cs.map((c) => {
              const vencida = !!c.fim && c.fim < hoje;
              const futura = !!c.inicio && c.inicio > hoje;
              return (
                <li key={c.id} className={`p-3 bg-[#141414] flex flex-wrap items-center gap-x-4 gap-y-1 ${c.ativo && !vencida ? "" : "opacity-50"}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-semibold">
                      {c.parceiro?.name ?? "?"}
                      {c.modalidade && <span className="text-white/50 font-normal"> · só {c.modalidade}</span>}
                    </p>
                    <p className="text-xs text-white/55">
                      {TIPOS[c.tipo].label} · {frequencia(c)}
                      {c.momento !== "continuo" && ` · ${c.duracao_s}s`}
                      {c.texto && ` · “${c.texto}”`}
                      {c.midia_path && " · com arquivo"}
                    </p>
                    <p className="text-[11px] text-white/35">
                      {c.inicio || c.fim
                        ? `Vigência ${c.inicio ? dataBr(c.inicio) : "…"} a ${c.fim ? dataBr(c.fim) : "…"}`
                        : "Sem data de fim"}
                      {vencida && " · vencida"}
                      {futura && " · ainda não começou"}
                      {!c.ativo && " · pausada"}
                      {c.parceiro && !c.parceiro.active && " · parceiro inativo (não entra)"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <a href={`/admin/ao-vivo?aba=cotas&editar=${c.id}`} className="text-gold-400 hover:underline">
                      Editar
                    </a>
                    <form action={alternarCotaAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="ativo" value={c.ativo ? "0" : "1"} />
                      <button className="text-white/60 hover:text-white">{c.ativo ? "Pausar" : "Ativar"}</button>
                    </form>
                    <form action={apagarCotaAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="text-white/40 hover:text-red-300">Apagar</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

async function Veiculacoes({ mes }: { mes?: string }) {
  const atual = /^\d{4}-\d{2}$/.test(mes ?? "") ? mes! : brtDate(new Date()).slice(0, 7);
  const [ano, m] = atual.split("-").map(Number);
  const ultimo = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  const { linhas, lives } = await relatorio(`${atual}-01`, `${atual}-${String(ultimo).padStart(2, "0")}`);
  const ant = m === 1 ? `${ano - 1}-12` : `${ano}-${String(m - 1).padStart(2, "0")}`;
  const prox = m === 12 ? `${ano + 1}-01` : `${ano}-${String(m + 1).padStart(2, "0")}`;
  const nomeMes = new Date(Date.UTC(ano, m - 1, 15)).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="mt-5">
      <div className="flex items-center gap-3 text-sm">
        <a href={`/admin/ao-vivo?aba=veiculacoes&mes=${ant}`} className="text-white/50 hover:text-white">
          ←
        </a>
        <span className="text-white font-semibold capitalize">{nomeMes}</span>
        <a href={`/admin/ao-vivo?aba=veiculacoes&mes=${prox}`} className="text-white/50 hover:text-white">
          →
        </a>
        <span className="text-white/40 text-xs ml-2">
          {lives.length} {lives.length === 1 ? "live" : "lives"}
        </span>
      </div>
      <p className="text-xs text-white/40 mt-1">
        Prova de veiculação: hora em que cada inserção entrou e saiu do ar. Inserção tirada antes conta o tempo real.
      </p>

      {linhas.length === 0 ? (
        <p className="text-white/50 text-sm mt-4">Nenhuma inserção no mês.</p>
      ) : (
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead className="text-xs text-white/40 text-left">
              <tr>
                <th className="py-2 pr-4 font-normal">Parceiro</th>
                <th className="py-2 pr-4 font-normal">Lives</th>
                <th className="py-2 pr-4 font-normal">Inserções</th>
                <th className="py-2 pr-4 font-normal">Tempo no ar</th>
                <th className="py-2 pr-4 font-normal">Por tipo</th>
                <th className="py-2 font-normal">Não entraram</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222]">
              {linhas.map((l) => (
                <tr key={l.partner_id} className="text-white/80">
                  <td className="py-2 pr-4 text-white">{l.parceiro}</td>
                  <td className="py-2 pr-4 tabular-nums">{l.lives}</td>
                  <td className="py-2 pr-4 tabular-nums">{l.exibidas}</td>
                  <td className="py-2 pr-4 tabular-nums">{minutos(l.segundos)}</td>
                  <td className="py-2 pr-4 text-xs text-white/60">
                    {Object.entries(l.porTipo)
                      .map(([t, n]) => `${n} ${TIPOS[t as keyof typeof TIPOS].label.toLowerCase()}`)
                      .join(" · ")}
                  </td>
                  <td className={`py-2 tabular-nums ${l.naoEntraram ? "text-yellow-300" : "text-white/40"}`}>{l.naoEntraram}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lives.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-white mt-6">Lives do mês</h2>
          <ul className="mt-2 text-sm text-white/70 space-y-1">
            {lives.map((s) => (
              <li key={s.id}>
                {new Date(s.iniciada_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })} · {nomeDo(s.quadro)}
                {s.modalidade && ` · ${s.modalidade}`}
                {s.titulo && ` · ${s.titulo}`}
                {s.encerrada_em
                  ? ` · ${Math.round((new Date(s.encerrada_em).getTime() - new Date(s.iniciada_em).getTime()) / 60000)} min`
                  : " · no ar"}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

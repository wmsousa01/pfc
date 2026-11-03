import AdminHeader from "@/components/admin/AdminHeader";
import { AnaliseView, Miniatura, Nota, SubNav, btnPri, btnSec, card, input } from "@/components/admin/Campanhas";
import ProducaoForm from "@/components/admin/ProducaoForm";
import MaterialUploader from "@/components/agenda/MaterialUploader";
import { requireAdmin } from "@/lib/auth";
import { arquivosDaPasta, pastaCampanhas } from "@/lib/campanhas/fontes";
import { MODELOS } from "@/lib/campanhas/modelos";
import { CAMPANHAS_DO_PLANO, FONTES, PECAS, PLANO_URL, pecaPorCodigo, type Peca } from "@/lib/campanhas/plano";
import { FORMATOS, listCriativos, listEstrategias, previews, type Criativo, type Enquadramento, type Origem } from "@/lib/campanhas/store";
import { isContentaConfigured, listContentaJobs, listJobCuts, type ContentaCut, type ContentaJob } from "@/lib/producao/contenta";
import { isGeminiConfigured } from "@/lib/producao/gemini";
import {
  analisarCriativoAction,
  arquivarCriativoAction,
  classificarCriativoAction,
  classificarNaPautaAction,
  gerarEstaticoAction,
  importarContentaAction,
  importarDriveAction,
  pedirUploadAction,
  registrarUploadAction,
  salvarPastaAction,
} from "../actions";

export const dynamic = "force-dynamic";
// Análise de vídeo (upload para o Gemini) e geração da peça rodam na action.
export const maxDuration = 300;

const ORIGEM: Record<Origem, string> = { drive: "Drive", upload: "Upload", contenta: "Contenta", gerado: "Gerado por IA" };

function abrirUrl(c: Criativo, preview: string | undefined): string | undefined {
  if (c.origem === "drive") return `https://drive.google.com/file/d/${c.ref}/view`;
  if (c.origem === "contenta") return c.ref;
  return preview;
}

const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** O que a IA sugeriu e se a peça marcada bate com a sugestão. */
function Enquadrado({ e, atual }: { e: Enquadramento; atual: string | null }) {
  const p = pecaPorCodigo(e.peca);
  const campanha = p ? CAMPANHAS_DO_PLANO[p.campanha].codigo : null;
  const estado = !p ? null : atual === p.codigo ? "aplicada" : atual ? `a equipe marcou ${atual}` : "abaixo de 60%, não aplicada";
  return (
    <p className="text-[11px] text-white/50 mt-2 leading-snug">
      <span className="text-white/70 font-semibold">IA: </span>
      {p ? (
        <>
          <span className="text-gold-400 font-mono">{p.codigo}</span> ({campanha}) · {e.confianca}%{estado && <span className="text-white/35"> · {estado}</span>}
        </>
      ) : (
        "não cumpre nenhuma peça da pauta"
      )}
      <span className="block text-white/40">{e.motivo}</span>
    </p>
  );
}

export default async function CriativosPage({ searchParams }: { searchParams: { job?: string; f?: string; peca?: string } }) {
  await requireAdmin();

  const [criativos, estrategias, pasta] = await Promise.all([
    listCriativos().catch(() => [] as Criativo[]),
    listEstrategias().then((x) => x ?? []),
    pastaCampanhas().catch(() => null),
  ]);
  const thumbs = await previews(criativos);

  let drive: Awaited<ReturnType<typeof arquivosDaPasta>> = [];
  let driveErro: string | null = null;
  if (pasta) {
    try {
      drive = await arquivosDaPasta(pasta);
    } catch (e) {
      driveErro = e instanceof Error ? e.message : String(e);
    }
  }

  let jobs: ContentaJob[] = [];
  let cuts: ContentaCut[] = [];
  let contentaErro: string | null = null;
  const jobId = searchParams.job && /^job_\d{13,16}$/.test(searchParams.job) ? searchParams.job : null;
  if (isContentaConfigured()) {
    try {
      jobs = (await listContentaJobs())
        .filter((j) => j.status === "done" && j.totalCuts > 0)
        .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
        .slice(0, 15);
      if (jobId) cuts = (await listJobCuts(jobId)).items;
    } catch (e) {
      contentaErro = e instanceof Error ? e.message : String(e);
    }
  }
  const jaContenta = new Set(criativos.filter((c) => c.origem === "contenta").map((c) => c.ref));

  const filtro = searchParams.f;
  const visiveis = criativos.filter((c) =>
    filtro === "video" ? c.tipo === "video" : filtro === "imagem" ? c.tipo === "imagem" : filtro === "sem" ? c.analise_nota === null : true
  );
  const imagens = criativos.filter((c) => c.tipo === "imagem" || c.thumb_url);

  // Pauta do plano: o que já tem criativo marcado e a melhor nota de cada peça.
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const daPeca = (p: Peca) => criativos.filter((c) => c.peca === p.codigo);
  const estrategiaDe = (k: Peca["campanha"]) => estrategias.find((e) => e.nome === MODELOS[k].m.nome);
  const prontas = PECAS.filter((p) => daPeca(p).length > 0).length;
  const atrasadas = PECAS.filter((p) => daPeca(p).length === 0 && p.prazo < hoje).length;
  const pecaSel = pecaPorCodigo(searchParams.peca);
  const est = pecaSel?.estatico;
  const semPeca = criativos.filter((c) => c.analise && !c.peca).length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div>
          <SubNav atual="criativos" />
          <h1 className="text-2xl font-bold text-white">Biblioteca de criativos</h1>
          <p className="text-white/40 text-sm mt-1">
            As peças gravadas e editadas, de onde estiverem. Daqui elas são analisadas pela IA e entregues às estratégias.
          </p>
        </div>

        {/* ---- Pauta do plano ---- */}
        <section className={card}>
          <h2 className="text-white font-bold">Pauta do plano de campanhas</h2>
          <p className="text-white/40 text-xs mt-0.5">
            {prontas} de {PECAS.length} peças na biblioteca{atrasadas > 0 ? ` · ${atrasadas} com prazo vencido` : ""}. Marque cada criativo com a peça que ele
            cumpre, no cartão dele lá embaixo.{" "}
            <a href={PLANO_URL} target="_blank" className="text-gold-400 hover:text-gold-300">Ver o plano ↗</a>
          </p>
          <div className="mt-4 space-y-5">
            {(Object.keys(CAMPANHAS_DO_PLANO) as Peca["campanha"][]).map((k) => {
              const camp = CAMPANHAS_DO_PLANO[k];
              const e = estrategiaDe(k);
              return (
                <div key={k}>
                  <p className="text-xs font-bold text-white/80">
                    {camp.codigo} · {MODELOS[k].m.nome}
                    <span className="font-normal text-white/40"> — {camp.resumo}</span>
                    {e ? (
                      <a href={`/admin/campanhas/${e.id}`} className="ml-2 font-normal text-gold-400 hover:text-gold-300">estratégia ↗</a>
                    ) : (
                      <span className="ml-2 font-normal text-white/30">· estratégia ainda não criada (modelo {camp.codigo})</span>
                    )}
                  </p>
                  <div className="mt-2 divide-y divide-[#1c1c1c] border border-[#1c1c1c] rounded-xl">
                    {PECAS.filter((p) => p.campanha === k).map((p) => {
                      const feitos = daPeca(p);
                      const notas = feitos.map((c) => c.analise_nota).filter((n): n is number => n !== null);
                      const atrasada = feitos.length === 0 && p.prazo < hoje;
                      return (
                        <div key={p.codigo} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs">
                          <span className="font-mono text-[11px] text-gold-400 w-14 shrink-0">{p.codigo}</span>
                          <span className="text-white/80 flex-1 min-w-[12rem]">
                            {p.titulo}
                            {p.nota && <span className="text-white/35"> · {p.nota}</span>}
                          </span>
                          <span className="text-white/40">{p.formatos.join(" + ")}</span>
                          <span className="text-white/40 w-28">{FONTES[p.fonte]}</span>
                          <span className={`w-16 ${atrasada ? "text-red-400" : "text-white/40"}`}>até {dataBR(p.prazo)}</span>
                          <span className="w-24 flex justify-end">
                            {feitos.length > 0 ? (
                              <Nota n={notas.length ? Math.max(...notas) : null} titulo={`${feitos.length} na biblioteca`} />
                            ) : p.estatico ? (
                              <a href={`?peca=${p.codigo}#gerar`} className="text-gold-400 hover:text-gold-300">gerar →</a>
                            ) : (
                              <span className={atrasada ? "text-red-400" : "text-white/30"}>falta</span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ---- Fontes ---- */}
        <section className="grid lg:grid-cols-3 gap-4">
          <div className={card}>
            <h2 className="text-white font-bold">Google Drive</h2>
            <p className="text-white/40 text-xs mt-0.5">Pasta compartilhada como “qualquer pessoa com o link”.</p>
            <ProducaoForm action={salvarPastaAction} label="Salvar pasta" pending="Salvando…" className="mt-3 flex gap-2" buttonClassName={btnSec}>
              <input name="pasta" defaultValue={pasta ?? ""} placeholder="Link da pasta do Drive" className={`${input} flex-1 min-w-0`} />
            </ProducaoForm>
            {driveErro && <p className="text-red-400 text-xs mt-2 break-words">{driveErro}</p>}
            {drive.length > 0 && (
              <ProducaoForm action={importarDriveAction} label="Importar marcados" pending="Importando…" okMessage="Importados." className="mt-3" buttonClassName={`${btnPri} mt-3`}>
                <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                  {drive.map((a) => (
                    <label key={a.id} className={`flex items-center gap-2 text-xs ${a.importado ? "text-white/30" : "text-white/80"}`}>
                      <input type="checkbox" name="arquivos" value={`${a.id}|${a.nome}`} disabled={a.importado} className="accent-gold-500" />
                      <span className="text-[10px] text-white/40 w-10 shrink-0">{a.tipo}</span>
                      <span className="truncate">{a.nome}</span>
                      {a.importado && <span className="text-[10px]">· na biblioteca</span>}
                    </label>
                  ))}
                </div>
              </ProducaoForm>
            )}
            {pasta && !driveErro && drive.length === 0 && <p className="text-white/40 text-xs mt-3">Nenhum vídeo ou imagem na pasta.</p>}
          </div>

          <div className={card}>
            <h2 className="text-white font-bold">Cortes do Contenta</h2>
            <p className="text-white/40 text-xs mt-0.5">Os cortes prontos dos jobs do PFC.</p>
            {!isContentaConfigured() ? (
              <p className="text-white/30 text-xs mt-3">CONTENTA_HUB_SECRET ausente.</p>
            ) : (
              <>
                <form className="mt-3 flex gap-2">
                  <select name="job" defaultValue={jobId ?? ""} className={`${input} flex-1 min-w-0`}>
                    <option value="">Escolha um job</option>
                    {jobs.map((j) => (
                      <option key={j.jobId} value={j.jobId}>
                        {j.createdAt ? new Date(j.createdAt).toLocaleDateString("pt-BR") : j.jobId} · {j.totalCuts} cortes
                      </option>
                    ))}
                  </select>
                  <button className={btnSec}>Ver</button>
                </form>
                {contentaErro && <p className="text-red-400 text-xs mt-2 break-words">{contentaErro}</p>}
                {jobId && cuts.length > 0 && (
                  <ProducaoForm action={importarContentaAction} label="Importar marcados" pending="Importando…" okMessage="Importados." className="mt-3" buttonClassName={`${btnPri} mt-3`}>
                    <input type="hidden" name="job" value={jobId} />
                    <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                      {cuts.map((c) => (
                        <label key={c.file} className={`flex items-center gap-2 text-xs ${jaContenta.has(c.url) ? "text-white/30" : "text-white/80"}`}>
                          <input type="checkbox" name="cortes" value={c.file} disabled={jaContenta.has(c.url)} className="accent-gold-500" />
                          <span className="truncate">{c.title ?? c.file}</span>
                          {c.durationSec && <span className="text-[10px] text-white/40 shrink-0">{Math.round(c.durationSec)}s</span>}
                        </label>
                      ))}
                    </div>
                  </ProducaoForm>
                )}
              </>
            )}
          </div>

          <div className={card}>
            <h2 className="text-white font-bold">Upload</h2>
            <p className="text-white/40 text-xs mt-0.5">Até 50 MB por arquivo; maiores, pela pasta do Drive. Escolha o formato da peça.</p>
            <div className="mt-3">
              <MaterialUploader
                pedir={pedirUploadAction}
                registrar={registrarUploadAction}
                tipos={[{ value: "", label: "Formato pelo nome" }, ...FORMATOS.map((f) => ({ value: f, label: f }))]}
                inputCls={input}
                buttonCls={btnPri}
              />
            </div>
          </div>
        </section>

        {/* ---- Gerador de estático ---- */}
        <section id="gerar" className={card}>
          <h2 className="text-white font-bold">Gerar criativo estático</h2>
          <p className="text-white/40 text-xs mt-0.5">
            O Gemini desenha a peça com o texto exato, na identidade do PFC, usando fotos da biblioteca como referência (rostos reais, sem inventar
            pessoas). A peça entra na biblioteca.
          </p>
          {!isGeminiConfigured() ? (
            <p className="text-white/30 text-xs mt-3">GOOGLE_AI_API_KEY ausente.</p>
          ) : (
            <ProducaoForm
              // Remonta ao trocar de peça, para os campos pegarem o texto do plano.
              key={pecaSel?.codigo ?? "livre"}
              action={gerarEstaticoAction}
              label="Gerar peça"
              pending="Gerando… (~40 s)"
              okMessage="Peça gerada: está na biblioteca abaixo."
              className="mt-4 space-y-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <select name="peca" defaultValue={est ? pecaSel?.codigo : ""} className={input}>
                  <option value="">Peça avulsa (fora do plano)</option>
                  {PECAS.filter((p) => p.tipo === "imagem").map((p) => (
                    <option key={p.codigo} value={p.codigo}>{p.codigo} · {p.titulo}</option>
                  ))}
                </select>
                <span className="text-[11px] text-white/40">
                  {est ? `Texto do plano para ${pecaSel?.codigo}.${pecaSel?.nota ? ` ${pecaSel.nota}.` : ""}` : "Para vir com o texto do plano, use “gerar →” na pauta."}
                </span>
              </div>
              <div className="grid md:grid-cols-4 gap-2">
                <select name="estrategia_id" className={input} defaultValue={(pecaSel && estrategiaDe(pecaSel.campanha)?.id) || estrategias[0]?.id || ""}>
                  <option value="">Sem estratégia</option>
                  {estrategias.map((e) => (
                    <option key={e.id} value={e.id}>{e.nome}</option>
                  ))}
                </select>
                <select name="formato" className={input} defaultValue={est ? pecaSel?.formatos[0] : "4:5"}>
                  <option value="4:5">4:5 · Feed</option>
                  <option value="9:16">9:16 · Stories/Reels</option>
                  <option value="1:1">1:1 · Quadrado</option>
                  <option value="16:9">16:9 · Paisagem</option>
                </select>
                <input name="chamada" defaultValue={est?.chamada} placeholder="Chamada na peça (ex.: PEÇA O MEDIA KIT)" className={`${input} md:col-span-2`} />
              </div>
              <div className="grid md:grid-cols-2 gap-2">
                <input name="headline" required defaultValue={est?.headline} placeholder="Headline (exatamente como vai na peça)" className={input} />
                <input name="apoio" defaultValue={est?.apoio} placeholder="Linha de apoio (opcional)" className={input} />
              </div>
              <textarea name="instrucao" rows={2} defaultValue={est?.instrucao} placeholder="Pedido extra (opcional): cenário, clima, o que destacar" className={`${input} w-full`} />
              {imagens.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-white/40 mb-2">Referências (até 3)</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {imagens.slice(0, 40).map((c) => (
                      <label key={c.id} className="relative cursor-pointer shrink-0">
                        <input type="checkbox" name="refs" value={c.id} className="peer absolute top-1 left-1 z-10 accent-gold-500" />
                        <div className="rounded-lg border border-[#222] peer-checked:border-gold-500 p-1">
                          <Miniatura c={c} url={thumbs.get(c.id)} className="w-14" />
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 text-xs text-white/70">
                <input type="checkbox" name="logo" defaultChecked className="accent-gold-500" />
                Aplicar o logo do Fora da Caixa (o de /admin/producao/config)
              </label>
            </ProducaoForm>
          )}
        </section>

        {/* ---- Biblioteca ---- */}
        <section>
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-white font-bold text-lg">Na biblioteca ({criativos.length})</h2>
              {semPeca > 0 && isGeminiConfigured() && (
                <ProducaoForm
                  action={classificarNaPautaAction}
                  label={`Classificar na pauta (${semPeca})`}
                  pending="Classificando…"
                  okMessage="Classificados: veja a sugestão em cada cartão."
                  className="flex flex-col"
                  buttonClassName={btnSec}
                />
              )}
            </div>
            <div className="flex gap-1 text-xs">
              {[
                ["", "Todos"],
                ["video", "Vídeos"],
                ["imagem", "Imagens"],
                ["sem", "Sem análise"],
              ].map(([v, l]) => (
                <a
                  key={v}
                  href={v ? `?f=${v}` : "?"}
                  className={`px-2.5 py-1 rounded-lg border ${(filtro ?? "") === v ? "border-gold-500/40 text-gold-400" : "border-transparent text-white/50 hover:text-white"}`}
                >
                  {l}
                </a>
              ))}
            </div>
          </div>
          {visiveis.length === 0 && <p className="text-white/40 text-sm">Nada aqui ainda. Importe do Drive, do Contenta ou suba um arquivo.</p>}
          <div className="grid md:grid-cols-2 gap-4">
            {visiveis.map((c) => {
              const prev = thumbs.get(c.id);
              const abrir = abrirUrl(c, prev);
              return (
                <div key={c.id} className={`${card} flex gap-4`}>
                  <Miniatura c={c} url={prev} className="w-24" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-white text-sm font-semibold leading-snug line-clamp-2">{c.nome}</p>
                      <Nota n={c.analise_nota} />
                    </div>
                    <p className="text-white/40 text-xs mt-0.5">
                      {c.tipo === "video" ? "Vídeo" : "Imagem"} · {ORIGEM[c.origem]}
                      {c.duracao_s ? ` · ${c.duracao_s}s` : ""}
                      {c.peca && <span className="text-gold-400 font-mono"> · {c.peca}</span>}
                      {abrir && (
                        <>
                          {" · "}
                          <a href={abrir} target="_blank" className="text-gold-400 hover:text-gold-300">abrir ↗</a>
                        </>
                      )}
                    </p>
                    <form action={classificarCriativoAction} className="flex flex-wrap items-center gap-1 mt-2">
                      <input type="hidden" name="id" value={c.id} />
                      <select name="formato" defaultValue={c.formato ?? ""} className={input}>
                        <option value="">Formato?</option>
                        {FORMATOS.map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                      <select name="peca" defaultValue={c.peca ?? ""} className={`${input} max-w-[11rem]`}>
                        <option value="">Peça do plano?</option>
                        {PECAS.filter((p) => p.tipo === c.tipo).map((p) => (
                          <option key={p.codigo} value={p.codigo}>{p.codigo} · {p.titulo}</option>
                        ))}
                      </select>
                      <button className="text-[11px] text-white/40 hover:text-white px-1">ok</button>
                    </form>
                    {isGeminiConfigured() && (
                      <ProducaoForm
                        action={analisarCriativoAction}
                        label={c.analise ? "Analisar de novo" : "Analisar"}
                        pending={c.tipo === "video" ? "Analisando… (~1 min)" : "Analisando…"}
                        className="flex flex-wrap items-center gap-1 mt-2"
                        buttonClassName={btnSec}
                      >
                        <input type="hidden" name="id" value={c.id} />
                        <select name="estrategia_id" defaultValue="" className={`${input} max-w-[10rem]`}>
                          <option value="">Análise genérica</option>
                          {estrategias.map((e) => (
                            <option key={e.id} value={e.id}>{e.nome}</option>
                          ))}
                        </select>
                      </ProducaoForm>
                    )}
                    {c.analise?.enquadramento && <Enquadrado e={c.analise.enquadramento} atual={c.peca} />}
                    {c.analise && <AnaliseView a={c.analise} />}
                    <form action={arquivarCriativoAction} className="mt-2">
                      <input type="hidden" name="id" value={c.id} />
                      <button className="text-[11px] text-white/30 hover:text-red-400">Arquivar</button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProducaoForm from "@/components/admin/ProducaoForm";
import MaterialUploader from "@/components/agenda/MaterialUploader";
import EnvioGrande from "@/components/arquivos/EnvioGrande";
import { arquivosDa, tamanhoLegivel } from "@/lib/arquivos/store";
import CadastroFields from "@/components/apresentador/CadastroFields";
import TermoImagem from "@/components/apresentador/TermoImagem";
import { TIPOS_MATERIAL, cadastroPorToken, materiaisDoCadastro, type MaterialApresentadorTipo } from "@/lib/apresentadores/store";
import { whatsapp } from "@/lib/config";
import { signedUrls } from "@/lib/producao/store";
import {
  cancelarArquivoAction,
  concluirArquivoAction,
  iniciarArquivoAction,
  retomarArquivoAction,
  urlsArquivoAction,
  pedirUploadAction, registrarUploadAction, removerMaterialAction, revogarTermoAction, salvarDadosAction } from "../actions";

export const dynamic = "force-dynamic";

// O link é pessoal: fora dos buscadores.
export const metadata: Metadata = { title: "Sua área de apresentador | Fora da Caixa", robots: { index: false, follow: false } };

const STATUS = {
  pendente: { label: "Cadastro em análise", texto: "A produção vai conferir e liberar você no quadro. Já pode mandar seus materiais.", cls: "border-gold-500/40 bg-gold-500/10 text-gold-300" },
  aprovado: { label: "Cadastro aprovado", texto: "Você já está na grade. Mande material novo sempre que tiver.", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  arquivado: { label: "Cadastro encerrado", texto: "Este cadastro não recebe mais materiais. Fale com a produção se quiser voltar.", cls: "border-red-500/40 bg-red-500/10 text-red-300" },
} as const;

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const tamanho = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default async function ApresentadorPage({ params, searchParams }: { params: { token: string }; searchParams: { novo?: string } }) {
  const c = await cadastroPorToken(params.token);
  if (!c) notFound();
  const st = STATUS[c.status];
  const aberto = c.status !== "arquivado";
  const materiais = await materiaisDoCadastro([c.id]);
  const urls = await signedUrls(materiais.map((m) => m.path));
  // Só o que chegou por esta página; o que a equipe pôs na pasta não aparece aqui.
  const grandes = c.pasta_id ? (await arquivosDa(c.pasta_id)).filter((a) => a.status === "pronto" && !a.link_id && a.enviado_por.endsWith("(apresentador)")) : [];

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#0a0a0a] pt-28 pb-20">
        <div className="container-px max-w-3xl space-y-8">
          {searchParams.novo && (
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-sm">
              Cadastro feito! Salve este link nos favoritos: é por ele que você volta para mandar materiais.
            </div>
          )}

          <div>
            <span className="section-tag">Área do apresentador</span>
            <h1 className="text-3xl sm:text-4xl font-black mt-3 leading-tight">Olá, {c.nome.split(" ")[0]}</h1>
            <div className={`mt-4 p-4 rounded-xl border text-sm ${st.cls}`}>
              <strong>{st.label}.</strong> {st.texto}
            </div>
          </div>

          {aberto && (
            <section className="bg-[#111] border border-[#222] rounded-2xl p-6">
              <h2 className="text-white font-bold">Fotos e materiais</h2>
              <p className="text-white/50 text-sm mt-1">
                Fotos suas (de frente, boa luz, fundo simples) para as artes e thumbs; vídeos, vinhetas e roteiros para usar
                nas gravações e na transmissão. Até 50 MB por arquivo; vídeo maior vai em Arquivos grandes, logo abaixo.
              </p>
              <div className="mt-4">
                <MaterialUploader
                  pedir={pedirUploadAction.bind(null, c.token)}
                  registrar={registrarUploadAction.bind(null, c.token)}
                  tipos={(Object.keys(TIPOS_MATERIAL) as MaterialApresentadorTipo[]).map((v) => ({ value: v, label: TIPOS_MATERIAL[v] }))}
                  inputCls="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white"
                  buttonCls="btn-primary px-4 py-2 rounded-lg text-sm font-bold"
                />
              </div>
              {materiais.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-5">
                  {materiais.map((m) => {
                    const u = urls.get(m.path);
                    return (
                      <div key={m.id} className="text-xs">
                        <a href={u} target="_blank" className="block">
                          {m.mime.startsWith("image/") && u ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={u} alt={m.nome} className="w-full aspect-square object-cover rounded-lg bg-black" />
                          ) : (
                            <div className="w-full aspect-square rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] flex items-center justify-center text-white/40 p-2 text-center break-all">
                              {m.nome}
                            </div>
                          )}
                        </a>
                        <div className="flex items-center justify-between gap-1 mt-1">
                          <span className="text-white/40 truncate">
                            {TIPOS_MATERIAL[m.tipo]} · {tamanho(m.tamanho)}
                          </span>
                          <form action={removerMaterialAction}>
                            <input type="hidden" name="token" value={c.token} />
                            <input type="hidden" name="material" value={m.id} />
                            <button className="text-white/30 hover:text-red-400">apagar</button>
                          </form>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {aberto && (
            <section className="bg-[#111] border border-[#222] rounded-2xl p-6">
              <h2 className="text-white font-bold">Arquivos grandes</h2>
              <p className="text-white/50 text-sm mt-1">
                Vídeo bruto, gravação de tela, pacote de fotos: pode mandar vários GB por arquivo. Se a conexão cair ou a página
                fechar, escolha o mesmo arquivo de novo neste navegador que o envio continua de onde parou.
              </p>
              <div className="mt-4">
                <EnvioGrande
                  acoes={{
                    iniciar: iniciarArquivoAction.bind(null, c.token),
                    retomar: retomarArquivoAction.bind(null, c.token),
                    urls: urlsArquivoAction.bind(null, c.token),
                    concluir: concluirArquivoAction.bind(null, c.token),
                    cancelar: cancelarArquivoAction.bind(null, c.token),
                  }}
                  escopo={`apresentador:${c.id}`}
                  inputCls="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30"
                  buttonCls="btn-primary px-5 py-2.5 rounded-lg text-sm font-bold"
                />
              </div>
              {grandes.length > 0 && (
                <ul className="mt-5 divide-y divide-[#1f1f1f] text-sm">
                  {grandes.map((a) => (
                    <li key={a.id} className="py-2 flex justify-between gap-3">
                      <span className="text-white/80 truncate">{a.nome}</span>
                      <span className="text-white/40 whitespace-nowrap">
                        {tamanhoLegivel(a.tamanho)} · {dataHora(a.concluido_em ?? a.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {grandes.length > 0 && <p className="text-white/30 text-xs mt-2">Mandou algo errado? Avise a produção que ela tira.</p>}
            </section>
          )}

          {aberto && (
            <section>
              <h2 className="text-white font-bold text-xl">Seus dados</h2>
              <ProducaoForm
                action={salvarDadosAction}
                label="Salvar"
                pending="Salvando..."
                okMessage="Salvo."
                className="space-y-6 mt-4"
                buttonClassName="btn-primary w-full py-4 rounded-xl text-base font-bold"
              >
                <input type="hidden" name="token" value={c.token} />
                <CadastroFields c={c} quadrosTravados={c.status === "aprovado"} />
              </ProducaoForm>
            </section>
          )}

          <section className="bg-[#111] border border-[#222] rounded-2xl p-6 space-y-4">
            <h2 className="text-white font-bold">Termo de uso de imagem</h2>
            <p className="text-white/60 text-sm">
              Aceito por <strong className="text-white">{c.termo_nome}</strong> em {dataHora(c.termo_aceito_em)}.
            </p>
            <details>
              <summary className="cursor-pointer list-none text-gold-400 text-sm font-semibold">Ver o termo</summary>
              <div className="mt-3">
                <TermoImagem versao={c.termo_versao} alto={false} />
              </div>
            </details>
            {c.termo_revogado_em ? (
              <p className="text-red-300 text-sm">
                Você pediu em {dataHora(c.termo_revogado_em)} para sua imagem não entrar em conteúdos novos. Para voltar,
                fale com a produção.
              </p>
            ) : (
              <details>
                <summary className="cursor-pointer list-none text-white/40 hover:text-white/70 text-xs">
                  Não quero mais que minha imagem seja usada em conteúdos novos
                </summary>
                <form action={revogarTermoAction} className="mt-3 space-y-2">
                  <input type="hidden" name="token" value={c.token} />
                  <p className="text-white/50 text-xs">
                    Você sai das artes e gravações novas. O que já foi publicado pode continuar no ar (cláusula 3).
                  </p>
                  <button className="text-xs border border-red-500/40 text-red-300 hover:bg-red-500/10 rounded-lg px-3 py-1.5">
                    Confirmar pedido
                  </button>
                </form>
              </details>
            )}
          </section>

          <p className="text-white/40 text-sm">
            Dúvida ou problema no envio?{" "}
            <a href={whatsapp(`Oi! Sou ${c.nome}, apresentador do Fora da Caixa.`)} target="_blank" className="text-gold-400 hover:underline">
              Fale com a produção no WhatsApp
            </a>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}

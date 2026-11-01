import AdminHeader from "@/components/admin/AdminHeader";
import ProducaoForm from "@/components/admin/ProducaoForm";
import { requireAdmin } from "@/lib/auth";
import { IMAGE_MODEL, isGeminiConfigured } from "@/lib/producao/gemini";
import { DEFAULT_PLATE_PROMPT } from "@/lib/producao/prompt";
import { QUADROS, QUADRO_IDS, quadroLogoPath } from "@/lib/producao/quadros";
import { LOGO_PATH, getConfig, signedUrls } from "@/lib/producao/store";
import { connectedChannel, isYouTubeOAuthConfigured } from "@/lib/producao/youtube-api";
import { disconnectAction, savePromptAction, uploadLogoAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ProducaoConfigPage({
  searchParams,
}: {
  searchParams: { ok?: string; erro?: string };
}) {
  await requireAdmin();
  const [channel, prompt, logo] = await Promise.all([
    connectedChannel(),
    getConfig("plate_prompt"),
    signedUrls([LOGO_PATH]).then((m) => m.get(LOGO_PATH) ?? null),
  ]);
  // Só os que existem voltam assinados: sem URL = quadro sem logo próprio.
  const quadroLogos = await signedUrls(QUADRO_IDS.map(quadroLogoPath)).catch(() => new Map<string, string>());

  const card = "bg-[#111] border border-[#222] rounded-2xl p-6";

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <a href="/admin/producao" className="text-white/40 hover:text-white text-sm">← Produção</a>
          <h1 className="text-2xl font-bold text-white mt-2">Configurar produção</h1>
        </div>

        {searchParams.ok && (
          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-sm">
            Canal conectado: {searchParams.ok}
          </div>
        )}
        {searchParams.erro && (
          <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
            {searchParams.erro}
          </div>
        )}

        <section className={card}>
          <h2 className="text-white font-bold">1. Canal do YouTube</h2>
          <p className="text-white/40 text-sm mt-1">
            Conecte com a conta Google dona do canal. O hub passa a ler os vídeos privados, a legenda automática,
            trocar a thumb e agendar a publicação.
          </p>
          {!isYouTubeOAuthConfigured() ? (
            <p className="text-yellow-300 text-sm mt-4">
              Faltam GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET na Vercel.
            </p>
          ) : channel ? (
            <div className="flex items-center justify-between gap-3 mt-4">
              <span className="text-emerald-400 text-sm font-semibold">✓ {channel.title}</span>
              <form action={disconnectAction}>
                <button className="text-xs text-white/50 hover:text-red-400">Desconectar</button>
              </form>
            </div>
          ) : (
            <a href="/api/producao/oauth" className="btn-primary inline-block mt-4 px-4 py-2 rounded-lg text-sm font-bold">
              Conectar canal
            </a>
          )}
        </section>

        <section className={card}>
          <h2 className="text-white font-bold">2. Logo oficial do PFC</h2>
          <p className="text-white/40 text-sm mt-1">
            Vai como está, no canto da thumb. Use o PNG com <strong>fundo transparente e letras brancas</strong>: com
            fundo branco, o sistema tira o branco e clareia as letras sozinho, mas o resultado é melhor com o arquivo certo.
          </p>
          <div className="flex flex-wrap items-center gap-5 mt-4">
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="Logo atual" className="h-16 w-auto bg-[#0a0a0a] rounded-lg p-2 border border-[#222]" />
            )}
            <ProducaoForm
              action={uploadLogoAction}
              label={logo ? "Trocar logo" : "Enviar logo"}
              pending="Enviando..."
              okMessage="Logo salvo."
              className="flex flex-wrap items-start gap-2"
            >
              <input type="file" name="logo" accept="image/png,image/svg+xml,image/webp" className="text-xs text-white/60" />
            </ProducaoForm>
          </div>
        </section>

        <section className={card}>
          <h2 className="text-white font-bold">Identidade dos quadros</h2>
          <p className="text-white/40 text-sm mt-1">
            A thumb de cada corte usa a cor, a luz do fundo e o selo do quadro de origem. O logo próprio é opcional:
            sem ele, entra o logo do PFC. Mesmas regras de arquivo do logo acima.
          </p>
          <div className="mt-4 space-y-3">
            {QUADRO_IDS.map((q) => {
              const t = QUADROS[q];
              const url = quadroLogos.get(quadroLogoPath(q));
              return (
                <div key={q} className="flex flex-wrap items-center gap-4 border-t border-[#1c1c1c] pt-3">
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-md"
                    style={{
                      color: t.selo.text,
                      background: t.selo.bg2 ? `linear-gradient(90deg, ${t.selo.bg} 50%, ${t.selo.bg2} 50%)` : t.selo.bg,
                    }}
                  >
                    {t.name.toUpperCase()}
                  </span>
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="" className="h-10 w-auto bg-[#0a0a0a] rounded p-1 border border-[#222]" />
                  ) : (
                    <span className="text-white/30 text-xs">usa o logo do PFC</span>
                  )}
                  <ProducaoForm
                    action={uploadLogoAction}
                    label={url ? "Trocar" : "Enviar logo"}
                    pending="Enviando..."
                    okMessage="Logo salvo."
                    className="flex flex-wrap items-start gap-2"
                    buttonClassName="text-xs border border-[#2a2a2a] hover:border-gold-500/50 text-white/70 hover:text-white rounded-lg px-2.5 py-1"
                  >
                    <input type="hidden" name="quadro" value={q} />
                    <input type="file" name="logo" accept="image/png,image/svg+xml,image/webp" className="text-xs text-white/60" />
                  </ProducaoForm>
                </div>
              );
            })}
          </div>
        </section>

        <section className={card}>
          <h2 className="text-white font-bold">3. Prompt do fundo</h2>
          <p className="text-white/40 text-sm mt-1">
            Modelo: <code className="text-gold-400">{IMAGE_MODEL}</code>
            {!isGeminiConfigured() && <span className="text-yellow-300"> — GOOGLE_AI_API_KEY ausente</span>}. O Gemini
            gera só o estúdio vazio: as pessoas reais (recortadas do frame), a headline e o logo entram por cima. Não
            peça pessoas nem texto aqui. Apague tudo e salve para voltar ao padrão.
          </p>
          <ProducaoForm action={savePromptAction} label="Salvar prompt" pending="Salvando..." okMessage="Prompt salvo." className="mt-4">
            <textarea
              name="prompt"
              defaultValue={prompt ?? DEFAULT_PLATE_PROMPT}
              rows={9}
              className="w-full mb-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-gold-500/50"
            />
          </ProducaoForm>
        </section>
      </div>
    </div>
  );
}

import AdminHeader from "@/components/admin/AdminHeader";
import { EspacoHeader, selo } from "@/components/admin/Espaco";
import { requireAcesso } from "@/lib/auth";
import { minhaArea } from "@/lib/apresentadores/minha-area";

export const dynamic = "force-dynamic";

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const STATUS: Record<string, string> = {
  solicitado: "A confirmar",
  confirmado: "Confirmado",
  realizado: "Gravado",
};

/**
 * Área do apresentador com login (papel Apresentador). Mostra os próprios
 * episódios e leva ao link pessoal, onde ficam os materiais e o termo.
 */
export default async function MeusQuadrosPage() {
  const role = await requireAcesso("meus_quadros.ver");
  const cadastroId = role.kind === "equipe" ? role.apresentadorId : null;
  const area = cadastroId ? await minhaArea(cadastroId) : null;
  const agora = Date.now();

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        <EspacoHeader area="Meus quadros" titulo={area ? `Olá, ${area.nome.split(" ")[0]}` : "Meus quadros"} />

        {!area ? (
          <p className="text-white/50 text-sm mt-5">
            Seu login ainda não está ligado a um cadastro de apresentador. Peça para a produção fazer o vínculo em Equipe e
            acessos.
          </p>
        ) : (
          <>
            <section className="bg-[#111] border border-[#1f1f1f] rounded-xl p-4 mt-5 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium">Fotos, vídeos e termo de imagem</p>
                <p className="text-white/45 text-xs mt-0.5">
                  {area.termoAceito ? "Termo aceito." : "Termo de imagem pendente."} Seus envios ficam na sua página pessoal.
                </p>
              </div>
              <a href={`/apresentador/${area.token}`} className="btn-primary px-4 py-2 rounded-lg text-sm font-bold">
                Abrir minha página
              </a>
            </section>

            {area.quadros.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {area.quadros.map((q) => (
                  <span key={q} className={`${selo} bg-gold-500/10 border-gold-500/30 text-gold-400`}>
                    {q}
                  </span>
                ))}
              </div>
            )}

            <section className="mt-6">
              <h2 className="text-white font-semibold mb-3">Próximos episódios</h2>
              {area.episodios.length === 0 ? (
                <p className="text-white/40 text-sm">Nada marcado nos próximos 60 dias.</p>
              ) : (
                <ul className="space-y-2">
                  {area.episodios.map((e) => {
                    const passou = new Date(e.inicio).getTime() < agora;
                    return (
                      <li key={e.id} className={`bg-[#111] border border-[#1f1f1f] rounded-xl p-3 ${passou ? "opacity-60" : ""}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-white text-sm font-medium capitalize">{quando(e.inicio)}</span>
                          <span className="text-white/45 text-sm">· {e.quadroNome}</span>
                          <span className={`${selo} bg-white/5 border-white/10 text-white/60 ml-auto`}>{STATUS[e.status] ?? e.status}</span>
                        </div>
                        {e.tema && <p className="text-white/70 text-sm mt-1">{e.tema}</p>}
                        {e.convidados.length > 0 && (
                          <p className="text-white/45 text-xs mt-1">Convidados: {e.convidados.join(", ")}</p>
                        )}
                        {e.espelhoToken && !passou && (
                          <a href={`/espelho/${e.espelhoToken}`} target="_blank" className="inline-block text-xs text-gold-400 hover:text-gold-300 mt-2">
                            Abrir espelho do episódio
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

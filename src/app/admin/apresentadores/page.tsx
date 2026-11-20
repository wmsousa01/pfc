import AdminHeader from "@/components/admin/AdminHeader";
import { EspacoHeader } from "@/components/admin/Espaco";
import ProducaoForm from "@/components/admin/ProducaoForm";
import { requireAdmin } from "@/lib/auth";
import { db, type Apresentador } from "@/lib/agenda/store";
import { TIPOS_MATERIAL, listCadastros, materiaisDoCadastro, type Cadastro, type CadastroStatus } from "@/lib/apresentadores/store";
import { site } from "@/lib/config";
import { QUADROS, QUADRO_IDS, isQuadroId } from "@/lib/producao/quadros";
import { signedUrls } from "@/lib/producao/store";
import { aprovarAction, arquivarAction, fotoPadraoAction, reabrirAction, removerMaterialAdminAction } from "./actions";

export const dynamic = "force-dynamic";

const card = "bg-[#111] border border-[#222] rounded-2xl p-5";
const btn2 = "text-xs border border-[#2a2a2a] hover:border-gold-500/50 text-white/70 hover:text-white rounded-lg px-3 py-1.5";
const input = "bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-xs text-white";

const ABAS: { key: CadastroStatus; label: string }[] = [
  { key: "pendente", label: "Para aprovar" },
  { key: "aprovado", label: "Aprovados" },
  { key: "arquivado", label: "Arquivados" },
];

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

const nomeQuadro = (q: string) => (isQuadroId(q) ? QUADROS[q].name : q);

export default async function ApresentadoresPage({ searchParams }: { searchParams: { aba?: string } }) {
  await requireAdmin();
  const aba = (ABAS.find((a) => a.key === searchParams.aba)?.key ?? "pendente") as CadastroStatus;
  const todos = await listCadastros();
  const lista = todos.filter((c) => c.status === aba);
  const materiais = await materiaisDoCadastro(lista.map((c) => c.id));
  const { data: hostRows } = lista.length
    ? await db().from("agenda_apresentadores").select("*").in("cadastro_id", lista.map((c) => c.id))
    : { data: [] };
  const hosts = (hostRows ?? []) as Apresentador[];
  const urls = await signedUrls([...materiais.map((m) => m.path), ...hosts.map((h) => h.foto_path).filter((p): p is string => !!p)]);
  const linkCadastro = `${site.url}/apresentador`;
  const convite = `Oi! Para entrar como apresentador do Fora da Caixa, faça seu cadastro e mande suas fotos por aqui: ${linkCadastro}`;

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        <EspacoHeader
          area="Apresentadores"
          titulo="Apresentadores"
          acoes={
            <>
              <a href="/apresentador" target="_blank" className={btn2}>Abrir cadastro</a>
              <a href={`https://wa.me/?text=${encodeURIComponent(convite)}`} target="_blank" className={btn2}>Convidar pelo WhatsApp</a>
            </>
          }
          abas={ABAS.map((a) => ({
            href: `/admin/apresentadores?aba=${a.key}`,
            label: a.label,
            ativa: a.key === aba,
            count: todos.filter((c) => c.status === a.key).length,
          }))}
        />
        <p className="text-white/40 text-xs mt-3">
          Link de cadastro: <span className="text-white/70 select-all">{linkCadastro}</span>. A aprovação liga o apresentador aos quadros
          (o mesmo cadastro de <a href="/admin/agenda/config" className="text-gold-400 hover:underline">Agenda › Configurar</a>), e a foto
          escolhida vira a foto padrão das artes.
        </p>

        <div className="space-y-4 mt-6">
          {lista.length === 0 && <p className="text-white/40 text-sm">Nenhum cadastro aqui.</p>}
          {lista.map((c) => (
            <CadastroCard
              key={c.id}
              c={c}
              materiais={materiais.filter((m) => m.cadastro_id === c.id)}
              hosts={hosts.filter((h) => h.cadastro_id === c.id)}
              urls={urls}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CadastroCard({
  c,
  materiais,
  hosts,
  urls,
}: {
  c: Cadastro;
  materiais: Awaited<ReturnType<typeof materiaisDoCadastro>>;
  hosts: Apresentador[];
  urls: Map<string, string>;
}) {
  const fotos = materiais.filter((m) => m.mime.startsWith("image/"));
  const link = `${site.url}/apresentador/${c.token}`;
  const fotoAtual = hosts.find((h) => h.foto_path)?.foto_path;
  return (
    <div className={card} id={`c-${c.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {fotoAtual && urls.get(fotoAtual) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urls.get(fotoAtual)} alt="" className="w-12 h-12 rounded-full object-cover bg-black" />
          )}
          <div className="min-w-0">
            <p className="text-white font-bold">
              {c.nome} {c.papel && <span className="text-white/40 font-normal text-xs">· {c.papel}</span>}
            </p>
            <p className="text-white/50 text-xs mt-0.5 break-all">
              <a href={`https://wa.me/${c.whatsapp}`} target="_blank" className="hover:text-white">{c.whatsapp}</a> · {c.email}
              {c.instagram && (
                <>
                  {" · "}
                  <a href={`https://instagram.com/${c.instagram}`} target="_blank" className="hover:text-white">@{c.instagram}</a>
                </>
              )}
            </p>
            <p className="text-white/50 text-xs mt-0.5">
              Quadros: {c.quadros.map(nomeQuadro).join(", ") || "—"}
              {hosts.length > 0 && (
                <span className="text-emerald-400/80"> · na grade: {hosts.filter((h) => h.ativo).map((h) => nomeQuadro(h.quadro)).join(", ") || "inativo"}</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={link} target="_blank" className={btn2}>Abrir link pessoal</a>
          <a
            href={`https://wa.me/${c.whatsapp}?text=${encodeURIComponent(`Oi, ${c.nome.split(" ")[0]}! Seu link para mandar fotos e materiais do Fora da Caixa: ${link}`)}`}
            target="_blank"
            className={btn2}
          >
            Mandar link
          </a>
          {c.status === "arquivado" ? (
            <form action={reabrirAction}>
              <input type="hidden" name="cadastro" value={c.id} />
              <button className={btn2}>Reabrir</button>
            </form>
          ) : (
            <form action={arquivarAction}>
              <input type="hidden" name="cadastro" value={c.id} />
              <button className={`${btn2} hover:!border-red-500/50 hover:!text-red-300`}>Arquivar</button>
            </form>
          )}
        </div>
      </div>

      {c.bio && <p className="text-white/60 text-sm mt-3 whitespace-pre-line">{c.bio}</p>}

      <p className={`text-xs mt-3 ${c.termo_revogado_em ? "text-red-300" : "text-white/40"}`}>
        Termo de imagem ({c.termo_versao}) aceito por {c.termo_nome} em {dataHora(c.termo_aceito_em)}
        {c.termo_ip && ` · IP ${c.termo_ip}`}
        {c.termo_revogado_em && ` · REVOGADO em ${dataHora(c.termo_revogado_em)}: não usar em conteúdos novos`}
      </p>

      {materiais.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-4">
          {materiais.map((m) => {
            const u = urls.get(m.path);
            return (
              <div key={m.id} className="text-[11px]">
                <a href={u} target="_blank" download={m.nome} className="block">
                  {m.mime.startsWith("image/") && u ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u} alt={m.nome} className="w-full aspect-square object-cover rounded-lg bg-black" />
                  ) : (
                    <div className="w-full aspect-square rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] flex items-center justify-center text-white/40 p-1 text-center break-all">
                      {m.nome}
                    </div>
                  )}
                </a>
                <div className="flex items-center justify-between gap-1 mt-1">
                  <span className="text-white/40 truncate">{TIPOS_MATERIAL[m.tipo]}</span>
                  <form action={removerMaterialAdminAction}>
                    <input type="hidden" name="cadastro" value={c.id} />
                    <input type="hidden" name="material" value={m.id} />
                    <button className="text-white/25 hover:text-red-400">apagar</button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {c.status !== "arquivado" && !c.termo_revogado_em && (
        <div className="mt-4 pt-4 border-t border-[#1f1f1f] grid sm:grid-cols-2 gap-4">
          <ProducaoForm
            action={aprovarAction}
            label={c.status === "aprovado" ? "Salvar quadros" : "Aprovar"}
            pending="Salvando..."
            okMessage="Salvo."
            className="space-y-2"
            buttonClassName="btn-primary px-4 py-2 rounded-lg text-xs font-bold"
          >
            <input type="hidden" name="cadastro" value={c.id} />
            <p className="text-white/60 text-xs font-semibold">Quadros que apresenta</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {QUADRO_IDS.map((q) => (
                <label key={q} className="flex items-center gap-1.5 text-xs text-white/70">
                  <input type="checkbox" name="quadro" value={q} defaultChecked={c.quadros.includes(q)} className="accent-gold-500" />
                  {QUADROS[q].name}
                </label>
              ))}
            </div>
            {c.status === "pendente" && fotos.length > 0 && (
              <select name="foto" defaultValue={fotos[0].id} className={input}>
                <option value="">Sem foto padrão por enquanto</option>
                {fotos.map((m) => (
                  <option key={m.id} value={m.id}>Foto padrão: {m.nome}</option>
                ))}
              </select>
            )}
          </ProducaoForm>

          {c.status === "aprovado" && fotos.length > 0 && (
            <ProducaoForm
              action={fotoPadraoAction}
              label="Trocar foto padrão"
              pending="Trocando..."
              okMessage="Foto trocada nas próximas artes."
              className="space-y-2"
              buttonClassName={btn2}
            >
              <input type="hidden" name="cadastro" value={c.id} />
              <p className="text-white/60 text-xs font-semibold">Foto que entra nas artes</p>
              <select name="material" className={`${input} w-full`}>
                {fotos.map((m) => (
                  <option key={m.id} value={m.id}>{m.nome}</option>
                ))}
              </select>
            </ProducaoForm>
          )}
        </div>
      )}
    </div>
  );
}

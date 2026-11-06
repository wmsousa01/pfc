import type { Contadores } from "@/components/admin/nav";
import { db } from "@/lib/producao/store";

/** Conta linhas sem trazê-las; tabela ausente ou banco fora do ar contam zero. */
async function contar(consulta: () => PromiseLike<{ count: number | null }>): Promise<number> {
  try {
    return (await consulta()).count ?? 0;
  } catch {
    return 0;
  }
}

const head = (tabela: string) => db().from(tabela).select("id", { count: "exact", head: true });

/**
 * O que pede ação em cada área, para os números do menu: pedidos de convidado,
 * thumbs para revisar, cortes com erro, lives sem cortes e posts com erro.
 */
export async function contadoresDoMenu(): Promise<Contadores> {
  const [pedidos, revisar, cortesErro, livesSemCorte, postsErro] = await Promise.all([
    contar(() => head("agenda_episodios").eq("status", "solicitado")),
    contar(() => head("producao_videos").eq("status", "revisar")),
    contar(() => head("producao_videos").eq("status", "erro")),
    contar(() => head("producao_lives").in("status", ["detectada", "erro"])),
    contar(() => head("social_posts").eq("status", "erro")),
  ]);
  const producao = revisar + cortesErro + livesSemCorte;
  return {
    pendencias: { n: pedidos + producao + postsErro, alerta: cortesErro + postsErro > 0 },
    agenda: { n: pedidos },
    producao: { n: producao, alerta: cortesErro > 0 },
    marketing: { n: postsErro, alerta: postsErro > 0 },
  };
}

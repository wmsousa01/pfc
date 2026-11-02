import "server-only";
import { googleMetricasAnuncios } from "./google-ads";
import { metaMetricasAnuncios } from "./meta-ads";
import { listEntregas, updateEntrega, type Metricas } from "./store";

/**
 * Puxa das duas redes as métricas de cada entrega que já tem anúncio e grava
 * na entrega. Uma rede fora do ar não impede a outra: o erro fica registrado
 * na métrica e aparece no cartão.
 */
export async function sincronizarMetricas(): Promise<{ meta: number; google: number; erros: string[] }> {
  const entregas = await listEntregas();
  const erros: string[] = [];
  const now = new Date().toISOString();

  async function rede(
    nome: string,
    ids: string[],
    ler: (ids: string[]) => Promise<Map<string, Metricas>>,
    idDe: (e: (typeof entregas)[number]) => string | null
  ): Promise<number> {
    if (ids.length === 0) return 0;
    let mapa: Map<string, Metricas>;
    try {
      mapa = await ler(ids);
    } catch (e) {
      erros.push(`${nome}: ${e instanceof Error ? e.message : String(e)}`);
      return 0;
    }
    let n = 0;
    for (const en of entregas) {
      const id = idDe(en);
      if (!id) continue;
      // Anúncio sem entrega no período volta ausente: zero, não erro.
      await updateEntrega(en.id, { metrics: mapa.get(id) ?? { gasto: 0, impressoes: 0 }, metrics_at: now });
      n++;
    }
    return n;
  }

  const metaIds = entregas.map((e) => e.meta_ad_id).filter((x): x is string => !!x);
  const googleIds = entregas.map((e) => e.google_ad_id).filter((x): x is string => !!x);
  const meta = await rede("Meta", metaIds, metaMetricasAnuncios, (e) => e.meta_ad_id);
  const google = await rede("Google", googleIds, googleMetricasAnuncios, (e) => e.google_ad_id?.replace(/\D/g, "") || null);
  return { meta, google, erros };
}

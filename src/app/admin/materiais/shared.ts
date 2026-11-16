import { CATEGORIAS, type Material } from "@/lib/materiais/tipos";
import { QUADROS, isQuadroId } from "@/lib/producao/quadros";

/** De onde é o material, numa linha: "Fora da Caixa · Fulano", "Anúncios · Cliente X". */
export function origemDo(m: Material): string {
  const quadro = m.quadro && isQuadroId(m.quadro) ? QUADROS[m.quadro].name : null;
  if (m.categoria === "quadro") return [quadro, m.referencia].filter(Boolean).join(" · ") || "Quadros";
  return [CATEGORIAS[m.categoria].label, m.referencia].filter(Boolean).join(" · ");
}

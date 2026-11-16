import { quadroLogo } from "@/lib/config";

/**
 * Logo de quadro padronizado para todas as páginas: selo quadrado de cantos
 * arredondados (a rota já recorta e centraliza), lido de /admin/producao/config. O tamanho vem no className.
 */
export default function QuadroLogo({
  quadro,
  nome,
  className = "w-10 h-10",
}: {
  /** Slug do site ou id do quadro na produção. */
  quadro: string;
  nome?: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a rota já entrega a imagem otimizada e em cache
    <img
      src={quadroLogo(quadro)}
      alt={nome ? `Logo ${nome}` : ""}
      loading="lazy"
      decoding="async"
      className={`rounded-xl object-cover ring-1 ring-white/10 flex-shrink-0 ${className}`}
    />
  );
}

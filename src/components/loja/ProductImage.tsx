import Image from "next/image";

/**
 * As imagens de produto podem vir do repositório (/produtos/...), do Storage
 * do Supabase ou de uma URL qualquer colada no admin. next/image só aceita as
 * duas primeiras (ver remotePatterns em next.config.js); o resto cai em <img>.
 */
function isOptimizable(src: string): boolean {
  return src.startsWith("/") || /supabase\.co/.test(src);
}

export default function ProductImage({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  if (!isOptimizable(src)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={`absolute inset-0 w-full h-full object-cover ${className}`} />;
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 768px) 100vw, 50vw"
      className={`object-cover ${className}`}
    />
  );
}

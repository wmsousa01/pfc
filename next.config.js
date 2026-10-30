/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Uploads de logo/capa passam pela server action.
    serverActions: { bodySizeLimit: "6mb" },
    // Recorte das pessoas (MODNet) roda num binário nativo: fica fora do bundle.
    serverComponentsExternalPackages: ["onnxruntime-node"],
    // A headline é vetorizada da fonte Anton lida em runtime.
    outputFileTracingIncludes: {
      "/admin/producao": ["./assets/fonts/**"],
      "/api/cron/producao": ["./assets/fonts/**"],
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "*.ytimg.com" },
      { protocol: "https", hostname: "yt3.googleusercontent.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
    // Logos de parceiros (curados pelo admin) podem ser SVG.
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

module.exports = nextConfig;

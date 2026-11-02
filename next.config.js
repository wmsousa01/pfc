/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Uploads de logo/capa passam pela server action.
    serverActions: { bodySizeLimit: "6mb" },
    // Recorte das pessoas (MODNet) roda num binário nativo: fica fora do bundle.
    // O ffmpeg-static também: o binário dele é lido do node_modules em runtime.
    serverComponentsExternalPackages: ["onnxruntime-node", "ffmpeg-static"],
    // A headline é vetorizada da fonte Anton lida em runtime.
    outputFileTracingIncludes: {
      "/admin/producao": ["./assets/fonts/**"],
      "/api/cron/producao": ["./assets/fonts/**"],
      "/admin/agenda/[id]": ["./assets/fonts/**", "./node_modules/ffmpeg-static/ffmpeg*"],
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

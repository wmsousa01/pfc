import AdminHeader from "@/components/admin/AdminHeader";
import { EspacoHeader } from "@/components/admin/Espaco";
import EditorFotos, { type QuadroFoto } from "@/components/admin/fotos/EditorFotos";
import EditorPosts from "@/components/admin/fotos/EditorPosts";
import { requireAdmin } from "@/lib/auth";
import { AVULSA, chavePreset, limparPreset, type Preset } from "@/lib/fotos/preset";
import { db } from "@/lib/producao/store";
import { QUADROS, QUADRO_IDS } from "@/lib/producao/quadros";

export const dynamic = "force-dynamic";

async function carregarPresets(): Promise<Record<string, Preset>> {
  const { data } = await db().from("producao_config").select("key,value").like("key", chavePreset("%"));
  const presets: Record<string, Preset> = {};
  for (const linha of data ?? []) {
    try {
      presets[String(linha.key).slice(chavePreset("").length)] = limparPreset(JSON.parse(linha.value));
    } catch {
      // Valor quebrado: o quadro volta para o padrão.
    }
  }
  return presets;
}

export default async function FotosPage({ searchParams }: { searchParams: { aba?: string } }) {
  await requireAdmin();
  const aba = searchParams.aba === "posts" ? "posts" : "fotos";
  const quadros: QuadroFoto[] = [
    ...QUADRO_IDS.map((id) => ({ id, nome: QUADROS[id].name, cor: QUADROS[id].accent[1] })),
    { id: AVULSA, nome: "Outras fotos", cor: "#9ca3af" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        <EspacoHeader
          area="Fotos"
          titulo={aba === "posts" ? "Criar posts" : "Correção de fotos"}
          abas={[
            { href: "/admin/fotos", label: "Corrigir fotos", ativa: aba === "fotos" },
            { href: "/admin/fotos?aba=posts", label: "Criar posts", ativa: aba === "posts" },
          ]}
        />
        {aba === "posts" ? <EditorPosts quadros={quadros} /> : <EditorFotos quadros={quadros} presets={await carregarPresets()} />}
      </div>
    </div>
  );
}

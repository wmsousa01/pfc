/**
 * Catálogo de permissões da equipe (sem server-only: a tela de papéis usa no cliente).
 *
 * Admin (app_admins) passa em tudo. O resto da equipe tem um ou mais papéis
 * (tabela papeis, editável em /admin/equipe) e o acesso é a soma das
 * permissões deles, mais as avulsas da pessoa.
 *
 * Formato: "<área>.<ação>". Quem tem "x.editar" também passa em "x.ver" — a
 * mesma regra vale no banco, em tem_permissao() (039_papeis_acesso.sql).
 */

export type Permissao = string;

export type AreaAcesso = {
  /** Prefixo das permissões ("agenda" → agenda.ver / agenda.editar). */
  key: string;
  label: string;
  grupo: "Conteúdo" | "Comercial" | "Pessoal";
  ver: string;
  /** Sem editar: a área só tem leitura (ex.: pendências). */
  editar?: string;
  /** Ações sensíveis que não vêm junto com o editar. */
  extras?: { key: Permissao; label: string; descricao: string }[];
};

export const AREAS_ACESSO: AreaAcesso[] = [
  { key: "pendencias", label: "Pendências", grupo: "Conteúdo", ver: "Resumo do que pede ação" },
  { key: "agenda", label: "Agenda", grupo: "Conteúdo", ver: "Ver convidados, episódios e espelho", editar: "Agendar, mudar episódio, arte e roteiro" },
  { key: "apresentadores", label: "Apresentadores", grupo: "Conteúdo", ver: "Ver cadastros e materiais", editar: "Aprovar cadastros e definir foto padrão" },
  {
    key: "materiais",
    label: "Materiais",
    grupo: "Conteúdo",
    ver: "Ver os próprios envios",
    editar: "Enviar materiais editados e novas versões",
    extras: [{ key: "materiais.aprovar", label: "Aprovar materiais", descricao: "Ver os envios de todos e aprovar ou pedir ajuste" }],
  },
  { key: "arquivos", label: "Arquivos", grupo: "Conteúdo", ver: "Ver e baixar arquivos", editar: "Enviar, organizar pastas e gerar links de envio" },
  { key: "producao", label: "Produção", grupo: "Conteúdo", ver: "Ver thumbs e cortes", editar: "Gerar thumbs e aprovar" },
  { key: "ao_vivo", label: "Ao vivo", grupo: "Conteúdo", ver: "Ver inserções e fila", editar: "Operar inserções e régie" },
  { key: "marketing", label: "Marketing", grupo: "Conteúdo", ver: "Ver fila e calendário de posts", editar: "Agendar, cancelar e publicar posts" },
  {
    key: "campanhas",
    label: "Campanhas",
    grupo: "Conteúdo",
    ver: "Ver estratégias e criativos",
    editar: "Criar estratégias, criativos e entregas",
    extras: [{ key: "campanhas.publicar", label: "Subir anúncio na Meta", descricao: "Envia o anúncio para a conta de anúncios (sobe pausado)" }],
  },
  { key: "fotos", label: "Fotos e posts", grupo: "Conteúdo", ver: "Ver fotos", editar: "Corrigir fotos, criar e publicar posts" },
  { key: "parceiros", label: "Parceiros", grupo: "Comercial", ver: "Ver parceiros, leads e cliques", editar: "Cadastrar e editar parceiros e páginas" },
  { key: "entregas", label: "Entregas", grupo: "Comercial", ver: "Ver entregas aos clientes", editar: "Registrar entregas e área do cliente" },
  { key: "pedidos", label: "Pedidos", grupo: "Comercial", ver: "Ver pedidos", editar: "Mudar status de pedidos" },
  { key: "revendedores", label: "Revendedores", grupo: "Comercial", ver: "Ver revendedores e indicações", editar: "Cadastrar revendedores e tratar indicações" },
  { key: "produtos", label: "Produtos", grupo: "Comercial", ver: "Ver catálogo", editar: "Editar produtos e preços" },
  { key: "meus_quadros", label: "Meus quadros", grupo: "Pessoal", ver: "Área do apresentador: os próprios episódios e o link de materiais" },
];

/**
 * Ligar contas da empresa (Meta, Google Ads, YouTube, Google Agenda) e mexer
 * na equipe continuam só de admin: quem conecta conta ou dá acesso controla
 * tudo o que vem depois.
 */
export const SO_ADMIN = "admin";

/** Todas as chaves válidas, para limpar o que vem do formulário. */
export const PERMISSOES_VALIDAS: Set<string> = new Set(
  AREAS_ACESSO.flatMap((a) => [
    `${a.key}.ver`,
    ...(a.editar ? [`${a.key}.editar`] : []),
    ...(a.extras ?? []).map((e) => e.key),
  ])
);

export function permissoesValidas(lista: string[]): string[] {
  return Array.from(new Set(lista.filter((p) => PERMISSOES_VALIDAS.has(p)))).sort();
}

/** Mesma regra de tem_permissao() no banco. */
export function permite(permissoes: Iterable<string>, p: Permissao): boolean {
  const s = permissoes instanceof Set ? (permissoes as Set<string>) : new Set(permissoes);
  if (s.has(p)) return true;
  return p.endsWith(".ver") && s.has(`${p.slice(0, -4)}.editar`);
}

/** Rótulo curto de uma permissão ("Agenda · editar"), para os selos da tela. */
export function rotuloPermissao(p: string): string {
  for (const a of AREAS_ACESSO) {
    if (p === `${a.key}.ver`) return `${a.label} · ver`;
    if (p === `${a.key}.editar`) return `${a.label} · editar`;
    const e = a.extras?.find((x) => x.key === p);
    if (e) return e.label;
  }
  return p;
}

/**
 * Resume uma lista para os selos: "editar" engole o "ver" da mesma área.
 */
export function resumoPermissoes(lista: string[]): string[] {
  const s = new Set(lista);
  return lista.filter((p) => !(p.endsWith(".ver") && s.has(`${p.slice(0, -4)}.editar`))).sort();
}

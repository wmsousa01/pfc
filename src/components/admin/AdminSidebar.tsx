"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/admin/actions";
import { ICONES, NAV, itemAtivo, type Contadores, type NavKey } from "./nav";

/** Guardado no navegador: o menu recolhido continua recolhido na próxima página. */
const CHAVE = "pfc-admin-menu";

function Icone({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d={d} />
    </svg>
  );
}

function Marca() {
  return (
    <span className="flex items-center gap-2.5 min-w-0">
      <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-gold-500 text-black shrink-0">
        <Icone d={ICONES.mic} size={16} />
      </span>
      <span className="admin-side-label flex flex-col leading-tight whitespace-nowrap">
        <span className="text-white font-bold text-sm">Fora da Caixa</span>
        <span className="text-white/50 text-[11px]">Admin</span>
      </span>
    </span>
  );
}

function Menu({
  contadores,
  ativo,
  filtro,
  grande,
  aoNavegar,
}: {
  contadores: Contadores;
  ativo: NavKey | null;
  filtro: string;
  grande?: boolean;
  aoNavegar?: () => void;
}) {
  const f = filtro.trim().toLowerCase();
  const altura = grande ? "h-12 text-[15px] gap-3" : "h-9 text-sm gap-2.5";
  return (
    <>
      {NAV.map((g) => {
        const itens = g.itens.filter((i) => !f || i.label.toLowerCase().includes(f));
        if (itens.length === 0) return null;
        return (
          <nav key={g.label} aria-label={g.label} className="flex flex-col gap-0.5 mb-2.5">
            <span className="admin-side-label text-[10px] font-bold tracking-[0.08em] uppercase text-white/45 px-2.5 pt-1.5 pb-1">
              {g.label}
            </span>
            {itens.map((i) => {
              const c = contadores[i.key];
              const on = ativo === i.key;
              return (
                <a
                  key={i.key}
                  href={i.href}
                  title={i.label}
                  onClick={aoNavegar}
                  aria-current={on ? "page" : undefined}
                  className={`admin-side-item relative flex items-center ${altura} px-2.5 rounded-lg transition-colors ${
                    on ? "bg-gold-500/10 text-gold-400 font-semibold" : "text-white/70 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icone d={i.icon} size={grande ? 20 : 18} />
                  <span className="admin-side-label flex-1 min-w-0 truncate">{i.label}</span>
                  {c && c.n > 0 && (
                    <span
                      className={`admin-side-count text-[10px] font-bold min-w-[18px] text-center px-1.5 py-px rounded-full ${
                        c.alerta ? "bg-red-500/25 text-red-200" : "bg-white/10 text-white/75"
                      }`}
                    >
                      {c.n > 99 ? "99+" : c.n}
                    </span>
                  )}
                </a>
              );
            })}
          </nav>
        );
      })}
    </>
  );
}

function Rodape({ grande }: { grande?: boolean }) {
  const cls = `admin-side-item flex items-center ${grande ? "h-12 text-[15px] gap-3" : "h-9 text-sm gap-2.5"} px-2.5 rounded-lg text-white/70 hover:text-white hover:bg-white/5 w-full`;
  return (
    <nav aria-label="Conta" className="flex flex-col gap-0.5 border-t border-[#1a1a1a] pt-2.5">
      <a href="/" target="_blank" title="Ver site" className={cls}>
        <Icone d={ICONES.site} size={grande ? 20 : 18} />
        <span className="admin-side-label">Ver site</span>
      </a>
      <a href="/admin/senha" title="Minha conta" className={cls}>
        <Icone d={ICONES.conta} size={grande ? 20 : 18} />
        <span className="admin-side-label">Minha conta</span>
      </a>
      <form action={signOut}>
        <button title="Sair" className={cls}>
          <Icone d={ICONES.sair} size={grande ? 20 : 18} />
          <span className="admin-side-label">Sair</span>
        </button>
      </form>
    </nav>
  );
}

export default function AdminSidebar({ contadores }: { contadores: Contadores }) {
  const pathname = usePathname();
  const ativo = itemAtivo(pathname);
  const [aberto, setAberto] = useState(false);
  const [filtro, setFiltro] = useState("");
  const busca = useRef<HTMLInputElement>(null);

  // Ctrl+K (ou Cmd+K) leva à busca do menu; Esc fecha a gaveta do celular.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (document.documentElement.dataset.adminSide === "mini") alternar();
        busca.current?.focus();
      }
      if (e.key === "Escape") setAberto(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = aberto ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [aberto]);

  function alternar() {
    const mini = document.documentElement.dataset.adminSide !== "mini";
    if (mini) document.documentElement.dataset.adminSide = "mini";
    else delete document.documentElement.dataset.adminSide;
    try {
      localStorage.setItem(CHAVE, mini ? "mini" : "");
    } catch {}
  }

  const irPrimeiro = (e: React.FormEvent) => {
    e.preventDefault();
    const f = filtro.trim().toLowerCase();
    const alvo = NAV.flatMap((g) => g.itens).find((i) => i.label.toLowerCase().includes(f));
    if (alvo) window.location.href = alvo.href;
  };

  const areaAtual = NAV.flatMap((g) => g.itens).find((i) => i.key === ativo)?.label;

  return (
    <>
      {/* Antes da primeira pintura: aplica o menu recolhido sem piscar. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `try{if(localStorage.getItem("${CHAVE}")==="mini")document.documentElement.dataset.adminSide="mini"}catch(e){}`,
        }}
      />

      {/* Desktop */}
      <aside
        id="admin-side"
        className="hidden lg:flex fixed inset-y-0 left-0 z-40 flex-col gap-1.5 bg-[#0d0d0d] border-r border-[#1a1a1a] px-2.5 py-3.5 overflow-y-auto overflow-x-hidden"
        style={{ width: "var(--admin-side-w)" }}
      >
        <div className="admin-side-top flex items-center justify-between gap-2 px-1 pb-2.5">
          <a href="/admin" aria-label="Início do admin">
            <Marca />
          </a>
          <button
            type="button"
            onClick={alternar}
            aria-label="Recolher ou expandir o menu"
            className="admin-side-toggle flex items-center justify-center w-8 h-8 rounded-lg border border-[#222] text-white/55 hover:text-white shrink-0"
          >
            <span className="admin-side-label">
              <Icone d={ICONES.recolher} size={16} />
            </span>
            <span className="admin-side-mini-only">
              <Icone d={ICONES.expandir} size={16} />
            </span>
          </button>
        </div>

        <form onSubmit={irPrimeiro} className="admin-side-label mb-2">
          <label className="flex items-center gap-2 h-9 px-2.5 rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] text-white/45 focus-within:border-gold-500/50">
            <Icone d={ICONES.busca} size={15} />
            <input
              ref={busca}
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Buscar no admin"
              aria-label="Buscar no admin"
              className="flex-1 min-w-0 bg-transparent text-white text-[13px] placeholder:text-white/40 outline-none"
            />
            <kbd className="text-[10px] text-white/40 border border-[#2a2a2a] rounded px-1.5 font-sans">Ctrl K</kbd>
          </label>
        </form>

        <Menu contadores={contadores} ativo={ativo} filtro={filtro} />
        <div className="flex-1" />
        <Rodape />
      </aside>

      {/* Celular e tablet: barra fixa no topo e menu em gaveta */}
      <header className="lg:hidden sticky top-0 z-40 h-14 flex items-center gap-1 px-1.5 bg-[#0d0d0d] border-b border-[#1a1a1a]">
        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-label="Abrir menu"
          aria-expanded={aberto}
          className="relative flex items-center justify-center w-11 h-11 rounded-lg text-white/80"
        >
          <Icone d={ICONES.menu} size={22} />
          {(contadores.pendencias?.n ?? 0) > 0 && (
            <span
              aria-hidden="true"
              className={`absolute top-2 right-2 w-2 h-2 rounded-full ${contadores.pendencias?.alerta ? "bg-red-400" : "bg-gold-500"}`}
            />
          )}
        </button>
        <a href="/admin" className="flex items-center gap-2 min-w-0">
          <span className="flex items-center justify-center w-7 h-7 rounded-md bg-gold-500 text-black shrink-0">
            <Icone d={ICONES.mic} size={14} />
          </span>
          <span className="text-white font-semibold text-[15px] truncate">{areaAtual ?? "Admin"}</span>
        </a>
      </header>

      {aberto && (
        <div className="lg:hidden fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setAberto(false)}
            className="absolute inset-0 bg-black/60"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Menu do admin"
            className="absolute inset-y-0 left-0 w-[304px] max-w-[85vw] flex flex-col gap-1 bg-[#0d0d0d] border-r border-[#1f1f1f] px-2.5 pt-2.5 pb-4 overflow-y-auto"
          >
            <div className="flex items-center justify-between pl-1.5 pb-2.5">
              <Marca />
              <button
                type="button"
                onClick={() => setAberto(false)}
                aria-label="Fechar menu"
                className="flex items-center justify-center w-11 h-11 rounded-lg text-white/70"
              >
                <Icone d={ICONES.fechar} size={20} />
              </button>
            </div>
            <Menu contadores={contadores} ativo={ativo} filtro="" grande aoNavegar={() => setAberto(false)} />
            <div className="flex-1" />
            <Rodape grande />
          </aside>
        </div>
      )}
    </>
  );
}

import { signOut } from "@/app/admin/actions";
import { MicIcon } from "@/components/icons";

const NAV = [
  { href: "/admin", label: "Parceiros" },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/revendedores", label: "Revendedores" },
  { href: "/admin/produtos", label: "Produtos" },
];

export default function AdminHeader() {
  return (
    <header className="border-b border-[#1a1a1a] bg-[#0d0d0d] sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <a href="/admin" className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center justify-center w-8 h-8 bg-gold-500 rounded-lg">
            <MicIcon className="w-4 h-4 text-black" />
          </div>
          <span className="text-white font-bold hidden sm:inline">
            Fora da Caixa <span className="text-white/40 font-normal">· Admin</span>
          </span>
        </a>

        <nav className="flex items-center gap-1 overflow-x-auto">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="text-white/50 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors whitespace-nowrap"
            >
              {n.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <a
            href="/"
            target="_blank"
            className="text-white/50 hover:text-white text-sm transition-colors hidden md:inline"
          >
            Ver site ↗
          </a>
          <form action={signOut}>
            <button className="text-white/50 hover:text-white text-sm border border-[#2a2a2a] rounded-lg px-3 py-1.5 hover:border-[#3a3a3a] transition-colors">
              Sair
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

"use client";

import { useState, useEffect } from "react";
import { MicIcon, YouTubeIcon } from "./icons";
import { social } from "@/lib/config";

const links = [
  { label: "Episódios", href: "/#episodios" },
  { label: "Quadros", href: "/#quadros" },
  { label: "Números", href: "/#numeros" },
  { label: "Loja", href: "/loja" },
  { label: "Parcerias", href: "/parcerias" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-black/90 backdrop-blur-md border-b border-[#222]"
          : "bg-transparent"
      }`}
    >
      <div className="container-px">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="/" className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 bg-gold-500 rounded-lg">
              <MicIcon className="w-5 h-5 text-black" />
            </div>
            <div>
              <span className="text-gold-500 font-black text-lg leading-none block">
                Fora da Caixa
              </span>
              <span className="hidden sm:block text-white/50 text-[11px] leading-none mt-0.5">
                Podcast · Mogi Guaçu · SP
              </span>
            </div>
          </a>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-7">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-white/70 hover:text-white text-sm font-medium transition-colors"
              >
                {l.label}
              </a>
            ))}
          </nav>

          {/* CTAs */}
          <div className="flex items-center gap-2">
            <a
              href={social.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex btn-primary px-4 py-2.5 rounded-lg text-sm items-center gap-2"
            >
              <YouTubeIcon className="w-4 h-4" />
              Assistir
            </a>

            {/* Mobile toggle */}
            <button
              onClick={() => setOpen((v) => !v)}
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg border border-[#2a2a2a] text-white"
              aria-label="Abrir menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={open ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-black/95 backdrop-blur-md border-b border-[#222]">
          <nav className="container-px py-4 flex flex-col gap-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="py-3 text-white/80 hover:text-gold-400 font-medium border-b border-[#1a1a1a] last:border-0"
              >
                {l.label}
              </a>
            ))}
            <a
              href={social.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary mt-3 px-4 py-3 rounded-lg text-sm flex items-center justify-center gap-2"
            >
              <YouTubeIcon className="w-4 h-4" />
              Assistir no YouTube
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}

/**
 * Ícones de linha para a página do parceiro. Traço fino e cantos suaves para
 * conversar com o vocabulário visual das peças de refrigeração/varejo.
 * `partnerIcons` é indexado pela chave salva em `content.perks[].icon`.
 */

type IconProps = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function SnowflakeIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 2v20M4.5 6.5l15 11M19.5 6.5l-15 11" />
      <path d="M12 6l2.2-2.2M12 6L9.8 3.8M12 18l2.2 2.2M12 18l-2.2 2.2" />
    </svg>
  );
}

export function FridgeIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M6 10h12M9 6.5v2M9 13v2.5" />
    </svg>
  );
}

export function BottleIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M10 2.5h4v3.2c0 1 .3 1.6 1 2.4.9 1 1.5 1.9 1.5 3.4v8a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-8c0-1.5.6-2.4 1.5-3.4.7-.8 1-1.4 1-2.4V2.5Z" />
      <path d="M7.5 14h9" />
    </svg>
  );
}

export function TruckIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M2.5 6.5h11v9h-11z" />
      <path d="M13.5 10h3.6l3.4 3v2.5h-7z" />
      <circle cx="7" cy="18" r="1.8" />
      <circle cx="17" cy="18" r="1.8" />
    </svg>
  );
}

export function WalletIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3Z" />
      <path d="M3 8h15" />
      <circle cx="16.5" cy="13.5" r="1.2" />
    </svg>
  );
}

export function HeadsetIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 13v-1a8 8 0 0 1 16 0v1" />
      <path d="M4 13h2.5a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1H5.5A1.5 1.5 0 0 1 4 17Z" />
      <path d="M20 13h-2.5a1 1 0 0 0-1 1v3.5a1 1 0 0 0 1 1H18a2 2 0 0 1-2 2h-2.5" />
    </svg>
  );
}

export function ShieldIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 2.5 20 5.5v6c0 5-3.4 8.5-8 10.5-4.6-2-8-5.5-8-10.5v-6Z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </svg>
  );
}

export function ChartIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3.5 20.5h17" />
      <path d="M6.5 20.5v-6M11 20.5V8M15.5 20.5v-9M20 20.5V4.5" />
    </svg>
  );
}

export function CalendarIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="m9.5 15 1.8 1.8 3.4-3.6" />
    </svg>
  );
}

export function PinIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 21.5s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
      <circle cx="12" cy="10.5" r="2.6" />
    </svg>
  );
}

export function ClockIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.2 2" />
    </svg>
  );
}

export function StarIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m12 3.5 2.7 5.5 6 .9-4.35 4.2 1.03 6-5.38-2.85L6.62 20.1l1.03-6L3.3 9.9l6-.9Z" />
    </svg>
  );
}

export function CheckIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  );
}

export function SparkIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.5l-1.8-5.9L4.5 10.8 10.2 9Z" />
      <path d="M18.5 3.5v3M20 5h-3" />
    </svg>
  );
}

export function WrenchIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M15.5 3.5a5 5 0 0 0-4.6 6.9L3.5 17.8a2 2 0 0 0 2.8 2.8l7.4-7.4a5 5 0 0 0 6.3-6.4l-3 3-2.6-2.6 3-3a5 5 0 0 0-2-.7Z" />
    </svg>
  );
}

export const partnerIcons: Record<
  string,
  (p: IconProps) => JSX.Element
> = {
  snowflake: SnowflakeIcon,
  fridge: FridgeIcon,
  bottle: BottleIcon,
  // Apelidos: o card de produto usa a mesma chave da triagem (`need`).
  freezer: SnowflakeIcon,
  geladeira: FridgeIcon,
  cervejeira: BottleIcon,
  truck: TruckIcon,
  wallet: WalletIcon,
  headset: HeadsetIcon,
  shield: ShieldIcon,
  chart: ChartIcon,
  calendar: CalendarIcon,
  pin: PinIcon,
  clock: ClockIcon,
  star: StarIcon,
  check: CheckIcon,
  spark: SparkIcon,
  wrench: WrenchIcon,
};

/** Ícone pela chave, com fallback para não quebrar conteúdo salvo errado. */
export function PartnerIcon({
  name,
  className,
}: {
  name?: string;
  className?: string;
}) {
  const Cmp = (name && partnerIcons[name]) || SparkIcon;
  return <Cmp className={className} />;
}

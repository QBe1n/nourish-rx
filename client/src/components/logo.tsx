export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`} data-testid="brand-logo">
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="NourishRx logo"
        className="shrink-0"
      >
        <rect width="32" height="32" rx="7" className="fill-primary" />
        {/* Sprig of leaves — two curved stems meeting at the base */}
        <path
          d="M10 9 C10 14, 14 14, 14 20 L14 24 M10 9 C10 14, 6 14, 6 20 M22 7 C22 12, 18 15, 18 20 L18 24 M22 7 C24 9, 26 12, 26 16"
          stroke="hsl(var(--primary-foreground))"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      <div className="flex items-baseline gap-0.5 leading-none">
        <span className="font-serif text-lg font-medium tracking-tight">Nourish</span>
        <span className="font-serif text-lg italic font-medium text-primary">Rx</span>
      </div>
    </div>
  );
}

import { Link } from 'wouter';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" data-testid="link-brand" className="group inline-flex items-center gap-3">
      <span className="flex h-7 w-7 items-center justify-center border border-primary/70 text-primary">
        <span className="h-2.5 w-2.5 border border-primary rotate-45 transition-transform group-hover:rotate-90" />
      </span>
      {!compact && <span className="mono text-[11px] font-semibold tracking-[0.22em] text-foreground">REPO CITY</span>}
    </Link>
  );
}
import { cn } from "../lib/utils";

interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

/** Logo oficial Centrus (versão otimizada de 96px) + wordmark PharmaLeads. */
export function Logo({ size = 36, showText = true, className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-3 select-none", className)}>
      <img
        src="/brand/centrus-logo-96.png"
        alt={showText ? "" : "PharmaLeads by Centrus AI"}
        width={size}
        height={size}
        decoding="async"
        className="rounded-full shrink-0 ring-1 ring-border"
        style={{ width: size, height: size }}
      />
      {showText && (
        <span className="flex flex-col leading-none">
          <span className="text-lg font-extrabold tracking-tight text-foreground">
            Pharma<span className="text-brand">Leads</span>
          </span>
          <span className="text-[11px] font-medium text-muted-foreground mt-1">by Centrus AI</span>
        </span>
      )}
    </div>
  );
}

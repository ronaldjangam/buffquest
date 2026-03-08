"use client";

type GeneratedAvatarProps = {
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const sizeClasses = {
  sm: "h-10 w-10 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-24 w-24 text-2xl",
};

function buildInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "BQ";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? "B"}${parts[1][0] ?? "Q"}`.toUpperCase();
}

function buildPalette(name: string) {
  const seed = [...name].reduce((total, char) => total + char.charCodeAt(0), 0);
  const baseHue = seed % 360;
  const accentHue = (baseHue + 44) % 360;

  return {
    background: `linear-gradient(145deg, hsl(${baseHue} 78% 58%), hsl(${accentHue} 78% 48%))`,
    shadow: `0 10px 24px hsla(${baseHue} 85% 45% / 0.32)`,
    sparkle: `hsla(${accentHue} 95% 88% / 0.55)`,
  };
}

export default function GeneratedAvatar({ name, size = "md", className = "" }: GeneratedAvatarProps) {
  const safeName = name || "BuffQuest";
  const initials = buildInitials(safeName);
  const palette = buildPalette(safeName);

  return (
    <div
      aria-label={`${safeName} avatar`}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/30 font-black uppercase tracking-[0.16em] text-white ${sizeClasses[size]} ${className}`}
      style={{
        background: palette.background,
        boxShadow: `${palette.shadow}, inset 0 1px 0 rgba(255,255,255,0.26)`,
      }}
    >
      <span className="absolute -left-1 top-1 h-4 w-4 rounded-full blur-sm" style={{ background: palette.sparkle }} />
      <span className="absolute bottom-0 right-0 h-5 w-5 rounded-full bg-black/12 blur-md" />
      <span className="relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)]">{initials}</span>
    </div>
  );
}
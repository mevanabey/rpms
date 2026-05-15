import { cn } from "@/lib/utils";

type Tone = "live" | "success" | "warning" | "danger" | "neutral";

const TONE: Record<Tone, { dot: string; ping: string }> = {
  live: { dot: "bg-emerald-500", ping: "bg-emerald-400/70" },
  success: { dot: "bg-emerald-500", ping: "bg-emerald-400/70" },
  warning: { dot: "bg-amber-500", ping: "bg-amber-400/70" },
  danger: { dot: "bg-rose-500", ping: "bg-rose-400/70" },
  neutral: { dot: "bg-zinc-400", ping: "bg-zinc-300/70" },
};

interface Props extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  /** When false, suppresses the pulsing halo (still renders the dot). */
  pulse?: boolean;
  size?: "xs" | "sm" | "md";
}

const SIZE: Record<"xs" | "sm" | "md", string> = {
  xs: "size-1.5",
  sm: "size-2",
  md: "size-2.5",
};

/**
 * Pulsing status dot. Used wherever we need to convey "this is happening
 * right now" — sidebar live indicator, activity feed rows, autonomy banner.
 */
export function LiveDot({
  tone = "live",
  pulse = true,
  size = "sm",
  className,
  ...props
}: Props) {
  const t = TONE[tone];
  const sz = SIZE[size];
  return (
    <span
      data-slot="live-dot"
      className={cn("relative inline-flex items-center justify-center", sz, className)}
      aria-hidden
      {...props}
    >
      {pulse && (
        <span
          className={cn(
            "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
            t.ping,
          )}
        />
      )}
      <span className={cn("relative inline-flex rounded-full", sz, t.dot)} />
    </span>
  );
}

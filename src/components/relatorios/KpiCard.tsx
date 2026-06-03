import { motion } from "framer-motion";
import { ResponsiveContainer, AreaChart, Area } from "recharts";
import { TrendingUp, TrendingDown, Minus, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type KpiTone = "indigo" | "emerald" | "amber" | "rose" | "violet" | "sky" | "slate";

const TONE_MAP: Record<
  KpiTone,
  { from: string; to: string; ring: string; icon: string; stroke: string; fill: string }
> = {
  indigo: {
    from: "from-indigo-500/10",
    to: "to-indigo-500/0",
    ring: "ring-indigo-500/20",
    icon: "text-indigo-600 bg-indigo-500/10",
    stroke: "#6366f1",
    fill: "#6366f1",
  },
  emerald: {
    from: "from-emerald-500/10",
    to: "to-emerald-500/0",
    ring: "ring-emerald-500/20",
    icon: "text-emerald-600 bg-emerald-500/10",
    stroke: "#10b981",
    fill: "#10b981",
  },
  amber: {
    from: "from-amber-500/10",
    to: "to-amber-500/0",
    ring: "ring-amber-500/20",
    icon: "text-amber-600 bg-amber-500/10",
    stroke: "#f59e0b",
    fill: "#f59e0b",
  },
  rose: {
    from: "from-rose-500/10",
    to: "to-rose-500/0",
    ring: "ring-rose-500/20",
    icon: "text-rose-600 bg-rose-500/10",
    stroke: "#f43f5e",
    fill: "#f43f5e",
  },
  violet: {
    from: "from-violet-500/10",
    to: "to-violet-500/0",
    ring: "ring-violet-500/20",
    icon: "text-violet-600 bg-violet-500/10",
    stroke: "#8b5cf6",
    fill: "#8b5cf6",
  },
  sky: {
    from: "from-sky-500/10",
    to: "to-sky-500/0",
    ring: "ring-sky-500/20",
    icon: "text-sky-600 bg-sky-500/10",
    stroke: "#0ea5e9",
    fill: "#0ea5e9",
  },
  slate: {
    from: "from-slate-500/10",
    to: "to-slate-500/0",
    ring: "ring-slate-500/20",
    icon: "text-slate-600 bg-slate-500/10",
    stroke: "#64748b",
    fill: "#64748b",
  },
};

export interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  delta?: number;
  tone?: KpiTone;
  series?: { date: string; value: number }[];
  onClick?: () => void;
  index?: number;
}

export function KpiCard({
  icon: Icon,
  label,
  value,
  delta,
  tone = "indigo",
  series,
  onClick,
  index = 0,
}: KpiCardProps) {
  const t = TONE_MAP[tone];
  const gradId = `kpi-grad-${tone}-${label.replace(/\s+/g, "")}`;
  const trend = typeof delta === "number" ? (delta > 0 ? "up" : delta < 0 ? "down" : "flat") : null;
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up"
      ? "text-emerald-600 bg-emerald-500/10"
      : trend === "down"
        ? "text-rose-600 bg-rose-500/10"
        : "text-slate-500 bg-slate-500/10";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: "easeOut" }}
      whileHover={{ y: -3 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card text-left shadow-sm ring-1 transition-all",
        "hover:shadow-lg hover:shadow-black/5",
        t.ring,
      )}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br pointer-events-none", t.from, t.to)} />
      <div className="relative p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium truncate">
              {label}
            </p>
            <p className="text-2xl font-bold tracking-tight mt-1 truncate">{value}</p>
          </div>
          <div className={cn("rounded-xl p-2 shrink-0", t.icon)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>

        <div className="flex items-end justify-between gap-2">
          {trend !== null ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                trendColor,
              )}
            >
              <TrendIcon className="h-3 w-3" />
              {delta! > 0 ? "+" : ""}
              {delta}%
            </span>
          ) : (
            <span />
          )}

          {series && series.length > 1 && (
            <div className="h-10 w-24">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={t.fill} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={t.fill} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={t.stroke}
                    strokeWidth={1.5}
                    fill={`url(#${gradId})`}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </motion.button>
  );
}

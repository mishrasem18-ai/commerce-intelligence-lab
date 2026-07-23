import { cn } from "@/lib/utils";

interface SparklineProps {
  data: number[];
  className?: string;
  stroke?: string;
  width?: number;
  height?: number;
}

/** Dependency-free SVG sparkline — one per KPI, cheaper than a chart lib. */
export function Sparkline({
  data,
  className,
  stroke = "var(--chart-1)",
  width = 120,
  height = 40,
}: SparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const pad = 3;
  const usableH = height - pad * 2;

  const points = data.map((value, index) => {
    const x = index * stepX;
    const y = pad + usableH - ((value - min) / range) * usableH;
    return [x, y] as const;
  });

  const line = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  const gradientId = `spark-${data.join("-").replace(/\./g, "")}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("h-10 w-full overflow-visible", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

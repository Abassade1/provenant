/**
 * Abstract dotwork/halftone wave — our own graphic (brief pattern 3: "build
 * our own as an inline SVG or canvas, in Provenant colours, subtle and
 * low-contrast"), not a reused asset. Dots flow along two offset sine
 * curves and shrink toward the edges for a halftone fade.
 */
export function Dotwork({ className = "", tone = "accent" }: { className?: string; tone?: "accent" | "primary" }) {
  const color = tone === "accent" ? "var(--accent)" : "var(--primary)";
  const width = 1200;
  const height = 360;
  const dots: { cx: number; cy: number; r: number; o: number }[] = [];

  for (let row = 0; row < 2; row++) {
    const amplitude = 60 + row * 30;
    const baseline = height / 2 + row * 70 - 35;
    const step = 28;
    for (let x = 0; x <= width; x += step) {
      const y = baseline + Math.sin((x / width) * Math.PI * 3 + row) * amplitude;
      const edgeFade = Math.sin((x / width) * Math.PI); // 0 at edges, 1 at centre
      dots.push({ cx: x, cy: y, r: 2 + edgeFade * 2.5, o: 0.08 + edgeFade * 0.18 });
    }
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      {dots.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill={color} opacity={d.o} />
      ))}
    </svg>
  );
}

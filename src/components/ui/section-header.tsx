export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
}) {
  const alignCls = align === "center" ? "text-center items-center mx-auto" : "text-left items-start";
  return (
    <div className={`flex max-w-[720px] flex-col gap-3 ${alignCls}`}>
      {eyebrow && <div className="text-xs font-semibold uppercase tracking-wide text-accent">{eyebrow}</div>}
      <h2 className="font-display text-[length:var(--text-h2)] font-semibold text-fg">{title}</h2>
      {subtitle && <p className="text-[length:var(--text-body-lg)] text-muted">{subtitle}</p>}
    </div>
  );
}

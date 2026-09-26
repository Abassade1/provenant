/** Persistent banner shown whenever demo data can appear (brief §5.3). */
export function DemoBanner() {
  if (process.env.ENABLE_DEMO_SOURCE === "false") return null;
  return (
    <div role="note" className="bg-warn-bg text-warn-fg border-b border-line px-4 py-2 text-sm">
      <strong>Demo data.</strong> Jobs marked “(demo)” are fictional employers and postings used to show how
      Provenant works. They are not real openings.
    </div>
  );
}

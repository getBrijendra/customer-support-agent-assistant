import { KpiTile } from "@/components/ui";
import { fmtPct } from "@/lib/format";
import type { EvalMetrics } from "@/lib/types";

export function EvalMetricTiles({ m }: { m: EvalMetrics }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <KpiTile label="Top-1 accuracy" value={fmtPct(m.top1_accuracy)} hint={`${m.positives ?? 0} in-scope cases`} />
      <KpiTile label="Recall@k" value={fmtPct(m.recall_at_k)} hint="expected intent among candidates" />
      <KpiTile label="Multi-intent F1" value={fmtPct(m.set_f1)} hint={`P ${fmtPct(m.set_precision)} · R ${fmtPct(m.set_recall)}`} />
      <KpiTile label="Exact match" value={fmtPct(m.exact_match_rate)} />
      <KpiTile label="No-match precision" value={fmtPct(m.no_match_precision)} />
      <KpiTile label="No-match recall" value={fmtPct(m.no_match_recall)} hint={`${m.negatives ?? 0} negatives`} />
      <KpiTile label="Cases" value={m.cases ?? 0} />
      <KpiTile label="Stale (not scored)" value={m.stale ?? 0} hint="expected key missing in version" />
    </div>
  );
}

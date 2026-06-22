"use client";

import { Card, CardTitle } from "@/components/ui/Card";
import { useTopicsStore } from "@/store/topics-store";
import { useHydrated } from "@/hooks/useHydrated";
import { STAGE_ORDER, STAGES } from "@/types/topic";
import { cn } from "@/lib/utils";

// 流水线步骤（合并展示用，去掉「已发布」终态）
const STEPS = STAGES.filter((s) => s.key !== "published");

export function Pipeline() {
  const hydrated = useHydrated();
  const topics = useTopicsStore((s) => s.topics);

  // 取推进得最靠前的活跃选题作为「今日主线」
  const active = topics.filter((t) => t.stage !== "published");
  const lead = active.reduce<(typeof topics)[number] | null>((best, t) => {
    if (!best) return t;
    return STAGE_ORDER.indexOf(t.stage) > STAGE_ORDER.indexOf(best.stage) ? t : best;
  }, null);

  const leadIndex = lead ? STAGE_ORDER.indexOf(lead.stage) : 0;
  const pct = Math.round(((leadIndex + 1) / STEPS.length) * 100);

  return (
    <Card>
      <CardTitle>今日主线进度</CardTitle>
      <p className="mb-3 mt-0.5 truncate text-[12.5px] text-muted">
        {hydrated && lead ? `选题《${lead.title}》` : "暂无进行中的选题"}
      </p>
      <div className="h-[5px] overflow-hidden rounded-[10px] bg-surface-2">
        <div
          className="h-full bg-gradient-to-r from-terra to-gold transition-all"
          style={{ width: hydrated ? `${pct}%` : "0%" }}
        />
      </div>
      <p className="mb-3.5 mt-2 text-[12.5px] text-muted">
        已推进到 {hydrated ? leadIndex + 1 : 0} / {STEPS.length} 步
      </p>
      <div className="flex flex-col gap-3">
        {STEPS.map((step, i) => {
          const state =
            !hydrated || !lead
              ? "todo"
              : i < leadIndex
                ? "done"
                : i === leadIndex
                  ? "now"
                  : "todo";
          return (
            <div key={step.key} className="flex items-center gap-3">
              <span
                className={cn(
                  "grid h-[26px] w-[26px] flex-none place-items-center rounded-full border text-[12px]",
                  state === "done" && "border-sage bg-sage text-white",
                  state === "now" &&
                    "border-terra bg-terra text-white shadow-[0_0_0_4px_var(--terra-wash)]",
                  state === "todo" && "border-line bg-surface text-muted"
                )}
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              <span
                className={cn(
                  "text-[13.5px]",
                  state === "todo" ? "text-muted" : "text-ink"
                )}
              >
                {step.label}
              </span>
              {state === "now" ? (
                <span className="ml-auto text-[11.5px] text-muted">进行中</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

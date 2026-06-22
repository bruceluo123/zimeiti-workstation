import { Card, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

interface AssetItem {
  type: string;
  label: string;
  variant: "cover" | "video" | "plain";
}

// 占位产出：素材工厂接入 AI 生图/生视频后回填真实缩略图
const ASSETS: AssetItem[] = [
  { type: "封面", label: "一人公司\n的 6 个 Agent", variant: "cover" },
  { type: "视频 · 8s", label: "▶ 竖屏成片\n720P 9:16", variant: "video" },
  { type: "文案", label: "口播稿\n·740 字·", variant: "plain" },
  { type: "配图", label: "等生成\n（诚实占位）", variant: "plain" },
];

export function Gallery() {
  return (
    <Card>
      <CardTitle action={<span className="cursor-pointer text-[12px] font-medium text-terra">查看全部 →</span>}>
        我的产出画廊
      </CardTitle>
      <p className="mb-4 mt-0.5 text-[12.5px] text-muted">
        攒下来的封面、文案、视频——看着它越来越多，就是坚持的理由。
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ASSETS.map((a, i) => (
          <div
            key={i}
            className={cn(
              "relative aspect-[3/4] cursor-pointer overflow-hidden rounded-[10px] border border-line transition hover:-translate-y-0.5 hover:shadow-card",
              a.variant === "cover" && "border-none bg-gradient-to-br from-[#E9C9A0] to-terra",
              a.variant === "video" && "border-none bg-gradient-to-br from-[#3a3733] to-ink-soft",
              a.variant === "plain" && "bg-surface-2"
            )}
          >
            <span className="absolute left-[7px] top-[7px] rounded-[4px] bg-black/70 px-[6px] py-px text-[10px] text-white">
              {a.type}
            </span>
            <span
              className={cn(
                "absolute inset-0 grid place-items-center whitespace-pre-line px-2 text-center text-[12px]",
                a.variant === "cover" && "font-serif text-[15px] font-semibold leading-tight text-white",
                a.variant === "video" && "text-[#F3ECE2]",
                a.variant === "plain" && "text-muted"
              )}
            >
              {a.label}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

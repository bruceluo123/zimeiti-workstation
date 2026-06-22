import { PageHeader } from "@/components/ui/PageHeader";
import { ThoughtFlow } from "@/components/flow/ThoughtFlow";

export default function FlowPage() {
  return (
    <div className="max-w-[1180px] px-[38px] pb-16 pt-9">
      <PageHeader
        eyebrow="每日记录 · 你的第二大脑"
        title="想法流"
        sub="不是日记，是素材。每条都来自「今日」的随手记录。"
      />
      <ThoughtFlow />
    </div>
  );
}

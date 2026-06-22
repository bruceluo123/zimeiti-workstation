import { PageHeader } from "@/components/ui/PageHeader";
import { CaptureBox } from "@/components/today/CaptureBox";
import { BriefList } from "@/components/today/BriefList";
import { Pipeline } from "@/components/today/Pipeline";
import { Gallery } from "@/components/today/Gallery";

export default function TodayPage() {
  return (
    <div className="max-w-[1180px] px-[38px] pb-16 pt-9">
      <PageHeader
        eyebrow="每日一处 · 进来先写一句"
        title="今天，你想到了什么？"
        sub="不用完整，一句话也行。这里是你的原矿，下游所有内容都从这里长出来。"
      />

      <CaptureBox />

      <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        <BriefList />
        <Pipeline />
      </div>

      <div className="h-7" />

      <Gallery />
    </div>
  );
}

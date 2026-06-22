import { PageHeader } from "@/components/ui/PageHeader";
import { KanbanBoard } from "@/components/studio/KanbanBoard";

export default function StudioPage() {
  return (
    <div className="max-w-[1180px] px-[38px] pb-16 pt-9">
      <PageHeader
        eyebrow="生产线 · 一张选题卡片走完全程"
        title="创作台"
        sub="把散落的步骤变成一条泳道。推进卡片，看着它从念头一路走到发布。"
      />
      <KanbanBoard />
    </div>
  );
}

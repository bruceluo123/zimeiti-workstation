import { Send } from "lucide-react";
import { StubPage } from "@/components/ui/StubPage";

export default function PublishPage() {
  return (
    <div className="max-w-[1180px] px-[38px] pb-16 pt-9">
      <StubPage
        icon={Send}
        title="发布箱"
        desc="借鉴 AitoEarn 草稿箱：多平台草稿统一管理，定时排期，一键分发到小红书 / 抖音 / X / 公众号。"
        features={["全部 · 草稿 · 视频 · 图片", "定时排期", "一键多平台", "发布数据回收"]}
      />
    </div>
  );
}

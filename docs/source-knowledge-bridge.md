# 素材来源与知识积木

资源库 → 来源资料 → 按日常素材、书籍章节或关键词筛选 → 展开“提炼为知识积木” → 勾选 1—10 份正文 → 连接本机 Codex → 提炼。

提炼结果显示在资源库的“知识积木 / 待确认”。每块的正文直接保存文章原句或视频口播转写原句；Codex 只挑选原句、标注类型和标签。可以在同一原文段落中重新选取连续文字，核对后确认入库。已入库内容进入现有写作检索与使用记录流程。每个积木保留作者（来源提供时）、来源 URL 和素材入口。

实现约定：

- `/api/assistant/library` 接收当前浏览器选中的原文快照，因此服务器素材和仅保存在浏览器中的素材均可使用。
- `librarySourceIds` 把素材 ID 关联到工作台原文快照；不改变素材库的原文或 AI 摘要。
- 依据正文与 URL 去重。同一快照有任务或知识块时不再次分析；原文更新创建新快照，旧引用不失效。
- 任务分段保存。关闭页面后继续执行；失败或停止后可从断点继续。未完成任务持续显示重试入口。
- 使用现有 Codex 工作进程挑选原句并分类；存储和审核都逐字校验来源。旧候选里保存的 AI 概括会从已留存原文恢复为原句。候选状态为 pending，用户确认后为 approved；写作只检索 approved。
- 单批最多 50 万字、10 份。预览、裸链接、采集失败和仍在处理的内容不能提炼。书籍可按章节分批选择。
- 本机运行由 `scripts/start-source-workstation.mjs` 启动，开启本机采集配置；接口保持本机同源限制。

验证：`node --test tests/assistant-library.test.mjs tests/assistant-store.test.mjs tests/assistant-access.test.mjs tests/source-import.test.mjs tests/writing.test.mjs`，以及 `npm run build`。测试覆盖重复提交、版本保留、失败任务关联、候选到确认检索的链路和引用出处。

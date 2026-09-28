# 知识库与提炼入口 BUG 修复验收

验收日期：2026-09-27。目标：本机 `http://127.0.0.1:3002`。未部署。

## 修复结果

1. 知识库页面与读取 API 的本机规则一致。明确启用本地启动器时，允许本机生产构建的 GET `/knowledge`、`/api/kb`、`/api/kb/doc`；开发模式同样支持本机读取。Vercel、要求登录的配置、非本机 Host、外部代理 Host、跨站请求及非白名单操作不走本机例外。API 自身仍验证线上所有者身份，未配置身份服务时也不暴露文件，响应禁止共享缓存。
2. 知识库列表和文档详情在写入页面状态前检查 HTTP 状态与响应结构。登录、权限、网络、缺目录、空库、文档不存在分别呈现可操作提示。补充了日期格式统一、无效 UTF-8 知识链接保护，以及本机生产构建重试时重新读取文件。
3. 提炼模式 0 资料时明确解释不能发送的原因，提供上传、粘贴原文、选择已有资料三个入口。窄屏自动打开对应面板并聚焦，选中后可以返回输入框；导入成功自动选中。粘贴流程明确保存到本机、填写出处、材料仍需核验。发送按钮和快捷键使用相同条件，仅提交实际存在的来源，最多 10 份。
4. 任务排队、分析、完成、失败与断点重试均有可见反馈。发送请求失败时也刷新后台已保存的任务状态；不会把提炼要求自动当作原始材料。

## 实际页面验收

| 场景 | 结果 |
| --- | --- |
| 修复前 GET `/knowledge` 200、GET `/api/kb` 与 `/api/kb/doc` 401 | 已复现；页面最终抛出读取 `hubs` 的 TypeError |
| 关闭本机读取例外，读取接口仍为 401 | 显示“暂时无法读取知识库”“重试读取”“前往登录”，无白屏 |
| 恢复本机例外后点击重试 | 成功读取，无需绕过登录去访问线上资料 |
| 隔离文档的缺失双链 | 404 提示、重试及关闭面板可见、可用 |
| 隔离文档包含 `[无效编码链接](?wiki=%FF)` | 正文正常显示，坏链接变为不可点击文字 |
| 正式知识库恢复 | 84 篇文档、9 个枢纽、48 条素材、205 条双链；两个读取 API 均 200 |
| 正式文档详情、双链、搜索结果打开、关系图切换 | 已通过浏览器验收 |
| 提炼模式 0 资料，填入要求并按 Ctrl+Enter | 仍被阻止，三个资料入口明确可见；未创建任务 |
| 粘贴虚构测试资料与出处 | 保存为独立来源并自动选中，返回输入框，发送可用 |
| 点击发送，调用本机已连接 Codex | 真实完成一次提炼，生成 1 个待确认知识块；保留原文、来源与“未核验”标记 |
| 上传 TXT 文件 | 文件选择器、上传、自动选中、成功通知均可用 |
| 390px 窄屏选择已有资料与粘贴入口 | 切换面板、定位焦点、选中后返回对话、发送可用均通过 |
| 隔离资料库用不可用模型触发失败 | 真实失败原因与断点重试按钮显示；点击重试后显示“正在分析 1/1 段” |

失败测试通过隔离 API 请求指定不可用模型来触发，并非声称正常模型自然失败。正常模型的完整提炼已成功。测试知识块保持待确认状态，未收录到正式知识库。

## 检查结果

- `npx tsc --noEmit --incremental false`：通过。
- `npm run build`：最终生产构建通过。
- `node --test tests/knowledge-access.test.mjs tests/knowledge-response.test.mjs tests/knowledge-routes.test.mjs tests/assistant-access.test.mjs tests/assistant-store.test.mjs tests/source-local-access.test.mjs tests/writing.test.mjs`：20/20 通过。
- `py tests/assistant-pdf.test.py`：通过，验证原页码与空白页提示；本轮网页上传实测使用 TXT。
- 本机 HTTP 检查：正常 GET 200；跨站、外部 Origin、外部 forwarded Host 请求均 401；缺失文档 404；详情响应含 `private, no-store`。
- 代码与 TypeScript 审阅完成。审阅发现的本机永久缓存和坏链接解码异常均已修复。
- 没有独立运行 ESLint：仓库未配置所需依赖与配置，未为此引入新依赖。

未执行线上部署或真实线上账号登录验收。线上限制由本机 HTTP 拒绝测试及隔离的访问规则、所有者鉴权测试覆盖。未逐个测试关系图的所有节点交互，也未重复验证每一种文件类型的页面上传。

## 数据与运行状态

验收使用临时助手资料库和临时 wiki 文件夹；真实提炼仅使用标注为虚构的文本及隔离创作档案。测试后恢复 `scripts/start-source-workstation.mjs` 的正常启动方式，监听 `127.0.0.1:3002`。正式助手仍有原来的 2 个对话、0 份来源、0 个任务。

正式助手 `state.json` 的 SHA-256 与验收前一致；84 篇正式 wiki 文件的 SHA-256 全部一致。保留原有未提交修改，未清理资料、提交代码、部署、发布社交内容或处理密钥。

本次涉及：`AssistantPage.tsx`；知识库 `KnowledgePage.tsx`、`DocPanel.tsx`、新增 `response.ts`；两个 kb 读取路由；`kb.ts`、新增 `knowledge-access.ts`；`local-access.ts` 的知识库函数及 middleware 对应分支；3 个知识库回归测试文件。本轮没有重写其他原有变更。

截图存放于 `C:/Users/Administrator/.codex/visualizations/2026/09/27/01a0e1ee-273f-7a00-99b2-29014d265574/`：`knowledge-restored.jpg`、`knowledge-login-error.jpg`、`knowledge-doc-error.jpg`、`assistant-zero-sources.jpg`、`assistant-mobile-selected.jpg`、`assistant-failed.jpg`、`assistant-retry-progress.jpg`。

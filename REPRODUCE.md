# 🍔 麦满分工作站 — 完整备份与复现说明

> 本文件是备份的**总入口**。任何人（含其他 AI agent）拿到备份文件夹，照此即可从零复现整个系统。
> 项目本身的权威文档是同目录下的 [`CLAUDE.md`](./CLAUDE.md)，本文件只补充「如何从备份复现」的部分。

---

## 一、这份备份是什么

- **备份时间**：2026-07-01 23:05
- **源路径**：`D:\projects\zimeiti-workstation`
- **项目**：自媒体内容生产平台（Next.js 14 + React 18 + TypeScript）
- **线上地址**：https://burger-workstation.vercel.app
- **GitHub**：https://github.com/bruceluo123/zimeiti-workstation
- **本备份含**：全部源码 + 配置 + **完整 git 历史（含未提交的工作树改动）** + **真实密钥** + 数据文件
- **本备份不含**（可自动复原，无需备份）：
  - `node_modules/`（339M）→ `npm install` 复原
  - `.next/`（153M）→ `npm run build` / `npm run dev` 复原

## 二、⚠️ 本备份含真实密钥 — 请妥善保管

以下文件包含**可直接使用的真实密钥**，请勿外传 / 上传公开仓库 / 发给不可信方：

| 文件 | 含有的密钥 |
|------|-----------|
| `.env.local` | Upstash KV URL/Token、DeepSeek API Key、DashScope API Key |
| `scripts/.env` | X(Twitter) API Key/Secret、Access Token/Secret（已废弃路径，Free tier 读 following 被墙） |
| `.vercel/project.json` | Vercel 项目/组织 ID |
| `_external-secrets/x_cookies.json` | X 网页登录 cookie（auth_token + ct0），X 关注流抓取脚本必需 |

> `_external-secrets/` 是备份时额外纳入的**项目外依赖**。原始位置在
> `C:\Users\Administrator\.claude\private\x_cookies.json`，复现时需放回该位置（见第五节）。

## 三、从备份复现（标准 Web 应用）

前置：Node.js 18+（原环境 v22），npm。

```bash
# 1) 把整个文件夹拷到目标机器，例如 D:\projects\zimeiti-workstation
# 2) 进入目录，装依赖
cd zimeiti-workstation
npm install

# 3) 本地开发（端口 3002；.env.local 已含真实密钥，开箱即用）
npm run dev            # → http://localhost:3002

# 4) 构建 / 生产
npm run build
npm run start          # 端口 3002
```

git 历史完整，可直接继续开发：`git log`、`git status`（备份时有若干未提交改动，已一并保留）。

## 四、环境变量清单

在 `.env.local`（本地）和 **Vercel 项目设置**（生产）两处都要有：

| 变量 | 用途 | 备注 |
|------|------|------|
| `NEXT_PUBLIC_ZMT_KV_URL` | Upstash KV 地址 | `positive-mongrel-70521.upstash.io`，`zmt:` 命名空间 |
| `NEXT_PUBLIC_ZMT_KV_TOKEN` | Upstash KV 令牌 | 浏览器直连同步用（`NEXT_PUBLIC_` 会暴露到前端） |
| `DEEPSEEK_API_KEY` | 创作台 AI（口播稿/选题筛选） | `/api/studio/*` 用 |
| `DASHSCOPE_API_KEY` | 素材工厂生图（通义万象 wanx-v1） | `/api/factory/image` 用 |

占位符模板见 `.env.example`。

## 五、Python / Playwright 脚本环境（X 关注流抓取）

`scripts/` 下的 X 抓取管线依赖 Python + Playwright，**不是 npm 依赖**，需单独装：

```bash
# 用 py launcher（不是 python —— 本机 python 是 Windows Store 桩，找不到 playwright）
py -m pip install playwright requests
py -m playwright install chromium

# cookie 放回原位（X 抓取脚本从这里读 auth_token/ct0）
copy _external-secrets\x_cookies.json C:\Users\Administrator\.claude\private\x_cookies.json

# 手动抓一次关注流 → data/x-feed.json
py scripts\fetch-x-home.py --scroll 4 --hours 48
```

关键脚本：
- `scripts/fetch-x-home.py` — 主抓取（Playwright 注入 cookie，拦 HomeLatestTimeline GraphQL，纯 Following 流）
- `scripts/fetch-x-home-daily.ps1` — 每日：跑抓取 → git push → Vercel 部署
- `scripts/register-x-home-task.ps1` — 注册 Windows 计划任务 `ZmtXHomeDaily`（每天 08:30）
- `scripts/daily-9am.ps1` + `register-task.ps1` — 每日 09:00 早报自动化（含 daily-input 技能）
- `scripts/restart-dev.ps1` — 改 CSS 后一键清缓存重启 dev server

> ⚠️ 含中文的 `.ps1` 必须存成 **UTF-8 with BOM**，否则 PowerShell 5.1 按 GBK 解析报错。

## 六、外部依赖（不在代码里，复现需自备/复用）

1. **Upstash KV 实例** `positive-mongrel-70521.upstash.io` —— 数据存这里（`zmt:` 命名空间，与招聘系统 `recruit:*` 隔离）。换实例需改 `.env.local` 的 URL/Token。
2. **Vercel 项目** —— push 到 GitHub master 自动部署。`.vercel/project.json` 记录了绑定。
3. **GitHub 仓库** `bruceluo123/zimeiti-workstation` —— 代码托管 + 触发部署。
4. **X cookie** —— 会过期，失效后 X 抓取脚本会报错，需重新登录 x.com 取新的 auth_token/ct0 更新 cookie 文件。

## 七、复现后自检清单

- [ ] `npm install` 无报错
- [ ] `npm run dev` → http://localhost:3002 正常出样式（不是无样式裸 HTML，见 CLAUDE.md CSS 血泪教训）
- [ ] `/api/inspire` 返回数据（读 `data/x-feed.json`）
- [ ] `git log` 能看到完整历史
- [ ] （可选）`py scripts\fetch-x-home.py` 能抓到关注流

---

**更详细的项目设计决策、目录说明、踩坑记录 → 见 [`CLAUDE.md`](./CLAUDE.md)。**

# 🍔 麦满分工作站

## 项目概述
自媒体内容生产平台：今日早报 → 想法记录 → 灵感库 → 创作台看板 → 素材工厂 → 发布箱。

- **线上地址**: https://burger-workstation.vercel.app
- **GitHub**: https://github.com/bruceluo123/zimeiti-workstation
- **部署方式**: Vercel 自动部署（push to master → auto deploy）
- **数据库**: Upstash KV — `positive-mongrel-70521.upstash.io`（`zmt:` 命名空间，与招聘系统共用实例但数据隔离）

## 技术栈
- Next.js 14 (App Router) + React 18 + TypeScript
- Tailwind CSS 3，暖色出版物设计系统（cream #faf6f0 + terracotta #bf5b33）
- Zustand（状态管理，persist → localStorage）
- Upstash KV 云同步（浏览器直连，10秒轮询，墓碑机制防冲突）
- DeepSeek/aihot API（灵感库数据）
- DashScope 通义万象（素材工厂生图）
- 本地开发端口：**3002**

## 目录结构
```
src/
├── app/
│   ├── page.tsx                    # 今日（今日早报+想法记录+看板进度）
│   ├── flow/page.tsx               # 想法流（时间线 masonry）
│   ├── inspire/page.tsx            # 灵感库（aihot 实时拉取）
│   ├── studio/page.tsx             # 创作台（7阶段看板）
│   ├── factory/page.tsx            # 素材工厂（AI 生图）
│   ├── publish/page.tsx            # 发布箱（占位）
│   └── api/
│       ├── inspire/route.ts        # aihot 代理（处理 UA 黑名单）
│       └── factory/image/route.ts  # DashScope wanx 生图代理
├── components/
│   ├── layout/                     # Sidebar / TopBar / SyncProvider
│   ├── today/                      # CaptureBox / BriefList / Pipeline / Gallery
│   ├── flow/                       # ThoughtFlow
│   ├── inspire/                    # InspirePage
│   ├── studio/                     # KanbanBoard / KanbanColumn / TopicCard
│   ├── factory/                    # FactoryPage
│   └── ui/                         # PageHeader / Card / StubPage
├── store/
│   ├── thoughts-store.ts           # Zustand persist，applyRemote 支持云同步
│   └── topics-store.ts             # Zustand persist，updatedAt 冲突解决
├── lib/
│   ├── sync.ts                     # Upstash KV 双向同步（zmt: 命名空间）
│   └── utils.ts                    # cn / uid / formatTime / relativeDay / computeStreak
└── types/
    ├── thought.ts / topic.ts / inspire.ts
```

## 环境变量
```
# .env.local（本地）或 Vercel 项目设置（生产）
NEXT_PUBLIC_ZMT_KV_URL=https://positive-mongrel-70521.upstash.io   # 已配
NEXT_PUBLIC_ZMT_KV_TOKEN=...                                        # 已配
DASHSCOPE_API_KEY=sk-xxx    # 素材工厂生图，需手动在 Vercel 配置
```

## 关键设计决策

1. **字体**：纯本地系统字体（Georgia/宋体/微软雅黑），禁用 Google Fonts（中国访问会 hang 页面）
2. **KV 命名空间**：`zmt:thoughts` / `zmt:topics`，与招聘系统 `recruit:*` 完全隔离
3. **X 推文**：agent-reach CLI skill 抓取后写入 `data/x-feed.json`，/api/inspire 优雅读取（文件不存在返回空数组）
4. **素材工厂**：5维度体系参照 baoyu-cover-image skill，后端直调 DashScope wanx-v1 API（异步任务 + 轮询）

## Session 日志
- [2026-06-22] 完成 A/B/C：KV env-var 化，/api/inspire 接 aihot，灵感库全页，/api/factory/image + 素材工厂5维度UI；git init + GitHub + Vercel 部署上线

## 常用命令
```bash
cd "D:\projects\zimeiti-workstation"
npm run dev                          # 本地开发 localhost:3002
npx next build                       # 构建检查
npx vercel deploy --prod --yes       # 部署生产
```

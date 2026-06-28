# daily-9am.ps1 — 每天 9:00 自动运行
# 1. 调 Claude CLI 跑 daily-input 技能（抓 aihot + X）
# 2. 解析早报 markdown 提取 X 推文写入 x-feed.json
# 3. git push 触发 Vercel 部署

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Split-Path -Parent $scriptDir

# ---------- 日期 ----------
$today = (Get-Date).ToString("yyyy-MM-dd")
$dailyDir = "D:\wiki\个人知识库\daily\$today"
if (-not (Test-Path $dailyDir)) { New-Item -ItemType Directory -Path $dailyDir | Out-Null }

Write-Host "[9am] === $today 日报自动化开始 ===" -ForegroundColor Cyan

# ---------- Step 1: daily-input 技能 ----------
Write-Host "[9am] 运行 daily-input..."
$dailyInputSkill = "C:\Users\Administrator\.claude\skills\daily-input\SKILL.md"
if (Test-Path $dailyInputSkill) {
    # claude CLI 用 --print 跑技能，输出写到早报 md
    claude --print "运行 daily-input 技能，今天日期 $today，生成 ${dailyDir}\00_早报.md" `
        --add-dir $dailyDir 2>&1 | Out-Null
    Write-Host "[9am] daily-input 完成"
} else {
    Write-Host "[9am] 未找到 daily-input skill，跳过" -ForegroundColor Yellow
}

# ---------- Step 2: 用 cookie 拉 X「正在关注」流 ----------
# 注意：必须用 py launcher（playwright 装在 py 环境，PowerShell 的 python 是 Store 桩）
Write-Host "[9am] 拉取 X 关注流..."
$fetchXScript = Join-Path $scriptDir "fetch-x-home.py"
$env:PYTHONIOENCODING = "utf-8"
py $fetchXScript --scroll 4 --hours 48
if ($LASTEXITCODE -ne 0) {
    Write-Host "[9am] X 关注流抓取失败，尝试降级：解析早报 markdown..." -ForegroundColor Yellow
    $xfeedScript = Join-Path $scriptDir "parse-xfeed.mjs"
    $earlyReportPath = "$dailyDir\00_早报.md"
    if (Test-Path $earlyReportPath) { node $xfeedScript $earlyReportPath }
}
Write-Host "[9am] x-feed.json 更新完成"

# ---------- Step 3: git push → Vercel 自动部署 ----------
Write-Host "[9am] git push..."
Push-Location $projectDir
git add data/x-feed.json
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    git commit -m "auto: daily x-feed update $today"
    git push
    Write-Host "[9am] push 完成，Vercel 将自动部署" -ForegroundColor Green
} else {
    Write-Host "[9am] x-feed.json 无变化，跳过 push"
}
Pop-Location

Write-Host "[9am] === 完成 ===" -ForegroundColor Cyan

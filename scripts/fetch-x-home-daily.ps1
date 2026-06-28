# fetch-x-home-daily.ps1 — 每日自动拉 X「正在关注」流 → x-feed.json → git push → Vercel 部署
#
# 由计划任务 ZmtXHomeDaily 调用（见 register-x-home-task.ps1）。
# 也可手动跑：powershell -ExecutionPolicy Bypass -File scripts\fetch-x-home-daily.ps1
#
# 注意：必须用 py launcher，不能用 python —— playwright 装在 py 的环境里，
# PowerShell 的 python 是 Windows Store 桩，找不到 playwright。

$ErrorActionPreference = "Stop"
$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Split-Path -Parent $scriptDir
$today      = (Get-Date).ToString("yyyy-MM-dd")

Write-Host "[x-home] === $today 拉取 X 关注流 ===" -ForegroundColor Cyan

# ---------- Step 1: 抓关注流 ----------
$fetchScript = Join-Path $scriptDir "fetch-x-home.py"
$env:PYTHONIOENCODING = "utf-8"
py $fetchScript --scroll 4 --hours 48
if ($LASTEXITCODE -ne 0) {
    Write-Host "[x-home] ❌ 抓取失败（cookie 可能过期），终止" -ForegroundColor Red
    exit 1
}

# ---------- Step 2: git push → Vercel 自动部署 ----------
Push-Location $projectDir
try {
    git add data/x-feed.json
    git diff --cached --quiet
    if ($LASTEXITCODE -ne 0) {
        git commit -m "auto: daily x-home feed update $today"
        git push
        Write-Host "[x-home] ✅ push 完成，Vercel 将自动部署" -ForegroundColor Green
    } else {
        Write-Host "[x-home] x-feed.json 无变化，跳过 push"
    }
} finally {
    Pop-Location
}

Write-Host "[x-home] === 完成 ===" -ForegroundColor Cyan

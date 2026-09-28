# restart-dev.ps1 — 清除 Next.js CSS 缓存并重启 dev server
# 在修改 globals.css 或 tailwind.config.ts 后必须运行此脚本

$PROJECT = "D:\projects\zimeiti-workstation"
$PORT = 3002

Write-Host "[restart-dev] 停止端口 $PORT 上的进程..." -ForegroundColor Yellow

# 找到并杀掉占用 3002 端口的进程
$pid3002 = netstat -ano | Select-String ":$PORT " | Where-Object { $_ -match 'LISTENING' } | ForEach-Object {
    ($_ -split '\s+')[-1]
} | Select-Object -First 1

if ($pid3002) {
    Write-Host "[restart-dev] 终止 PID $pid3002" -ForegroundColor Yellow
    Stop-Process -Id $pid3002 -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
} else {
    Write-Host "[restart-dev] 未找到端口 $PORT 上的进程" -ForegroundColor Gray
}

# 清除 Next.js 缓存
Write-Host "[restart-dev] 清除 .next 缓存..." -ForegroundColor Yellow
Remove-Item -Recurse -Force "$PROJECT\.next" -ErrorAction SilentlyContinue

Write-Host "[restart-dev] 启动 dev server（端口 $PORT）..." -ForegroundColor Green
Set-Location $PROJECT
Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "run", "dev", "--", "--port", "$PORT"

Write-Host "[restart-dev] 完成！等待约 8 秒后访问 http://localhost:$PORT" -ForegroundColor Green

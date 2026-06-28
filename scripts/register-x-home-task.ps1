# register-x-home-task.ps1 — 一次性运行，注册「每日拉 X 关注流」计划任务
# 以管理员身份运行：powershell -ExecutionPolicy Bypass -File scripts\register-x-home-task.ps1

$taskName  = "ZmtXHomeDaily"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ps1Path   = Join-Path $scriptDir "fetch-x-home-daily.ps1"

$action  = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ps1Path`""

# 每天 08:30 跑（比 daily-9am 早半小时，错峰避免两个任务同时 git push）
$trigger = New-ScheduledTaskTrigger -Daily -At "08:30"

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 20)

Register-ScheduledTask `
    -TaskName $taskName `
    -Action   $action `
    -Trigger  $trigger `
    -Settings $settings `
    -RunLevel Highest `
    -Force

Write-Host "✅ 计划任务 '$taskName' 注册成功，每天 08:30 自动拉 X 关注流" -ForegroundColor Green
Write-Host "   查看：Task Scheduler → $taskName"
Write-Host "   手动测试：schtasks /Run /TN $taskName"
Write-Host "   取消：Unregister-ScheduledTask -TaskName $taskName -Confirm:`$false"

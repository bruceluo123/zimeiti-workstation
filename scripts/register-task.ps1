# register-task.ps1 — 一次性运行，注册 Windows 计划任务
# 以管理员身份运行：powershell -ExecutionPolicy Bypass -File scripts\register-task.ps1

$taskName  = "ZmtDaily9am"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ps1Path   = Join-Path $scriptDir "daily-9am.ps1"

$action  = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ps1Path`""

$trigger = New-ScheduledTaskTrigger -Daily -At "09:00"

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1)

Register-ScheduledTask `
    -TaskName $taskName `
    -Action   $action `
    -Trigger  $trigger `
    -Settings $settings `
    -RunLevel Highest `
    -Force

Write-Host "✅ 计划任务 '$taskName' 注册成功，每天 09:00 自动执行" -ForegroundColor Green
Write-Host "   查看：Task Scheduler → $taskName"
Write-Host "   手动测试：schtasks /Run /TN $taskName"

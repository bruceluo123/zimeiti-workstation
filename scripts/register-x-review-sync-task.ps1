# Every five minutes, check the Weibo publish queue; X is read at most once per 29 minutes.
$taskName = 'ZmtXWeiboAutoPublish'
$oldTaskName = 'ZmtXReviewSyncTwiceDaily'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runner = Join-Path $PSScriptRoot 'run-local-x-sync.mjs'
$hiddenRunner = Join-Path $PSScriptRoot 'run-local-x-sync-hidden.vbs'
$node = (Get-Command node -ErrorAction Stop).Source
$wscript = Join-Path $env:WINDIR 'System32\wscript.exe'

$actionArguments = ('"' + $hiddenRunner + '" "' + $node + '" "' + $runner + '"')
$action = New-ScheduledTaskAction -Execute $wscript -Argument $actionArguments -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 3) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
if (Get-ScheduledTask -TaskName $oldTaskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $oldTaskName -Confirm:$false
}
Write-Output 'Local X sync and Weibo publish task registered.'

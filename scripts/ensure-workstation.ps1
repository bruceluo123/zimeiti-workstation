# Keep the local workstation available after a server process is interrupted.
# This is run by Task Scheduler every minute; it never stops an existing server.
$taskName = 'ZimeitiWorkstation-3002'
$projectRoot = Split-Path -Parent $PSScriptRoot

if (Get-NetTCPConnection -LocalPort 3002 -State Listen -ErrorAction SilentlyContinue) { return }
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot '.next/BUILD_ID'))) { return }

# A build temporarily takes the server offline. Let it finish before restarting.
$building = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
    Where-Object { $_.CommandLine -like "*$projectRoot*" -and $_.CommandLine -match 'next[\\/]dist[\\/]bin[\\/]next.*build' }
if ($building) { return }

$task = Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
if ($task.State -ne 'Running') {
    Start-ScheduledTask -TaskName $taskName
}

$ErrorActionPreference='Stop'
$taskPidPath=Join-Path $PSScriptRoot '.runtime/tunnel.pid'
if(Test-Path -LiteralPath $taskPidPath){
    $taskTunnelPid=[int](Get-Content -LiteralPath $taskPidPath -Raw)
    $taskProc=Get-CimInstance Win32_Process -Filter "ProcessId = $taskTunnelPid" -ErrorAction SilentlyContinue
    $taskExpected=Join-Path $PSScriptRoot '.runtime/tools/cloudflared-windows-amd64.exe'
    if($taskProc -and $taskProc.ExecutablePath -eq $taskExpected){Stop-Process -Id $taskTunnelPid}
}
& (Join-Path $PSScriptRoot 'Stop-Game.ps1')
Write-Output 'Public server stopped. Player data remains on disk.'

param([int]$Port = 8787, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
$taskLogRoot = Join-Path $taskRoot '.runtime'
New-Item -ItemType Directory -Path $taskLogRoot -Force | Out-Null
$taskNode = (Get-Command node -ErrorAction Stop).Source
$taskUrl = "http://localhost:$Port"
$taskProbeUrl = "http://127.0.0.1:$Port"
$taskRunning = $false
try {
    $taskInfo = Invoke-RestMethod -Uri "$taskProbeUrl/api/info" -TimeoutSec 2
    $taskRunning = $taskInfo.game -eq 'sugar-bubble-arena'
} catch { }
if (-not $taskRunning) {
    if (-not (Test-Path -LiteralPath (Join-Path $taskRoot 'node_modules/ws/package.json'))) {
        Push-Location -LiteralPath $taskRoot
        try { & npm.cmd ci --omit=dev --ignore-scripts --no-fund --no-audit; if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' } }
        finally { Pop-Location }
    }
    $env:PORT = "$Port"
    $taskServerPath = Join-Path $taskRoot 'server.mjs'
    $taskProcess = Start-Process -FilePath $taskNode -ArgumentList ('"' + $taskServerPath + '"') -WorkingDirectory $taskRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskLogRoot 'server.log') -RedirectStandardError (Join-Path $taskLogRoot 'server-error.log')
    Set-Content -LiteralPath (Join-Path $taskLogRoot 'server.pid') -Value $taskProcess.Id
    for ($taskAttempt = 0; $taskAttempt -lt 50; $taskAttempt++) {
        Start-Sleep -Milliseconds 100
        if ($taskProcess.HasExited) { throw "Server exited. See $taskLogRoot/server-error.log" }
        try { $taskInfo = Invoke-RestMethod -Uri "$taskProbeUrl/api/info" -TimeoutSec 3; $taskRunning = $taskInfo.game -eq 'sugar-bubble-arena'; if ($taskRunning) { break } } catch { }
    }
    if (-not $taskRunning) { throw "Server did not start. See $taskLogRoot/server-error.log" }
}
Write-Output "Sugar Bubble Arena is running: $taskUrl"
if (-not $NoBrowser) { Start-Process $taskUrl }

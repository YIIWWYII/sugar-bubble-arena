param([int]$Port=8787)
$ErrorActionPreference='Stop'
$taskRoot=$PSScriptRoot
$taskRuntime=Join-Path $taskRoot '.runtime'
New-Item -ItemType Directory -Force -Path (Join-Path $taskRuntime 'tools') | Out-Null
$taskTunnel=Join-Path $taskRuntime 'tools/cloudflared-windows-amd64.exe'
if (-not (Test-Path -LiteralPath $taskTunnel)) {
    $taskRelease=Invoke-RestMethod 'https://api.github.com/repos/cloudflare/cloudflared/releases/latest'
    $taskAsset=$taskRelease.assets | Where-Object name -eq 'cloudflared-windows-amd64.exe'
    Invoke-WebRequest -Uri $taskAsset.browser_download_url -OutFile $taskTunnel
    $taskDigest=(Get-FileHash -LiteralPath $taskTunnel -Algorithm SHA256).Hash.ToLower()
    if ($taskAsset.digest -ne "sha256:$taskDigest") { throw 'cloudflared release verification failed.' }
}
$taskTunnelPid=Join-Path $taskRuntime 'tunnel.pid'
$taskActive=$null
if(Test-Path -LiteralPath $taskTunnelPid){
    $taskOldPid=[int](Get-Content -LiteralPath $taskTunnelPid -Raw)
    $taskActive=Get-CimInstance Win32_Process -Filter "ProcessId = $taskOldPid" -ErrorAction SilentlyContinue
    if($taskActive -and $taskActive.ExecutablePath -ne $taskTunnel){$taskActive=$null}
}
if(-not $taskActive){
    $taskLog=Join-Path $taskRuntime 'tunnel-error.log'
    $taskProcess=Start-Process -FilePath $taskTunnel -ArgumentList "tunnel --url http://127.0.0.1:$Port --protocol http2 --no-autoupdate" -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskRuntime 'tunnel.log') -RedirectStandardError $taskLog
    Set-Content -LiteralPath $taskTunnelPid -Value $taskProcess.Id
    $taskPublicUrl=$null
    for($attempt=0;$attempt -lt 60;$attempt++){
        Start-Sleep -Seconds 1
        if($taskProcess.HasExited){throw "Tunnel failed. See $taskLog"}
        $taskMatch=[regex]::Match((Get-Content -LiteralPath $taskLog -Raw -ErrorAction SilentlyContinue),'https://[a-z0-9-]+\.trycloudflare\.com')
        if($taskMatch.Success){$taskPublicUrl=$taskMatch.Value;break}
    }
    if(-not $taskPublicUrl){throw "No public URL received. See $taskLog"}
    Set-Content -LiteralPath (Join-Path $taskRuntime 'public-url.txt') -Value $taskPublicUrl
}else{
    $taskPublicUrl=(Get-Content -LiteralPath (Join-Path $taskRuntime 'public-url.txt') -Raw).Trim()
}
# Preserve unrelated local settings. Public startup reloads the game so origin
# validation and Secure cookies use the new URL; running rounds will end.
$taskConfigPath=Join-Path $taskRuntime 'config.json'
$taskConfig=@{}
if(Test-Path -LiteralPath $taskConfigPath){
    (Get-Content -LiteralPath $taskConfigPath -Raw | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $taskConfig[$_.Name]=$_.Value }
}
$taskConfig.port=$Port;$taskConfig.publicOrigin=$taskPublicUrl
$taskConfig | ConvertTo-Json | Set-Content -LiteralPath $taskConfigPath -Encoding UTF8
& (Join-Path $taskRoot 'Stop-Game.ps1')
$env:PUBLIC_ORIGIN=$taskPublicUrl
& (Join-Path $taskRoot 'Start-Game.ps1') -Port $Port -NoBrowser
$taskServerPid=[int](Get-Content -LiteralPath (Join-Path $taskRuntime 'server.pid') -Raw)
$taskAwakeScript=Join-Path $taskRoot 'tools/Keep-Awake.ps1'
Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$taskAwakeScript`" -ServerProcessId $taskServerPid" -WindowStyle Hidden | Out-Null
Write-Output "Public game URL: $taskPublicUrl"
Write-Output 'Keep this computer powered and connected. The temporary URL changes when the tunnel restarts.'

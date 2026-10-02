param([int]$ServerProcessId)
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class GameAwake {
  [DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint flags);
}
'@
try {
    [GameAwake]::SetThreadExecutionState([uint32]2147483649) | Out-Null
    while (Get-Process -Id $ServerProcessId -ErrorAction SilentlyContinue) { Start-Sleep -Seconds 20 }
} finally { [GameAwake]::SetThreadExecutionState([uint32]2147483648) | Out-Null }

# Remove serviço PastaExplorer
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Rode como Administrador!" -ForegroundColor Red
    Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit 1
}
$taskName = "PastaExplorer"
Write-Host "Parando e removendo tarefa..." -ForegroundColor Yellow
schtasks /End /TN $taskName 2>$null | Out-Null
schtasks /Delete /TN $taskName /F 2>&1 | Out-Null
# remove atalho da Inicialização
$startup = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
$shortcutPath = Join-Path $startup "PastaExplorer.lnk"
if (Test-Path $shortcutPath) { Remove-Item $shortcutPath -Force; Write-Host "Atalho removido: $shortcutPath" -ForegroundColor Green }
Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*PastaExplorer*" -or $_.CommandLine -like "*app.py*" } | Stop-Process -Force -ErrorAction SilentlyContinue
# mata watchdog
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -like "*watchdog.ps1*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
taskkill /F /IM python.exe 2>&1 | Out-Null
Write-Host "✅ Removido (tarefa + atalho)" -ForegroundColor Green

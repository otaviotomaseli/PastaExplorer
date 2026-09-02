# PastaExplorer - Instala serviço de inicialização automática (Windows Task Scheduler)
# Uso: clique direito -> Executar com PowerShell como Administrador
# Ou: powershell -ExecutionPolicy Bypass -File service/install.ps1

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $here
$taskName = "PastaExplorer"
$watchdog = Join-Path $here "watchdog.ps1"
$logDir = Join-Path $here "logs"

# Verifica admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERRO: Rode como Administrador!" -ForegroundColor Red
    Write-Host "Clique direito -> Executar com PowerShell como Administrador" -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit 1
}

Write-Host "=== Instalando PastaExplorer ===" -ForegroundColor Cyan
Write-Host "Pasta: $root"
Write-Host "Watchdog: $watchdog"

# Verifica python
try { $py = python --version 2>&1; Write-Host "Python: $py" -ForegroundColor Green } catch { Write-Host "AVISO: python não encontrado no PATH" -ForegroundColor Yellow }

# Cria diretório de logs
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }

# Remove tarefa antiga se existir
schtasks /Delete /TN $taskName /F 2>$null | Out-Null

# Cria tarefa com múltiplos gatilhos: startup, logon, unlock, e reinício em falha
# Ação: powershell hidden executando watchdog.ps1
$action = "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$watchdog`""

# Tarefa para rodar como SYSTEM (não precisa senha) e com privilégio mais alto
# Usa schtasks com /RU SYSTEM e /RL HIGHEST
Write-Host "Criando tarefa agendada..." -ForegroundColor Yellow

$create = schtasks /Create /TN $taskName /TR "$action" /SC ONSTART /RU SYSTEM /RL HIGHEST /F 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Falha com ONSTART SYSTEM, tentando ONLOGON..." -ForegroundColor Yellow
    # Fallback: cria para o usuário atual (requer estar logado)
    $user = "$env:USERDOMAIN\$env:USERNAME"
    $create = schtasks /Create /TN $taskName /TR "$action" /SC ONLOGON /RU $user /RL HIGHEST /F 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Erro ao criar tarefa: $create" -ForegroundColor Red
        exit 1
    }
}

# Adiciona gatilho extra: ao desbloquear estação (via XML import para robustez)
# Configura reinício em falha a cada 1 minuto
try {
    $task = Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
    $settings = $task.Settings
    $settings.RestartCount = 3
    $settings.RestartInterval = "PT1M"
    $settings.ExecutionTimeLimit = "PT0S" # sem limite
    $settings.AllowHardTerminate = $true
    $settings.StartWhenAvailable = $true
    $settings.RunOnlyIfNetworkAvailable = $false
    $settings.WakeToRun = $true
    $settings.DisallowStartIfOnBatteries = $false
    $settings.StopIfGoingOnBatteries = $false
    Set-ScheduledTask -TaskName $taskName -Settings $settings | Out-Null
    Write-Host "Configurações de recuperação aplicadas (restart 1min, sem limite)" -ForegroundColor Green
} catch {
    Write-Host "Aviso: não foi possível ajustar recovery via PowerShell: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Cria atalho na pasta Inicialização como fallback (funciona sem admin, ao logar)
try {
    $startup = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
    $shortcutPath = Join-Path $startup "PastaExplorer.lnk"
    $WshShell = New-Object -ComObject WScript.Shell
    $shortcut = $WshShell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = "powershell.exe"
    $shortcut.Arguments = "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$watchdog`""
    $shortcut.WorkingDirectory = $root
    $shortcut.Description = "PastaExplorer AutoStart"
    $shortcut.Save()
    Write-Host "Atalho criado em: $shortcutPath" -ForegroundColor Green
} catch {
    Write-Host "Aviso: não foi possível criar atalho na Inicialização: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Inicia a tarefa agora
Write-Host "Iniciando serviço..." -ForegroundColor Yellow
schtasks /Run /TN $taskName 2>&1 | Out-Null
Start-Sleep -Seconds 2
$state = (schtasks /Query /TN $taskName /FO LIST /V 2>&1 | Select-String "Status")
Write-Host "Status: $state" -ForegroundColor Cyan

Write-Host "`n✅ Instalado com sucesso!" -ForegroundColor Green
Write-Host "• Inicia automaticamente ao ligar/reiniciar o servidor (Task Scheduler SYSTEM)" -ForegroundColor Gray
Write-Host "• Fallback: atalho na Inicialização também criado (ao logar)" -ForegroundColor Gray
Write-Host "• Reinicia sozinho se cair ou se a internet cair (watchdog loop 5s)" -ForegroundColor Gray
Write-Host "• Logs em: $logDir\pastaexplorer.log" -ForegroundColor Gray
Write-Host "• Para desinstalar: service/uninstall.ps1 (como Admin)" -ForegroundColor Gray
Write-Host "• Para ver status: schtasks /Query /TN PastaExplorer /FO LIST /V" -ForegroundColor Gray
Write-Host "`nTeste: abra http://localhost:5000" -ForegroundColor Yellow

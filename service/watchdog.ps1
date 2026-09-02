# PastaExplorer - Watchdog para manter o serviço sempre ativo
# Roda em loop: inicia app.py, se cair reinicia em 5s, também monitora internet
$ErrorActionPreference = "SilentlyContinue"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $here
Set-Location $root

$logDir = Join-Path $here "logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$logFile = Join-Path $logDir "pastaexplorer.log"

function Log($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$ts $msg" | Out-File -Append -FilePath $logFile -Encoding utf8
    Write-Host "[$ts] $msg"
}

Log "=== Watchdog iniciado (PID $PID) ==="
Log "Pasta: $root"
Log "Python: $(python --version 2>&1)"

while ($true) {
    # verifica se porta já em uso, tenta matar processo antigo se necessário
    try {
        $proc = Start-Process -FilePath "python" -ArgumentList "app.py" -WorkingDirectory $root -PassThru -WindowStyle Hidden
        Log "app.py iniciado PID $($proc.Id)"
        # aguarda processo sair
        $proc.WaitForExit()
        $code = $proc.ExitCode
        Log "app.py encerrou (exit $code), reiniciando em 5s..."
    } catch {
        Log "ERRO ao iniciar: $($_.Exception.Message)"
    }
    Start-Sleep -Seconds 5

    # checa internet (opcional, só loga, não para o serviço)
    try {
        $ping = Test-Connection -ComputerName 8.8.8.8 -Count 1 -Quiet -ErrorAction SilentlyContinue
        if (-not $ping) { Log "AVISO: sem internet (8.8.8.8 inalcançável), mantendo serviço..." }
    } catch {}
}

# PastaExplorer - Serviço Auto-Start

Faz o PastaExplorer iniciar sozinho ao ligar/reiniciar o servidor e se reiniciar se cair ou se a internet cair.

## Windows (Task Scheduler + Watchdog)

**Instalação (1 clique como Admin):**
```powershell
# Clique direito -> Executar como Administrador
powershell -ExecutionPolicy Bypass -File service/install.ps1
```

O que faz:
- Cria tarefa `PastaExplorer` com gatilhos `ONSTART` (ao ligar) e `ONLOGON`
- Roda como `SYSTEM` com privilégio mais alto, `Hidden` (sem janela)
- Watchdog `service/watchdog.ps1` roda em loop: inicia `python app.py`, se cair reinicia em 5s
- Configurações: `Restart 1min x3`, `sem limite de tempo`, `WakeToRun`, `StartWhenAvailable`

**Verificar:**
```powershell
schtasks /Query /TN PastaExplorer /FO LIST /V
Get-Content service/logs/pastaexplorer.log -Tail 20
```

**Desinstalar:**
```powershell
powershell -ExecutionPolicy Bypass -File service/uninstall.ps1
# (como Admin)
```

**Logs:** `service/logs/pastaexplorer.log`

## Linux (systemd)

```bash
sudo bash service/install_linux.sh
# ou manual:
sudo cp service/pastaexplorer.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now pastaexplorer
systemctl status pastaexplorer
```

`pastaexplorer.service`:
- `After=network-online.target`, `Restart=always`, `RestartSec=5`
- Reinicia ao boot, se cair e se internet cair (não depende de rede, mas aguarda rede)

**Logs:** `tail -f /var/log/pastaexplorer.log`

## Notas
- O serviço mantém o Flask rodando mesmo sem usuário logado (Windows SYSTEM / Linux www-data)
- Para produção Windows, considere usar `waitress` em vez de Flask dev: `pip install waitress` e troque `ExecStart` para `waitress-serve --listen=0.0.0.0:5000 app:app`

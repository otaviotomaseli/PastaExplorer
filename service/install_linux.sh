#!/bin/bash
# PastaExplorer - instala como systemd service (Linux)
# Uso: sudo bash service/install_linux.sh
set -e
HERE="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE_SRC="$HERE/service/pastaexplorer.service"
SERVICE_DST="/etc/systemd/system/pastaexplorer.service"
LOGFILE="/var/log/pastaexplorer.log"

if [ "$EUID" -ne 0 ]; then
  echo "Rode como root: sudo bash service/install_linux.sh"
  exit 1
fi

echo "=== Instalando PastaExplorer (Linux) ==="
echo "Origem: $HERE"

# Copia projeto para /opt se não estiver lá
if [ "$HERE" != "/opt/PastaExplorer" ]; then
  echo "Copiando para /opt/PastaExplorer..."
  mkdir -p /opt/PastaExplorer
  cp -r "$HERE"/* /opt/PastaExplorer/
  HERE="/opt/PastaExplorer"
fi

pip3 install -r "$HERE/requirements.txt"

# Ajusta service WorkingDirectory
sed -i "s|WorkingDirectory=.*|WorkingDirectory=$HERE|" "$SERVICE_SRC"
cp "$SERVICE_SRC" "$SERVICE_DST"

touch "$LOGFILE"
chmod 644 "$LOGFILE"

systemctl daemon-reload
systemctl enable pastaexplorer.service
systemctl restart pastaexplorer.service

echo "✅ Instalado!"
echo "• Status: systemctl status pastaexplorer"
echo "• Logs: tail -f /var/log/pastaexplorer.log"
echo "• Reinicia sozinho se cair, ao boot e se internet cair (Restart=always)"
echo "• Acesse http://localhost:5000"

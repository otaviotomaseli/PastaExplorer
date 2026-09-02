<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0078D4&height=180&section=header&text=PastaExplorer&fontSize=68&fontColor=ffffff&animation=fadeIn&desc=Explorador%20de%20Arquivos%20Web%20%E2%80%A2%20Windows%20%26%20Linux&descAlignY=75&descAlign=50" />

<p>
  <img src="https://img.shields.io/badge/Python-3.8%2B-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/Flask-3.1-000000?style=for-the-badge&logo=flask&logoColor=white" />
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20Linux-0078D4?style=for-the-badge&logo=windows&logoColor=white" />
  <img src="https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge" />
</p>

<p>
  <img src="https://img.shields.io/github/last-commit/otaviotomaseli/PastaExplorer?style=flat-square&color=0078D4" />
  <img src="https://img.shields.io/github/repo-size/otaviotomaseli/PastaExplorer?style=flat-square&color=22c55e" />
  <img src="https://img.shields.io/github/issues/otaviotomaseli/PastaExplorer?style=flat-square&color=ffb900" />
  <img src="https://img.shields.io/badge/PRs-welcome-ff006e?style=flat-square" />
</p>

**Acesse, gerencie e edite qualquer arquivo do seu PC pelo navegador — com a experiência do Windows Explorer, mas 100% web.**

[Começar](#-instalação-rápida) • [Funcionalidades](#-funcionalidades) • [Demonstração](#-demonstração) • [Segurança](#-segurança) • [API](#-api)

</div>

---

## 📖 Sobre

**PastaExplorer** é um explorador de arquivos web *self-hosted* que replica a experiência do **Windows Explorer** diretamente no navegador. Ao rodar no seu computador (Windows ou Linux), você acessa **todo o sistema de arquivos** via `http://localhost:5000` com login seguro, tema claro/escuro e proteção 2FA.

> Ideal para acessar seu PC remotamente, gerenciar servidores sem SSH, ou ter um "Google Drive" privado rodando na sua própria máquina.

---

## ✨ Funcionalidades

<table>
<tr>
<td width="50%">

### 🗂️ Navegação
- Árvore lateral com drives (`C:\`, `D:\`, `/`)
- Breadcrumb clicável
- Voltar / Avançar / Subir / Atualizar
- 3 modos: **Detalhes, Ícones e Lista**

### ✏️ Operações completas
- Criar pasta / arquivo
- Renomear, excluir, mover (arrastar e soltar)
- Copiar / Recortar / Colar
- Upload por botão ou arraste do SO
- Download (arquivo ou pasta .zip)
- Edição de texto no navegador

</td>
<td width="50%">

### 🔍 Produtividade
- Preview de imagens, PDFs e vídeos
- Busca recursiva com limite inteligente
- Propriedades e contagem de itens
- Atalhos: `Del`, `F2`, `Ctrl+C/X/V`
- Seleção múltipla com `Ctrl` / `Shift`
- Menu de contexto (clique direito)

### 🔐 Segurança de verdade
- Senha **nunca** em texto puro (hash `pbkdf2:sha256` / `scrypt`)
- Brute-force: 5 tentativas/min por IP
- **2FA TOTP** com QR Code (Google Authenticator, Authy)
- Login em **2 etapas** (senha → código)
- Sessão `HttpOnly`, `SameSite=Lax`, expiração 1h

</td>
</tr>
</table>

### 🎨 Extra
- **Tema claro/escuro** persistido (`localStorage` + `prefers-color-scheme`) — atalho `Ctrl+Shift+T`
- **Configurações ⚙️**: troca de senha e gerenciamento de 2FA sem reiniciar o servidor
- **Drag & Drop** entre pastas e do sistema operacional
- **Responsivo** e compatível com Windows e Linux

---

## 🎬 Demonstração

<div align="center">

| Login 2 Etapas | Explorer Claro | Explorer Escuro |
|---|---|---|
| Usuário/Senha → Código 2FA | Tema claro, detalhes e preview | Tema escuro, ícones e árvore |
| `https://i.imgur.com/8Km9tLL.png` | `https://i.imgur.com/8Km9tLL.png` | `https://i.imgur.com/8Km9tLL.png` |

> *Substitua os links acima por screenshots reais em `docs/screenshots/`*

**Fluxo de login:**
```
1. Acessa http://localhost:5000/login → digita Admin + senha
2. Se 2FA ativo → tela 2: "Olá, Admin. Digite o código de 6 dígitos"
3. Entra no Explorer → navega em C:\, D:\ ou / como no Windows
```

</div>

---

## 🧱 Tecnologias

| Camada | Stack |
|---|---|
| **Backend** | Python 3.8+, Flask 3.1, Werkzeug (hash), pyotp (TOTP), qrcode + Pillow (QR) |
| **Frontend** | HTML5, CSS3 (variáveis + `data-theme`), Vanilla JS (sem build) |
| **Auth** | `instance/auth.json` + `.env` (prioridade auth.json), `python-dotenv` |
| **Infra** | Windows / Linux, 0 dependências de build |

---

## 🚀 Instalação Rápida

```bash
# 1. Clone
git clone https://github.com/otaviotomaseli/PastaExplorer.git
cd PastaExplorer

# 2. Instale
pip install -r requirements.txt
# ou
pip3 install -r requirements.txt

# 3. Rode
python app.py
# abre http://localhost:5000
```

**Primeiro acesso:** `Admin` / senha definida em `.env` (`PASTAEXPLORER_PASS_HASH`)

> Para trocar a senha sem editar arquivo: `python set_password.py` ou no app em **⚙️ Configurações → Senha**

---

## 📦 Instalação Detalhada

### Windows
```bat
run.bat
:: ou manualmente
pip install -r requirements.txt
python app.py
```

### Linux / macOS
```bash
chmod +x run.sh
./run.sh
# ou
pip3 install -r requirements.txt
python3 app.py
```

### Variáveis de ambiente (`.env`)

| Variável | Descrição | Exemplo |
|---|---|---|
| `PASTAEXPLORER_USER` | Usuário | `Admin` |
| `PASTAEXPLORER_PASS_HASH` | Hash Werkzeug (nunca senha pura) | `pbkdf2:sha256:1000000$...` |
| `PASTAEXPLORER_SECRET` | Chave Flask (`secrets.token_hex(32)`) | `aaf6711...` |
| `PORT` / `HOST` | Porta e host | `5000` / `0.0.0.0` |
| `PASTAEXPLORER_HTTPS` | `1` para `Secure` cookie em HTTPS | `0` |

Gere um `.env` seguro:
```bash
python set_password.py
# pede usuário, senha, gera hash + SECRET + 2FA reset
```

### 🔄 Serviço Auto-Start (reinicia sozinho)

**Windows (recomendado):**
```bat
# 1 clique como Administrador:
service\install.bat
# ou
powershell -ExecutionPolicy Bypass -File service/install.ps1
```
Cria tarefa **PastaExplorer** (`SYSTEM`, `ONSTART`, `HIGHEST`) + atalho na Inicialização. Watchdog `service/watchdog.ps1` mantém `python app.py` vivo (reinicia em 5s se cair, loga perda de internet).

- Ver: `schtasks /Query /TN PastaExplorer /FO LIST /V` e `service/logs/pastaexplorer.log`
- Remover: `service\uninstall.bat` (como Admin)

**Fallback sem Admin:** atalho em `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\PastaExplorer.lnk` já criado — inicia ao logar.

**Linux (systemd):**
```bash
sudo bash service/install_linux.sh
sudo systemctl status pastaexplorer
tail -f /var/log/pastaexplorer.log
```
`Restart=always`, `After=network-online.target` — inicia ao boot, se cair ou se a internet cair.

Veja `service/README.md` para detalhes.

---

## ⚙️ Configurações (botão ⚙️ no Explorer)

<div align="center">
<img src="https://img.shields.io/badge/Configura%C3%A7%C3%B5es-2_abas-0078D4?style=flat-square" />
</div>

**Aba Senha:**
1. Informe *Senha atual* + *Nova senha* (mín. 6) + *Confirmar*
2. Salva hash em `instance/auth.json` instantaneamente

**Aba 2FA:**
- **Desativado:** `Gerar QR Code` → escaneie no Google Authenticator / Authy / Microsoft Authenticator → digite código de 6 dígitos → `Ativar 2FA`
- **Ativado:** mostra `Ativo ✅` → para desativar informe *Senha atual* + *Código 2FA atual* → `Desativar`

> O login passa a ser em 2 etapas: `usuário/senha` → `código 2FA` (tela separada)

---

## 🔌 API

Todas as rotas `/api/*` exigem `session` autenticada (exceto `/api/check_auth` e `POST /login`).

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/drives` | Lista drives / raízes |
| `GET` | `/api/list?path=` | Lista pasta |
| `POST` | `/api/mkdir` | `{"path","name"}` cria pasta |
| `POST` | `/api/mkfile` | `{"path","name"}` cria arquivo |
| `POST` | `/api/delete` | `{"path"}` exclui |
| `POST` | `/api/rename` | `{"path","newName"}` |
| `POST` | `/api/move` | `{"src","dest"}` |
| `POST` | `/api/copy` | `{"src","dest"}` |
| `POST` | `/api/upload` | `multipart` `files` + `path` |
| `GET` | `/api/download?path=` | Arquivo ou pasta .zip |
| `GET` | `/api/read?path=` | Conteúdo texto (≤5MB) |
| `POST` | `/api/write` | `{"path","content"}` |
| `GET` | `/api/info?path=` | Metadados |
| `GET` | `/api/search?path=&q=` | Busca recursiva (limite 100) |
| `GET` | `/api/settings` | `{username, totp_enabled}` |
| `POST` | `/api/settings/password` | Troca senha |
| `POST` | `/api/settings/2fa/setup` | Gera secret + QR |
| `POST` | `/api/settings/2fa/enable` | `{"code"}` ativa |
| `POST` | `/api/settings/2fa/disable` | `{"password","code"}` desativa |

---

## 🔒 Segurança

- **Hash, não texto:** `werkzeug.security.generate_password_hash` (`pbkdf2:sha256` ou `scrypt`) em `instance/auth.json` (prioridade) ou `.env`. `.env` e `instance/` estão no `.gitignore`
- **2FA TOTP:** `pyotp` com janela `valid_window=1`, QR via `qrcode` + `Pillow`, `otpauth://` provisioning URI
- **Sessão:** `HttpOnly`, `SameSite=Lax`, `Secure` se `PASTAEXPLORER_HTTPS=1`, expiração 1h
- **Brute-force:** 5 tentativas/min por IP com bloqueio 60s
- **Acesso total:** o app expõe **todo** o disco — rode apenas em rede confiável ou atrás de proxy com TLS (Nginx/Caddy)
- **Dica produção:** use `gunicorn` + `nginx` + `https` + `PASTAEXPLORER_HTTPS=1` + firewall

---

## 📁 Estrutura

```
PastaExplorer/
├── app.py                 # Flask + rotas + 2FA + brute-force
├── auth_store.py          # instance/auth.json (load/save)
├── config.py              # .env, SECRET_KEY, hash fallback
├── set_password.py        # CLI para gerar hash + SECRET
├── requirements.txt
├── run.bat / run.sh
├── instance/              # não commitado
│   └── auth.json          # {username, password_hash, totp_secret, totp_enabled}
├── templates/
│   ├── login.html         # 2 etapas + tema
│   └── explorer.html      # explorer + ⚙️ configurações + tema
└── static/
    ├── css/style.css      # variáveis + [data-theme="dark"]
    └── js/explorer.js     # árvore, drag-drop, busca, settings
```

---

## 🗺️ Roadmap

- [x] Tema claro/escuro
- [x] 2FA TOTP + QR + login 2 etapas
- [x] Troca de senha via UI
- [ ] Preview de vídeo/áudio inline
- [ ] Compartilhamento via link temporário
- [ ] Docker + `docker-compose.yml`

---

## 🤝 Contribuindo

Contribuições são bem-vindas!

1. Fork o projeto
2. Crie sua branch: `git checkout -b feat/minha-feature`
3. Commit: `git commit -m 'feat: minha feature'`
4. Push: `git push origin feat/minha-feature`
5. Abra um Pull Request

Veja `CONTRIBUTING.md` e `SECURITY.md`.

---

## 📄 Licença

Distribuído sob **MIT**. Veja `LICENSE`.

---

<div align="center">

**Feito com ❤️ por [otaviotomaseli](https://github.com/otaviotomaseli)**

*Se este projeto te ajudou, deixe uma ⭐ no repositório!*

<img src="https://capsule-render.vercel.app/api?type=waving&color=0078D4&height=120&section=footer&text=&fontSize=0" />

</div>

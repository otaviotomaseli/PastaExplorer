# PastaExplorer

Explorador de arquivos web estilo Windows Explorer. Funciona em **Windows e Linux**, com acesso total ao sistema de arquivos do computador onde roda.

## Funcionalidades
- Login protegido por hash (pbkdf2/scrypt) + brute-force limit + 2FA TOTP
- Tema claro/escuro (persistido)
- Botão ⚙️ Configurações: trocar senha e gerenciar 2FA
- Navegação completa (drives, pastas, breadcrumb, voltar/avançar/subir)
- Criar pasta / arquivo, renomear, excluir, mover (arrastar), copiar, colar
- Upload por botão ou arrastar do SO
- Download (arquivo ou pasta zipada)
- Edição de arquivos de texto direto no navegador
- Visualização de imagens, busca, preview/propriedades
- Atalhos: Del, F2, Ctrl+C/X/V, clique, Ctrl+clique, Shift+clique
- Três modos de visualização: Detalhes, Ícones, Lista

## Instalação
```bash
pip install -r requirements.txt
```

## Rodar
```bash
python app.py
# abre http://localhost:5000
# login definido no .env (padrão inicial: Admin / senha do .env)
# para trocar: python set_password.py
```

Variáveis de ambiente (.env):
- `PASTAEXPLORER_USER` (usuário)
- `PASTAEXPLORER_PASS_HASH` (hash Werkzeug, nunca senha pura)
- `PASTAEXPLORER_SECRET` (chave Flask, gere com secrets.token_hex(32))
- `PORT` / `HOST` / `PASTAEXPLORER_HTTPS=1` (para HTTPS)

## Configurações (botão ⚙️ no explorador)
- **Trocar senha:** aba Senha → informe senha atual + nova (mín. 6 chars) → salva hash em `instance/auth.json`
- **2FA TOTP:** aba 2FA → Gerar QR Code → escaneie no Google Authenticator/Authy/Microsoft Authenticator → digite código de 6 dígitos para ativar. Depois todo login pedirá código. Para desativar, informe senha + código atual.

APIs: `GET /api/settings`, `POST /api/settings/password`, `POST /api/settings/2fa/setup`, `POST /api/settings/2fa/enable`, `POST /api/settings/2fa/disable`

## Estrutura
```
app.py
auth_store.py        # auth.json + 2FA
config.py
templates/login.html   # suporta campo 2FA
templates/explorer.html # botão tema + configurações
static/css/style.css
static/js/explorer.js
instance/auth.json   # gerado, não commitado (hash + totp_secret)
```

## Segurança
- Senha NUNCA em texto puro: hash pbkdf2/scrypt em `.env` ou `instance/auth.json` (prioridade: auth.json > .env)
- `.env` e `instance/` estão no `.gitignore`
- Use `python set_password.py` ou o botão Configurações → Senha
- 2FA TOTP (pyotp) com QR code (qrcode+Pillow), janela de 30s+drift, desativação exige senha+código
- Sessão com `HttpOnly`, `SameSite=Lax`, expiração 1h, e `Secure` se `PASTAEXPLORER_HTTPS=1`
- Brute-force: 5 tentativas/min por IP
- Todas as rotas `/api/*` exigem login
- Acesso total ao disco — rode apenas em rede confiável ou atrás de proxy com HTTPS

# Segurança

## Versões suportadas

| Versão | Suporte |
|---|---|
| main | ✅ |

## Reportar vulnerabilidade

**Não abra issue pública para vulnerabilidades críticas.** Envie e-mail para `otaviotomazelids123@gmail.com` com assunto `[SECURITY] PastaExplorer` e descrição detalhada. Responderemos em até 72h.

## Modelo de ameaça

PastaExplorer expõe **todo o sistema de arquivos** do host. Por isso:

- Use apenas em rede confiável ou atrás de proxy com TLS
- Defina `PASTAEXPLORER_SECRET` forte (`secrets.token_hex(32)`)
- Ative 2FA (`⚙️ Configurações → 2FA`)
- Em produção: `PASTAEXPLORER_HTTPS=1`, `DEBUG=False`, rode com `gunicorn` + `nginx`

## Armazenamento de credenciais

- Senha é hash `pbkdf2:sha256`/`scrypt` via `werkzeug` em `instance/auth.json` ou `.env`
- `instance/` e `.env` estão no `.gitignore` e nunca devem ser commitados
- Troca de senha via UI ou `python set_password.py` gera novo hash

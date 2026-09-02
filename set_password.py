#!/usr/bin/env python3
"""Gera hash seguro e atualiza .env - NUNCA armazena senha em texto puro"""
import getpass
import secrets
from pathlib import Path

try:
    from werkzeug.security import generate_password_hash
except ImportError:
    print("Instale: pip install Werkzeug")
    raise

env_path = Path(__file__).parent / ".env"

user = input("Usuário [Admin]: ").strip() or "Admin"
pwd = getpass.getpass("Nova senha: ").strip()
if not pwd:
    print("Senha vazia, abortado.")
    raise SystemExit(1)
pwd2 = getpass.getpass("Confirme a senha: ").strip()
if pwd != pwd2:
    print("Senhas não conferem.")
    raise SystemExit(1)

hash_val = generate_password_hash(pwd, method="pbkdf2:sha256")
secret = secrets.token_hex(32)

# lê .env existente se houver
existing = {}
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k,v = line.split("=",1)
            existing[k.strip()] = v.strip()

existing["PASTAEXPLORER_SECRET"] = secret
existing["PASTAEXPLORER_USER"] = user
existing["PASTAEXPLORER_PASS_HASH"] = hash_val

# preserva comentários básicos + escreve
out = f"""# PastaExplorer - credenciais seguras
# Gerado por set_password.py - NÃO compartilhe
PASTAEXPLORER_SECRET={secret}
PASTAEXPLORER_USER={user}
PASTAEXPLORER_PASS_HASH={hash_val}
"""
if "PORT" in existing:
    out += f"PORT={existing['PORT']}\n"
if "HOST" in existing:
    out += f"HOST={existing['HOST']}\n"

env_path.write_text(out, encoding="utf-8")
print(f"\nOK! Hash gerado e salvo em {env_path}")
print("Reinicie o app: python app.py")
print("A senha NÃO ficou salva em texto puro, apenas o hash.")

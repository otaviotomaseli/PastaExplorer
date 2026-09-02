import json
import os
from pathlib import Path

import config

AUTH_PATH = Path(__file__).parent / "instance" / "auth.json"

def _load_raw():
    if AUTH_PATH.exists():
        try:
            return json.loads(AUTH_PATH.read_text(encoding="utf-8"))
        except:
            pass
    return {}

def load_auth():
    raw = _load_raw()
    # prioridade: auth.json > env/.env > config hardcoded
    username = raw.get("username") or os.environ.get("PASTAEXPLORER_USER") or config.USERNAME
    password_hash = raw.get("password_hash") or os.environ.get("PASTAEXPLORER_PASS_HASH") or config.PASSWORD_HASH
    totp_secret = raw.get("totp_secret")  # pode ser None
    # fallback para env se não tem no json mas tem no env
    if not totp_secret:
        totp_secret = os.environ.get("PASTAEXPLORER_TOTP_SECRET")
    totp_enabled = raw.get("totp_enabled")
    if totp_enabled is None:
        totp_enabled = os.environ.get("PASTAEXPLORER_TOTP_ENABLED", "0") == "1"
    else:
        totp_enabled = bool(totp_enabled)
    # se não tem secret, desativa
    if not totp_secret:
        totp_enabled = False
    return {
        "username": username,
        "password_hash": password_hash,
        "totp_secret": totp_secret,
        "totp_enabled": totp_enabled,
    }

def save_auth(**updates):
    """Atualiza apenas campos passados. Use totp_secret='' para limpar."""
    data = _load_raw()
    # garante defaults existentes se arquivo vazio
    if not data:
        cur = load_auth()
        data = {
            "username": cur["username"],
            "password_hash": cur["password_hash"],
            "totp_secret": cur["totp_secret"],
            "totp_enabled": cur["totp_enabled"],
        }
    for k, v in updates.items():
        if k == "totp_secret" and v == "":
            data["totp_secret"] = None
            data["totp_enabled"] = False
        else:
            data[k] = v
    # se remover secret, desativa
    if not data.get("totp_secret"):
        data["totp_enabled"] = False
    AUTH_PATH.parent.mkdir(parents=True, exist_ok=True)
    AUTH_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    try:
        os.chmod(AUTH_PATH, 0o600)
    except:
        pass
    return load_auth()

def is_2fa_enabled():
    return load_auth().get("totp_enabled", False)

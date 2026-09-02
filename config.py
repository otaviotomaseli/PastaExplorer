import os
import secrets

# Carrega .env se existir (não obrigatório, mas recomendado)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# SECRET_KEY: nunca deixe o default em produção - gere um aleatório se não estiver no .env
_default_secret = os.environ.get("PASTAEXPLORER_SECRET")
if _default_secret:
    SECRET_KEY = _default_secret
else:
    # gera uma chave efêmera e avisa
    SECRET_KEY = secrets.token_hex(32)

# Usuário - lido do .env, fallback Admin apenas para primeiro acesso
USERNAME = os.environ.get("PASTAEXPLORER_USER", "Admin")

# Senha criptografada com Werkzeug (pbkdf2:sha256 / scrypt)
# NUNCA armazene a senha em texto puro. Hash gerado via set_password.py
_DEFAULT_HASH = "pbkdf2:sha256:1000000$hiFkZIwlXVXwDVnj$1e29a99174dafecc9913486adb81fe50d1326a02254ba8254be73f978199c1a4"
PASSWORD_HASH = os.environ.get("PASTAEXPLORER_PASS_HASH", _DEFAULT_HASH)

PORT = int(os.environ.get("PORT", 5000))
HOST = os.environ.get("HOST", "0.0.0.0")
DEBUG = False  # desative debug em produção para não expor stack traces

# Segurança de sessão
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
# Em produção com HTTPS, defina PASTAEXPLORER_HTTPS=1 para ativar SECURE
SESSION_COOKIE_SECURE = os.environ.get("PASTAEXPLORER_HTTPS", "0") == "1"
PERMANENT_SESSION_LIFETIME = 3600  # 1h

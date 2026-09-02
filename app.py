import os
import sys
import shutil
import mimetypes
import platform
import string
from pathlib import Path
from datetime import datetime
from functools import wraps

from flask import Flask, request, jsonify, session, redirect, url_for, render_template, send_file, abort
from werkzeug.security import check_password_hash, generate_password_hash

import config
import auth_store

try:
    import pyotp
    HAS_PYOTP = True
except ImportError:
    HAS_PYOTP = False

app = Flask(__name__)
app.secret_key = config.SECRET_KEY
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB upload
app.config['SESSION_COOKIE_HTTPONLY'] = config.SESSION_COOKIE_HTTPONLY
app.config['SESSION_COOKIE_SAMESITE'] = config.SESSION_COOKIE_SAMESITE
app.config['SESSION_COOKIE_SECURE'] = config.SESSION_COOKIE_SECURE
app.config['PERMANENT_SESSION_LIFETIME'] = config.PERMANENT_SESSION_LIFETIME

# Proteção simples contra brute-force (em memória)
_login_attempts = {}  # ip -> {count, last}

# ---------- helpers ----------
def is_authenticated():
    return session.get("logged_in") is True

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not is_authenticated():
            if request.path.startswith("/api/"):
                return jsonify({"error": "Não autenticado"}), 401
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated

def get_drives():
    """Retorna drives/raízes dependendo do SO"""
    system = platform.system()
    drives = []
    if system == "Windows":
        for letter in string.ascii_uppercase:
            drive = f"{letter}:\\"
            if os.path.exists(drive):
                try:
                    # try to get label
                    drives.append({"path": drive, "name": f"Disco Local ({letter}:)", "type": "drive"})
                except:
                    drives.append({"path": drive, "name": f"{letter}:\\", "type": "drive"})
        # fallback se nenhum encontrado
        if not drives:
            drives.append({"path": "C:\\", "name": "C:\\", "type": "drive"})
    else:
        # Linux / macOS
        drives.append({"path": "/", "name": "Sistema (/)", "type": "drive"})
        # try to list mounted points
        try:
            for p in Path("/").iterdir():
                # common mount points
                pass
        except: pass
        # add home
        home = str(Path.home())
        if home != "/":
            drives.append({"path": home, "name": f"Home ({home})", "type": "drive"})
    return drives

def safe_path(p):
    """Normaliza path, resolve . and .. mas permite acesso total"""
    if not p:
        drives = get_drives()
        return drives[0]["path"] if drives else ("/" if platform.system() != "Windows" else "C:\\")
    # remove null bytes
    p = p.replace("\x00", "")
    # expand user
    p = os.path.expanduser(p)
    # normalize
    p = os.path.normpath(p)
    # on windows, ensure drive letter upper
    return p

def file_info(path: Path):
    try:
        stat = path.stat()
        is_dir = path.is_dir()
        size = stat.st_size if not is_dir else 0
        mtime = datetime.fromtimestamp(stat.st_mtime).isoformat()
        ext = path.suffix.lower() if not is_dir else ""
        return {
            "name": path.name,
            "path": str(path),
            "is_dir": is_dir,
            "size": size,
            "size_human": human_size(size) if not is_dir else "",
            "mtime": mtime,
            "mtime_human": datetime.fromtimestamp(stat.st_mtime).strftime("%d/%m/%Y %H:%M"),
            "ext": ext,
            "hidden": path.name.startswith(".") if platform.system() != "Windows" else False,
        }
    except Exception as e:
        return {
            "name": path.name,
            "path": str(path),
            "is_dir": False,
            "size": 0,
            "size_human": "",
            "mtime": "",
            "mtime_human": "",
            "ext": "",
            "hidden": False,
            "error": str(e)
        }

def human_size(n):
    for unit in ["B","KB","MB","GB","TB"]:
        if n < 1024:
            return f"{n:.1f} {unit}" if unit != "B" else f"{n} B"
        n /= 1024
    return f"{n:.1f} PB"

def list_dir(dir_path):
    p = Path(safe_path(dir_path))
    if not p.exists():
        return None, f"Caminho não existe: {p}"
    if not p.is_dir():
        return None, f"Não é uma pasta: {p}"
    try:
        items = []
        # try to list, handle permission errors per item
        for entry in os.scandir(p):
            try:
                ep = Path(entry.path)
                info = file_info(ep)
                # try to check if dir is accessible
                items.append(info)
            except PermissionError:
                items.append({"name": entry.name, "path": entry.path, "is_dir": entry.is_dir(), "size": 0, "size_human": "", "mtime": "", "mtime_human": "", "ext": "", "hidden": False, "error": "Sem permissão"})
            except Exception as e:
                items.append({"name": entry.name, "path": entry.path, "is_dir": False, "size": 0, "size_human": "", "mtime": "", "mtime_human": "", "ext": "", "hidden": False, "error": str(e)})
        # sort: folders first, then files, alphabetically
        items.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
        parent = str(p.parent) if str(p) != str(p.parent) else None
        # for windows root like C:\, parent is C:\ itself, so set None
        if platform.system() == "Windows" and len(str(p)) == 3 and str(p)[1] == ":":
            parent = None
        return {
            "current": str(p),
            "parent": parent,
            "items": items,
            "count": len(items)
        }, None
    except PermissionError as e:
        return None, f"Sem permissão: {e}"
    except Exception as e:
        return None, str(e)

# ---------- helpers 2FA ----------
def verify_totp(secret, code):
    if not HAS_PYOTP or not secret or not code:
        return False
    try:
        totp = pyotp.TOTP(secret)
        # janela 1 para tolerar 30s de drift
        return totp.verify(str(code).strip(), valid_window=1)
    except:
        return False

def get_totp_uri(secret, username):
    if not HAS_PYOTP:
        return ""
    try:
        totp = pyotp.TOTP(secret)
        return totp.provisioning_uri(name=username, issuer_name="PastaExplorer")
    except:
        return ""

def generate_qr_base64(data):
    try:
        import qrcode
        import io, base64
        qr = qrcode.QRCode(version=1, box_size=6, border=2)
        qr.add_data(data)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode()
        return f"data:image/png;base64,{b64}"
    except Exception as e:
        return ""

# ---------- routes: pages ----------
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        # brute-force: limite 5 tentativas por minuto por IP
        ip = request.remote_addr or "unknown"
        now = datetime.now().timestamp()
        rec = _login_attempts.get(ip, {"count": 0, "last": 0})
        if now - rec["last"] > 60:
            rec = {"count": 0, "last": now}
        if rec["count"] >= 5:
            return jsonify({"error": "Muitas tentativas. Aguarde 1 minuto."}), 429

        data = request.get_json(silent=True) or request.form
        user = (data.get("username") or data.get("user") or "").strip()
        pwd = data.get("password") or data.get("pass") or ""
        code = (data.get("code") or data.get("totp") or data.get("2fa") or "").strip()

        auth = auth_store.load_auth()
        user_ok = (user == auth["username"])
        pass_ok = check_password_hash(auth["password_hash"], pwd)

        if not (user_ok and pass_ok):
            rec["count"] += 1
            rec["last"] = now
            _login_attempts[ip] = rec
            if request.is_json:
                return jsonify({"error": "Usuário ou senha inválidos"}), 401
            return render_template("login.html", error="Usuário ou senha inválidos")

        # senha ok - verifica 2FA se ativado
        if auth.get("totp_enabled") and auth.get("totp_secret"):
            if not HAS_PYOTP:
                return jsonify({"error": "2FA configurado mas servidor sem pyotp"}), 500
            if not code:
                # pede segundo fator sem consumir tentativa
                return jsonify({"need_2fa": True, "msg": "Código 2FA necessário"}), 401
            if not verify_totp(auth["totp_secret"], code):
                rec["count"] += 1
                rec["last"] = now
                _login_attempts[ip] = rec
                return jsonify({"error": "Código 2FA inválido"}), 401

        _login_attempts.pop(ip, None)
        session.clear()
        session["logged_in"] = True
        session["username"] = user
        session.permanent = True
        if request.is_json:
            return jsonify({"ok": True})
        return redirect(url_for("index"))
    if is_authenticated():
        return redirect(url_for("index"))
    # passa flag se 2FA está ativo para o template saber se deve mostrar campo
    auth = auth_store.load_auth()
    return render_template("login.html", need_2fa=auth.get("totp_enabled", False))

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))

@app.route("/")
@login_required
def index():
    return render_template("explorer.html", username=session.get("username", "Admin"))

# ---------- API ----------
@app.route("/api/check_auth")
def check_auth():
    return jsonify({"authenticated": is_authenticated()})

@app.route("/api/drives")
@login_required
def api_drives():
    return jsonify(get_drives())

@app.route("/api/list")
@login_required
def api_list():
    path = request.args.get("path", "")
    if not path:
        # default to first drive
        drives = get_drives()
        path = drives[0]["path"]
    data, err = list_dir(path)
    if err:
        return jsonify({"error": err, "current": path}), 400
    return jsonify(data)

@app.route("/api/mkdir", methods=["POST"])
@login_required
def api_mkdir():
    data = request.get_json()
    base = safe_path(data.get("path", ""))
    name = data.get("name", "Nova pasta")
    # sanitize name
    name = name.strip().replace("/", "").replace("\\", "")
    if not name:
        return jsonify({"error": "Nome inválido"}), 400
    target = Path(base) / name
    try:
        target.mkdir(parents=False, exist_ok=False)
        return jsonify({"ok": True, "path": str(target)})
    except FileExistsError:
        return jsonify({"error": "Já existe"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/mkfile", methods=["POST"])
@login_required
def api_mkfile():
    data = request.get_json()
    base = safe_path(data.get("path", ""))
    name = data.get("name", "Novo arquivo.txt")
    name = name.strip().replace("/", "").replace("\\", "")
    if not name:
        return jsonify({"error": "Nome inválido"}), 400
    target = Path(base) / name
    try:
        if target.exists():
            return jsonify({"error": "Já existe"}), 400
        target.touch(exist_ok=False)
        return jsonify({"ok": True, "path": str(target)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/delete", methods=["POST"])
@login_required
def api_delete():
    data = request.get_json()
    path = safe_path(data.get("path", ""))
    if not path or path in ["C:\\", "C:/", "/"]:
        return jsonify({"error": "Não pode excluir raiz"}), 400
    p = Path(path)
    if not p.exists():
        return jsonify({"error": "Não existe"}), 404
    try:
        if p.is_dir():
            shutil.rmtree(p)
        else:
            p.unlink()
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/rename", methods=["POST"])
@login_required
def api_rename():
    data = request.get_json()
    path = safe_path(data.get("path", ""))
    new_name = data.get("newName") or data.get("new_name") or ""
    new_name = new_name.strip().replace("/", "").replace("\\", "")
    if not new_name:
        return jsonify({"error": "Nome inválido"}), 400
    p = Path(path)
    if not p.exists():
        return jsonify({"error": "Não existe"}), 404
    target = p.parent / new_name
    if target.exists():
        return jsonify({"error": "Já existe um arquivo/pasta com esse nome"}), 400
    try:
        p.rename(target)
        return jsonify({"ok": True, "newPath": str(target)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/move", methods=["POST"])
@login_required
def api_move():
    data = request.get_json()
    src = safe_path(data.get("src", ""))
    dest = safe_path(data.get("dest", ""))
    # dest is target folder
    s = Path(src)
    d = Path(dest)
    if not s.exists():
        return jsonify({"error": "Origem não existe"}), 404
    if not d.exists() or not d.is_dir():
        return jsonify({"error": "Destino não é pasta"}), 400
    # prevent moving into itself
    try:
        if s.resolve() == d.resolve() or str(d.resolve()).startswith(str(s.resolve()) + os.sep):
            return jsonify({"error": "Não pode mover pasta para dentro dela mesma"}), 400
    except: pass
    target = d / s.name
    if target.exists():
        return jsonify({"error": "Já existe no destino"}), 400
    try:
        shutil.move(str(s), str(target))
        return jsonify({"ok": True, "newPath": str(target)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/copy", methods=["POST"])
@login_required
def api_copy():
    data = request.get_json()
    src = safe_path(data.get("src", ""))
    dest = safe_path(data.get("dest", ""))
    s = Path(src)
    d = Path(dest)
    if not s.exists():
        return jsonify({"error": "Origem não existe"}), 404
    if not d.exists() or not d.is_dir():
        return jsonify({"error": "Destino não é pasta"}), 400
    target = d / s.name
    # if exists, create copy name
    if target.exists():
        base = target.stem
        suffix = target.suffix
        counter = 1
        while target.exists():
            if s.is_dir():
                target = d / f"{s.name} - cópia ({counter})"
            else:
                target = d / f"{base} - cópia ({counter}){suffix}"
            counter += 1
    try:
        if s.is_dir():
            shutil.copytree(s, target)
        else:
            shutil.copy2(s, target)
        return jsonify({"ok": True, "newPath": str(target)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/upload", methods=["POST"])
@login_required
def api_upload():
    dest = safe_path(request.form.get("path", "") or request.args.get("path", ""))
    d = Path(dest)
    if not d.exists() or not d.is_dir():
        return jsonify({"error": "Destino inválido"}), 400
    files = request.files.getlist("files") or request.files.getlist("file")
    if not files:
        return jsonify({"error": "Nenhum arquivo enviado"}), 400
    saved = []
    errors = []
    for f in files:
        if f.filename == "":
            continue
        # secure filename but keep original as much as possible
        filename = os.path.basename(f.filename)
        target = d / filename
        # avoid overwrite: create numbered copy
        if target.exists():
            base = target.stem
            suffix = target.suffix
            counter = 1
            while target.exists():
                target = d / f"{base} ({counter}){suffix}"
                counter += 1
        try:
            f.save(str(target))
            saved.append(str(target))
        except Exception as e:
            errors.append(f"{filename}: {e}")
    if errors and not saved:
        return jsonify({"error": "; ".join(errors)}), 500
    return jsonify({"ok": True, "saved": saved, "errors": errors})

@app.route("/api/download")
@login_required
def api_download():
    path = safe_path(request.args.get("path", ""))
    p = Path(path)
    if not p.exists():
        return jsonify({"error": "Não existe"}), 404
    if p.is_dir():
        # zip the folder on the fly
        import tempfile, zipfile
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
        tmp.close()
        try:
            with zipfile.ZipFile(tmp.name, 'w', zipfile.ZIP_DEFLATED) as z:
                for root, dirs, files in os.walk(p):
                    for file in files:
                        full = os.path.join(root, file)
                        arc = os.path.relpath(full, p.parent)
                        try:
                            z.write(full, arc)
                        except: pass
            return send_file(tmp.name, as_attachment=True, download_name=p.name + ".zip")
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    else:
        try:
            return send_file(str(p), as_attachment=True)
        except Exception as e:
            return jsonify({"error": str(e)}), 500

@app.route("/api/read")
@login_required
def api_read():
    path = safe_path(request.args.get("path", ""))
    p = Path(path)
    if not p.exists() or p.is_dir():
        return jsonify({"error": "Arquivo não encontrado"}), 404
    # limit size to 5MB for editing
    try:
        if p.stat().st_size > 5 * 1024 * 1024:
            return jsonify({"error": "Arquivo muito grande para editar (>5MB). Faça download."}), 400
        # try utf-8
        try:
            content = p.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            content = p.read_text(encoding="latin-1")
        return jsonify({"ok": True, "content": content, "path": str(p)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/write", methods=["POST"])
@login_required
def api_write():
    data = request.get_json()
    path = safe_path(data.get("path", ""))
    content = data.get("content", "")
    p = Path(path)
    # if path is dir, error
    if p.is_dir():
        return jsonify({"error": "É uma pasta"}), 400
    try:
        # ensure parent exists
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/info")
@login_required
def api_info():
    path = safe_path(request.args.get("path", ""))
    p = Path(path)
    if not p.exists():
        return jsonify({"error": "Não existe"}), 404
    info = file_info(p)
    # add extra
    try:
        if p.is_dir():
            # count items
            try:
                count = len(list(os.scandir(p)))
                info["items_count"] = count
            except:
                info["items_count"] = 0
        else:
            info["mime"] = mimetypes.guess_type(str(p))[0] or "desconhecido"
    except: pass
    return jsonify(info)

@app.route("/api/search")
@login_required
def api_search():
    base = safe_path(request.args.get("path", ""))
    q = request.args.get("q", "").lower().strip()
    if not q:
        return jsonify({"error": "Busca vazia"}), 400
    b = Path(base)
    if not b.exists() or not b.is_dir():
        return jsonify({"error": "Pasta inválida"}), 400
    results = []
    max_results = 100
    try:
        for root, dirs, files in os.walk(b):
            # limit depth search to avoid too long? no limit
            for name in dirs + files:
                if q in name.lower():
                    full = os.path.join(root, name)
                    try:
                        p = Path(full)
                        results.append(file_info(p))
                        if len(results) >= max_results:
                            break
                    except: pass
            if len(results) >= max_results:
                break
            # avoid hidden spam
            # skip too deep? continue
        return jsonify({"results": results, "count": len(results), "truncated": len(results) >= max_results})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------- settings / 2FA ----------
@app.route("/api/settings")
@login_required
def api_settings():
    auth = auth_store.load_auth()
    return jsonify({
        "username": auth["username"],
        "totp_enabled": auth.get("totp_enabled", False),
        "has_secret": bool(auth.get("totp_secret")),
    })

@app.route("/api/settings/password", methods=["POST"])
@login_required
def api_settings_password():
    data = request.get_json()
    old = data.get("oldPassword") or data.get("old") or ""
    new = data.get("newPassword") or data.get("new") or ""
    confirm = data.get("confirmPassword") or data.get("confirm") or new
    if not old or not new:
        return jsonify({"error": "Preencha senha atual e nova"}), 400
    if len(new) < 6:
        return jsonify({"error": "Nova senha deve ter ao menos 6 caracteres"}), 400
    if new != confirm:
        return jsonify({"error": "Confirmação não confere"}), 400
    auth = auth_store.load_auth()
    if not check_password_hash(auth["password_hash"], old):
        return jsonify({"error": "Senha atual incorreta"}), 401
    new_hash = generate_password_hash(new, method="pbkdf2:sha256")
    auth_store.save_auth(password_hash=new_hash)
    return jsonify({"ok": True})

@app.route("/api/settings/2fa/setup", methods=["POST"])
@login_required
def api_2fa_setup():
    if not HAS_PYOTP:
        return jsonify({"error": "pyotp não instalado no servidor"}), 500
    auth = auth_store.load_auth()
    # gera novo secret e guarda temporariamente na sessão
    secret = pyotp.random_base32()
    session["2fa_setup_secret"] = secret
    uri = get_totp_uri(secret, auth["username"])
    qr_b64 = generate_qr_base64(uri)
    return jsonify({
        "secret": secret,
        "otpauth_url": uri,
        "qr_base64": qr_b64
    })

@app.route("/api/settings/2fa/enable", methods=["POST"])
@login_required
def api_2fa_enable():
    if not HAS_PYOTP:
        return jsonify({"error": "pyotp não instalado"}), 500
    data = request.get_json() or {}
    code = (data.get("code") or "").strip()
    secret = session.get("2fa_setup_secret") or data.get("secret")
    if not secret:
        return jsonify({"error": "Gere um secret primeiro (setup)"}), 400
    if not code or not verify_totp(secret, code):
        return jsonify({"error": "Código inválido. Verifique no app autenticador."}), 401
    auth_store.save_auth(totp_secret=secret, totp_enabled=True)
    session.pop("2fa_setup_secret", None)
    return jsonify({"ok": True})

@app.route("/api/settings/2fa/disable", methods=["POST"])
@login_required
def api_2fa_disable():
    data = request.get_json() or {}
    pwd = data.get("password") or data.get("oldPassword") or ""
    code = (data.get("code") or "").strip()
    auth = auth_store.load_auth()
    if not check_password_hash(auth["password_hash"], pwd):
        return jsonify({"error": "Senha incorreta"}), 401
    # se 2FA ativo, exige código válido também
    if auth.get("totp_enabled") and auth.get("totp_secret"):
        if not code:
            return jsonify({"error": "Informe o código 2FA para desativar"}), 400
        if not verify_totp(auth["totp_secret"], code):
            return jsonify({"error": "Código 2FA inválido"}), 401
    auth_store.save_auth(totp_secret="", totp_enabled=False)
    session.pop("2fa_setup_secret", None)
    return jsonify({"ok": True})

@app.route("/api/settings/2fa/verify", methods=["POST"])
@login_required
def api_2fa_verify():
    # endpoint auxiliar para testar código atual
    data = request.get_json() or {}
    code = (data.get("code") or "").strip()
    auth = auth_store.load_auth()
    if not auth.get("totp_secret"):
        return jsonify({"error": "2FA não configurado"}), 400
    ok = verify_totp(auth["totp_secret"], code)
    return jsonify({"valid": ok})

# ---------- error handlers ----------
@app.errorhandler(413)
def too_large(e):
    return jsonify({"error": "Arquivo muito grande"}), 413

if __name__ == "__main__":
    print(f"PastaExplorer rodando em http://{config.HOST}:{config.PORT}")
    print(f"Sistema: {platform.system()} - Acesso total ao disco")
    print(f"Auth: usuário protegido por hash (pbkdf2/scrypt) + brute-force limit")
    if config.SECRET_KEY and len(config.SECRET_KEY) < 32:
        print("AVISO: defina PASTAEXPLORER_SECRET no .env para produção!")
    app.run(host=config.HOST, port=config.PORT, debug=config.DEBUG)

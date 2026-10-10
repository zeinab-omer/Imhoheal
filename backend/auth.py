"""Token authentication and role-based access control (RBAC).

Demo-grade auth: signed, expiring bearer tokens issued after a password check.
For production, swap this for a managed identity provider (OAuth2 / OIDC),
HTTPS only, rate limiting on login, and audit logging of record access.
"""

from functools import wraps

from flask import current_app, g, jsonify, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash

from data import get_user

TOKEN_MAX_AGE_SECONDS = 8 * 60 * 60   # one clinic shift


def error_response(message, status):
    return jsonify({"error": message}), status


def public_user(username, user):
    """The safe subset of a user record that may be sent to the browser."""
    return {
        "username": username,
        "name": user["name"],
        "role": user["role"],
        "patient_id": user["patient_id"],
    }


def _serializer():
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt="emoheal-auth")


def authenticate(username, password):
    """Return the matching user or None. Always runs one hash check."""
    user = get_user(username or "")
    if user and check_password_hash(user["password_hash"], password or ""):
        return user
    return None


def issue_token(username):
    return _serializer().dumps({"username": username.strip().lower()})


def _read_token():
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None, "Sign in to continue."
    try:
        payload = _serializer().loads(header[7:], max_age=TOKEN_MAX_AGE_SECONDS)
    except SignatureExpired:
        return None, "Your session expired. Sign in again."
    except BadSignature:
        return None, "Invalid session. Sign in again."
    return payload["username"], None


def login_required(view):
    """Require a valid token and expose the user as `g.user` / `g.username`."""
    @wraps(view)
    def wrapper(*args, **kwargs):
        username, problem = _read_token()
        if problem:
            return error_response(problem, 401)
        user = get_user(username)
        if not user:
            return error_response("Account no longer exists.", 401)
        g.username = username
        g.user = user
        return view(*args, **kwargs)
    return wrapper


def roles_required(*roles):
    """Require login AND one of the given roles."""
    def decorator(view):
        @wraps(view)
        @login_required
        def wrapper(*args, **kwargs):
            if g.user["role"] not in roles:
                return error_response("Your role cannot access this resource.", 403)
            return view(*args, **kwargs)
        return wrapper
    return decorator

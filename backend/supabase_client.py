import json
import os
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

class SupabaseError(Exception):
    def __init__(self, message, status=502, code=None):
        super().__init__(message)
        self.status = status
        self.code = code


def is_configured():
    return bool(os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_PUBLISHABLE_KEY"))

def url():
    value = os.environ.get("SUPABASE_URL", "").rstrip("/")
    if not value:
        raise SupabaseError("Set SUPABASE_URL in backend/.env before enabling Supabase.", 503)
    return value


def publishable_key():
    value = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "")
    if not value:
        raise SupabaseError(
            "Set SUPABASE_PUBLISHABLE_KEY in backend/.env before enabling Supabase.",
            503,
        )
    return value

def secret_key():
    value = os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get(
        "SUPABASE_SERVICE_ROLE_KEY"
    )
    if not value:
        raise SupabaseError(
            "Set SUPABASE_SECRET_KEY in backend/.env to enable secure ESP32 device storage.",
            503,
        )
    return value

def _request(path, *, method="GET", body=None, access_token=None, admin=False, headers=None):
    key = secret_key() if admin else publishable_key()
    request_headers = {
        "apikey": key,
        "Authorization": f"Bearer {secret_key() if admin else (access_token or key)}",
        "Accept": "application/json",
    }
    if access_token:
        request_headers["Authorization"] = f"Bearer {access_token}"
    elif key.startswith(("sb_publishable_", "sb_secret_")):
        request_headers.pop("Authorization")
    if body is not None:
        request_headers["Content-Type"] = "application/json"
    if headers:
        request_headers.update(headers)

    payload = None if body is None else json.dumps(body, allow_nan=False).encode("utf-8")
    request = Request(
        f"{url()}{path}", data=payload, headers=request_headers, method=method
    )
    try:
        with urlopen(request, timeout=10) as response:
            raw = response.read()
    except HTTPError as problem:
        raw = problem.read()
        try:
            detail = json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            detail = {}
        if not isinstance(detail, dict):
            detail = {}
        message = detail.get("msg") or detail.get("message") or detail.get("error_description")
        if not message and isinstance(detail.get("error"), str):
            message = detail["error"]
        message = message or "Supabase rejected the request."
        raise SupabaseError(message, problem.code, detail.get("code")) from problem
    except (URLError, TimeoutError, OSError) as problem:
        raise SupabaseError("Could not reach Supabase. Check the URL and network.", 502) from problem
    if not raw:
        return None
    try:
        return json.loads(raw.decode("utf-8"))
    except (ValueError, UnicodeDecodeError) as problem:
        raise SupabaseError("Supabase returned an unreadable response.", 502) from problem


def sign_in(email, password):
    return _request(
        "/auth/v1/token?grant_type=password",
        method="POST",
        body={"email": email, "password": password},
    )


def refresh_session(refresh_token):
    return _request(
        "/auth/v1/token?grant_type=refresh_token",
        method="POST",
        body={"refresh_token": refresh_token},
    )

def update_password(access_token, password):
    return _request(
        "/auth/v1/user",
        method="PUT",
        body={"password": password},
        access_token=access_token,
    )

def authenticated_user(access_token):
    return _request("/auth/v1/user", access_token=access_token)

def select_rows(table, *, filters=None, order=None, limit=None, access_token=None, admin=False):
    query = {"select": "*"}
    if filters:
        query.update(filters)
    if order:
        query["order"] = order
    if limit is not None:
        query["limit"] = str(limit)
    return _request(
        f"/rest/v1/{table}?{urlencode(query)}",
        access_token=access_token,
        admin=admin,
    )

def query_rows(table, query, *, access_token=None, admin=False):
    return _request(
        f"/rest/v1/{table}?{urlencode(query)}",
        access_token=access_token,
        admin=admin,
    )


def insert_rows(table, rows, *, access_token=None, admin=False, upsert=False):
    headers = {"Prefer": "return=representation"}
    if upsert:
        headers["Prefer"] += ",resolution=merge-duplicates"
    return _request(
        f"/rest/v1/{table}",
        method="POST",
        body=rows,
        access_token=access_token,
        admin=admin,
        headers=headers,
    )


def update_rows(table, filters, values, *, access_token=None, admin=False):
    return _request(
        f"/rest/v1/{table}?{urlencode(filters)}",
        method="PATCH",
        body=values,
        access_token=access_token,
        admin=admin,
        headers={"Prefer": "return=representation"},
    )


def delete_rows(table, filters, *, admin=False):
    return _request(
        f"/rest/v1/{table}?{urlencode(filters)}",
        method="DELETE",
        admin=admin,
    )


def rpc(function_name, arguments, *, access_token=None, admin=False):
    return _request(
        f"/rest/v1/rpc/{function_name}",
        method="POST",
        body=arguments,
        access_token=access_token,
        admin=admin,
    )


def invite_user(email, name):
    redirect_url = os.environ.get("APP_REDIRECT_URL", "")
    query = f"?{urlencode({'redirect_to': redirect_url})}" if redirect_url else ""
    return _request(
        f"/auth/v1/invite{query}",
        method="POST",
        body={"email": email, "data": {"name": name}},
        admin=True,
    )


def get_or_create_profile(user, access_token):
    filters = {"id": f"eq.{user['id']}"}
    profiles = select_rows("profiles", filters=filters, limit=1, access_token=access_token)
    if not profiles:
        raise SupabaseError(
            "Your account profile is missing. Ask the project administrator to check the database trigger.",
            403,
        )
    return profiles[0]
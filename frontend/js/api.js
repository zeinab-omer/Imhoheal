// API client and session storage. Every network call in the app goes through here.

const API_BASE = (window.EMOHEAL_API_BASE || "").replace(/\/$/, "");
const SESSION_KEY = "emoheal.session";

// sessionStorage keeps the sign-in per tab, which suits shared clinic computers.
export function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

export function saveSession(session) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* storage blocked: the user simply signs in again on reload */
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* nothing to clear */
  }
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  const session = getSession();
  if (auth && session) headers.Authorization = `Bearer ${session.token}`;

  let response;
  try {
    response = await fetch(API_BASE + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Cannot reach the Emoheal server. Check that it is running.", 0);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && auth) {
      clearSession();
      window.dispatchEvent(new CustomEvent("emoheal:session-expired"));
    }
    throw new ApiError(data.error || "The request failed. Try again.", response.status);
  }
  return data;
}

export const api = {
  publicStats: () => request("/api/public/stats", { auth: false }),
  login: (username, password) =>
    request("/api/auth/login", { method: "POST", body: { username, password }, auth: false }),
  patients: () => request("/api/patients"),
  patient: (id) => request(`/api/patients/${encodeURIComponent(id)}`),
  myPatient: () => request("/api/me/patient"),
  predict: (readings) => request("/api/ai/predict", { method: "POST", body: { readings } }),
};

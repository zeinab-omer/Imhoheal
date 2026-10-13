// API client and session storage. Every network call in the app goes through here.

const API_BASE = (window.EMOHEAL_API_BASE || "").replace(/\/$/, "");
const SESSION_KEY = "imhoheal.session";

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

async function request(path, options = {}, alreadyRefreshed = false) {
  const { method = "GET", body, auth = true } = options;
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
    throw new ApiError("Cannot reach the ImhoHeal server. Check that it is running.", 0);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && auth) {
      if (session?.refresh_token && !alreadyRefreshed) {
        try {
          const refreshResponse = await fetch(API_BASE + "/api/auth/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: session.refresh_token }),
          });
          const refreshed = await refreshResponse.json();
          if (!refreshResponse.ok) {
            throw new Error(refreshed.error || "Session refresh failed.");
          }
          saveSession(refreshed);
          return request(path, options, true);
        } catch {
          clearSession();
          window.dispatchEvent(new CustomEvent("emoheal:session-expired"));
        }
      } else {
        clearSession();
        window.dispatchEvent(new CustomEvent("emoheal:session-expired"));
      }
    }
    throw new ApiError(data.error || "The request failed. Try again.", response.status);
  }
  return data;
}

export const api = {
  publicStats: () => request("/api/public/stats", { auth: false }),
  login: (email, password) =>
    request("/api/auth/login", { method: "POST", body: { email, password }, auth: false }),
  me: () => request("/api/auth/me"),
  updatePassword: (password) =>
    request("/api/auth/password", { method: "PUT", body: { password } }),
  patients: () => request("/api/patients"),
  patient: (id) => request(`/api/patients/${encodeURIComponent(id)}`),
  myPatient: () => request("/api/me/patient"),
  createDevice: (deviceId, patientId) =>
    request("/api/devices", { method: "POST", body: { device_id: deviceId, patient_id: patientId } }),
  invitePatient: (patient) =>
    request("/api/admin/invitations", {
      method: "POST",
      body: patient,
    }),
  predict: (readings) => request("/api/ai/predict", { method: "POST", body: { readings } }),
};

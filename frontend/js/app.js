import { clearSession, getSession, saveSession } from "./api.js";
import { esc, icon } from "./format.js";
import { renderAssistant } from "./views/assistant.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderHome } from "./views/home.js";
import { renderLogin } from "./views/login.js";
import { renderSetPassword } from "./views/setPassword.js";

const root = document.getElementById("view");
const nav = document.getElementById("main-nav");
const sessionSlot = document.getElementById("session-slot");
const ROUTES = {
  "/": { render: renderHome, roles: null },
  "/login": { render: renderLogin, roles: null },
  "/set-password": { render: renderSetPassword, roles: ["doctor", "patient"] },
  "/dashboard": { render: renderDashboard, roles: ["doctor", "patient"] },
  "/assistant": { render: renderAssistant, roles: ["doctor"] },
};

let notice = "";

function navigate(path) {
  if (location.hash === `#${path}`) route();
  else location.hash = path;
}

function setSession(session) {
  saveSession(session);
}

function signOut() {
  clearSession();
  navigate("/");
}

function currentPath() {
  const path = location.hash.replace(/^#/, "") || "/";
  return ROUTES[path] ? path : "/";
}

function navLinks(session) {
  const links = [{ path: "/", label: "Home" }];
  if (session?.user.role === "doctor") {
    links.push({ path: "/dashboard", label: "Patients" }, { path: "/assistant", label: "AI assistant" });
  } else if (session?.user.role === "patient") {
    links.push({ path: "/dashboard", label: "My recovery" });
  }
  return links;
}

function renderHeader(session, path) {
  nav.innerHTML = navLinks(session)
    .map((link) => `<a href="#${link.path}"${link.path === path ? ' aria-current="page"' : ""}>${esc(link.label)}</a>`)
    .join("");

  if (!session) {
    sessionSlot.innerHTML = `<a class="btn btn-header" href="#/login">Sign in</a>`;
    return;
  }

  const roleLabel = session.user.role === "doctor" ? "Doctor" : "Patient";
  sessionSlot.innerHTML = `
    <span class="session-user">${icon("user", 18)}<span>${esc(session.user.name)}</span><span class="session-role">${roleLabel}</span></span>
    <button type="button" class="btn btn-header" id="sign-out">Sign out</button>`;
  sessionSlot.querySelector("#sign-out").addEventListener("click", signOut);
}

async function route() {
  let path = currentPath();
  const session = getSession();
  const definition = ROUTES[path];

  // Guards: signed-out users go to sign-in, and users never reach a page their role forbids.
  if (definition.roles) {
    if (!session) {
      notice = "Sign in to see recovery data.";
      path = "/login";
    } else if (!definition.roles.includes(session.user.role)) {
      path = "/dashboard";
    }
  } else if (path === "/login" && session) {
    path = "/dashboard";
  }
  if (`#${path}` !== (location.hash || "#/")) history.replaceState(null, "", `#${path}`);
  renderHeader(session, path);
  const ctx = { session, notice, navigate, setSession };
  notice = "";

  await ROUTES[path].render(root, ctx);
  document.title = `ImhoHeal | ${path === "/" ? "Orthopedic research prototype" : path.slice(1).replace(/^./, (c) => c.toUpperCase())}`;
}

window.addEventListener("hashchange", route);
window.addEventListener("emoheal:session-expired", () => {
  notice = "Your session expired. Sign in again.";
  navigate("/login");
});

async function handleAuthCallback() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  const type = params.get("type");
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken || !["invite", "recovery"].includes(type)) return false;

  const session = { token: accessToken, refresh_token: refreshToken };
  saveSession(session);
  try {
    const response = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Invitation could not be verified.");
    saveSession({ ...session, user: payload.user });
    history.replaceState(null, "", `${location.pathname}#/set-password`);
    return true;
  } catch {
    clearSession();
    notice = "This invitation link is invalid or expired. Ask the doctor to send a new one.";
    history.replaceState(null, "", `${location.pathname}#/login`);
    return true;
  }
}

handleAuthCallback().then(() => route()).then(() => root.focus({ preventScroll: true }));

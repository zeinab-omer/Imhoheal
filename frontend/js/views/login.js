// Sign-in page with one-click demo accounts for the prototype.

import { api, saveSession } from "../api.js";
import { esc, icon } from "../format.js";

const DEMO_ACCOUNTS = [
  { username: "dr.khalil", password: "emoheal-doctor", title: "Doctor: Dr. Amira Khalil", note: "Sees every patient and the AI assistant" },
  { username: "omar.hassan", password: "emoheal-patient", title: "Patient: Omar Hassan", note: "Sees only his own tibia recovery" },
  { username: "youssef.nabil", password: "emoheal-patient", title: "Patient: Youssef Nabil", note: "Has an abnormal stress alert" },
];

export function renderLogin(root, ctx) {
  root.innerHTML = `
    <div class="shell auth">
      <section class="auth-card" aria-labelledby="login-title">
        <span class="auth-eye">${icon("wedjat", 36)}</span>
        <h1 id="login-title">Sign in to Emoheal</h1>
        <p>Doctors see every patient. Patients see only their own recovery.</p>
        ${ctx.notice ? `<p class="notice" role="status">${esc(ctx.notice)}</p>` : ""}
        <form id="login-form" novalidate>
          <div class="field">
            <label for="username">Username</label>
            <input id="username" name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required>
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input id="password" name="password" type="password" autocomplete="current-password" required>
          </div>
          <p class="form-error" id="login-error" role="alert" hidden></p>
          <button class="btn btn-primary" type="submit">Sign in</button>
        </form>
      </section>

      <aside class="demo-accounts" aria-labelledby="demo-title">
        <h2 id="demo-title">Demo accounts</h2>
        <p>Prototype only. Select one to fill in the form.</p>
        <ul class="demo-list">
          ${DEMO_ACCOUNTS.map((a) => `
            <li><button type="button" data-username="${esc(a.username)}" data-password="${esc(a.password)}">
              <strong>${esc(a.title)}</strong><span>${esc(a.note)}</span>
            </button></li>`).join("")}
        </ul>
        <p class="demo-pw">Passwords: <code>emoheal-doctor</code> for the doctor, <code>emoheal-patient</code> for every patient.</p>
      </aside>
    </div>`;

  const form = root.querySelector("#login-form");
  const errorBox = root.querySelector("#login-error");
  const submit = form.querySelector("button[type=submit]");

  root.querySelectorAll(".demo-list button").forEach((button) => {
    button.addEventListener("click", () => {
      form.username.value = button.dataset.username;
      form.password.value = button.dataset.password;
      form.password.focus();
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.hidden = true;

    const username = form.username.value.trim();
    const password = form.password.value;
    if (!username || !password) {
      errorBox.textContent = "Enter your username and password.";
      errorBox.hidden = false;
      return;
    }

    submit.disabled = true;
    submit.textContent = "Signing in…";
    try {
      const { token, user } = await api.login(username, password);
      ctx.setSession({ token, user });
      ctx.navigate("/dashboard");
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      submit.disabled = false;
      submit.textContent = "Sign in";
    }
  });
}

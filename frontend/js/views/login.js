// Sign-in page for invited Supabase accounts.

import { api } from "../api.js";
import { esc, icon } from "../format.js";

export function renderLogin(root, ctx) {
  root.innerHTML = `
    <div class="shell auth">
      <section class="auth-card" aria-labelledby="login-title">
        <span class="auth-eye">${icon("wedjat", 36)}</span>
        <h1 id="login-title">Sign in to ImhoHeal</h1>
        <p>Doctors see every patient. Patients see only their own recovery.</p>
        ${ctx.notice ? `<p class="notice" role="status">${esc(ctx.notice)}</p>` : ""}
        <form id="login-form" novalidate>
          <div class="field">
            <label for="email">Email address</label>
            <input id="email" name="email" type="email" autocomplete="username" autocapitalize="none" spellcheck="false" required>
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input id="password" name="password" type="password" autocomplete="current-password" required>
          </div>
          <p class="form-error" id="login-error" role="alert" hidden></p>
          <button class="btn btn-primary" type="submit">Sign in</button>
        </form>
      </section>

    </div>`;

  const form = root.querySelector("#login-form");
  const errorBox = root.querySelector("#login-error");
  const submit = form.querySelector("button[type=submit]");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.hidden = true;

    const email = form.email.value.trim();
    const password = form.password.value;
    if (!email || !password) {
      errorBox.textContent = "Enter your email address and password.";
      errorBox.hidden = false;
      return;
    }

    submit.disabled = true;
    submit.textContent = "Signing in…";
    try {
      const session = await api.login(email, password);
      ctx.setSession(session);
      ctx.navigate("/dashboard");
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      submit.disabled = false;
      submit.textContent = "Sign in";
    }
  });
}

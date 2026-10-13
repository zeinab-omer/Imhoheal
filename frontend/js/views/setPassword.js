import { api } from "../api.js";
import { esc, icon } from "../format.js";

export function renderSetPassword(root, ctx) {
  root.innerHTML = `
    <div class="shell auth">
      <section class="auth-card" aria-labelledby="password-title">
        <span class="auth-eye">${icon("wedjat", 36)}</span>
        <h1 id="password-title">Choose your password</h1>
        <p>Set a password for your ImhoHeal account before continuing.</p>
        ${ctx.notice ? `<p class="notice" role="status">${esc(ctx.notice)}</p>` : ""}
        <form id="password-form" novalidate>
          <div class="field">
            <label for="new-password">New password</label>
            <input id="new-password" name="password" type="password" autocomplete="new-password" minlength="8" maxlength="128" required>
          </div>
          <div class="field">
            <label for="confirm-password">Confirm password</label>
            <input id="confirm-password" name="confirm-password" type="password" autocomplete="new-password" minlength="8" maxlength="128" required>
          </div>
          <p class="form-error" id="password-error" role="alert" hidden></p>
          <button class="btn btn-primary" type="submit">Save password</button>
        </form>
      </section>
    </div>`;

  const form = root.querySelector("#password-form");
  const errorBox = root.querySelector("#password-error");
  const submit = form.querySelector("button[type=submit]");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = form.elements.password.value;
    const confirmation = form.elements["confirm-password"].value;
    if (password.length < 8 || password.length > 128) {
      errorBox.textContent = "Use a password between 8 and 128 characters.";
      errorBox.hidden = false;
      return;
    }
    if (password !== confirmation) {
      errorBox.textContent = "The passwords do not match.";
      errorBox.hidden = false;
      return;
    }

    errorBox.hidden = true;
    submit.disabled = true;
    submit.textContent = "Saving…";
    try {
      await api.updatePassword(password);
      ctx.navigate("/dashboard");
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      submit.disabled = false;
      submit.textContent = "Save password";
    }
  });
}

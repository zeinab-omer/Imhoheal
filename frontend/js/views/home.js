import { api } from "../api.js";
import { esc, icon } from "../format.js";
const HERO_ART = `
<svg viewBox="0 0 560 300" role="img" aria-label="A smart plate screwed across a fractured bone, with sensors reporting strain and bone density.">
  <path class="art-bone" d="M120 122H262L272 138L258 152L270 166L262 178H120Z"/>
  <circle class="art-bone" cx="112" cy="112" r="26"/><circle class="art-bone" cx="112" cy="188" r="26"/>
  <path class="art-bone" d="M278 122H440V178H278L286 166L274 152L288 138Z"/>
  <circle class="art-bone" cx="448" cy="112" r="26"/><circle class="art-bone" cx="448" cy="188" r="26"/>
  <rect fill="#f1ebd9" x="118" y="124" width="150" height="52"/><rect fill="#f1ebd9" x="288" y="124" width="150" height="52"/>

  <rect class="art-plate" x="160" y="108" width="240" height="20" rx="10"/>
  <g class="art-screw">
    <circle cx="184" cy="118" r="5"/><circle cx="208" cy="118" r="5"/><circle cx="232" cy="118" r="5"/>
    <circle cx="328" cy="118" r="5"/><circle cx="352" cy="118" r="5"/><circle cx="376" cy="118" r="5"/>
  </g>
  <rect class="art-module" x="246" y="100" width="68" height="36" rx="8"/>

  <g class="art-sensor"><circle cx="220" cy="118" r="5"/><circle cx="280" cy="118" r="6"/><circle cx="340" cy="118" r="5"/></g>
  <g><circle class="art-halo" cx="220" cy="118" r="12"/><circle class="art-halo" cx="280" cy="118" r="14"/><circle class="art-halo" cx="340" cy="118" r="12"/></g>

  <path class="art-leader" d="M220 112V74M340 112V74"/>
  <rect class="art-label-box" x="78" y="30" width="210" height="48" rx="6"/>
  <text class="art-label" x="183" y="49">Plate strain 41%</text>
  <text class="art-label-small" x="183" y="66">falling as bone takes load</text>
  <rect class="art-label-box" x="300" y="30" width="210" height="48" rx="6"/>
  <text class="art-label" x="405" y="49">Density 318 mg/cm³</text>
  <text class="art-label-small" x="405" y="66">rising each week</text>

  <path class="art-leader" d="M280 138V232"/>
  <rect class="art-label-box" x="170" y="230" width="220" height="48" rx="6"/>
  <text class="art-label" x="280" y="249">Week 8 after surgery</text>
  <text class="art-label-small" x="280" y="266">projected union: week 11</text>
</svg>`;

const STEPS = [
  {
    icon: "watch",
    title: "The prototype senses motion",
    text: "An ESP32 with an MPU6050 can send movement and rotation samples to the dashboard. It does not measure bone density or plate strain.",
  },
  {
    icon: "wedjat",
    title: "The dashboard organizes readings",
    text: "The current motion view plots sensor samples. The separate healing analysis uses fictional demo readings and is not a trained medical AI.",
  },
  {
    icon: "user",
    title: "Your care team acts",
    text: "Doctors can pair a device to a demo patient. Patients see only their own record. The prototype is not for clinical decisions.",
  },
];

export async function renderHome(root, ctx) {
  const signedIn = Boolean(ctx.session);
  const actionHref = "#/" + (signedIn ? "dashboard" : "login");
  const actionText = signedIn ? "Open your dashboard" : "Sign in";

  root.innerHTML = `
    <section class="hero" aria-labelledby="hero-title">
      <div class="shell hero-inner">
        <div class="hero-copy">
          <h1 id="hero-title">Where ancient wisdom meets smart technology, healing begins.</h1>
          <p class="hero-lede">ImhoHeal is exploring Arduino-based motion sensing and a doctor-facing dashboard. The current MPU6050 prototype records movement; it does not directly measure bone healing.</p>
          <div class="hero-actions">
            <a class="btn btn-gold" href="${actionHref}">${actionText}</a>
            <button type="button" class="btn btn-outline-light" data-scroll="how-it-works">See how it works</button>
          </div>
        </div>
        <figure class="hero-art">
          ${HERO_ART}
          <figcaption>Illustration with sample values. A plate bridges a tibial fracture.</figcaption>
        </figure>
      </div>
    </section>

    <section class="section" id="how-it-works" aria-labelledby="how-title">
      <div class="shell">
        <div class="section-head">
          <h2 id="how-title">From the plate to the care team</h2>
          <p>One loop, from the implant in the bone to a decision in the clinic.</p>
        </div>
        <div class="steps">
          ${STEPS.map((s) => `
            <article class="step">
              ${icon(s.icon, 30)}
              <h3>${esc(s.title)}</h3>
              <p>${esc(s.text)}</p>
            </article>`).join("")}
        </div>
      </div>
    </section>

    <section class="section" aria-labelledby="stats-title">
      <div class="shell" id="community">
        <div class="section-head">
          <h2 id="stats-title">The platform today</h2>
          <p>Aggregate figures only. No individual patient appears in this section.</p>
        </div>
        <p class="loading">Loading platform figures…</p>
      </div>
    </section>`;

  root.querySelector("[data-scroll]").addEventListener("click", (event) => {
    document.getElementById(event.currentTarget.dataset.scroll)?.scrollIntoView({ behavior: "smooth" });
  });

  const community = root.querySelector("#community");
  try {
    const stats = await api.publicStats();
    community.querySelector(".loading").outerHTML = renderCommunity(stats);
  } catch (error) {
    community.querySelector(".loading").outerHTML = `<p class="error-box" role="alert">${esc(error.message)}</p>`;
  }
}

function renderCommunity(stats) {
  const items = [
    ["Monitored cases", stats.total_monitored_cases],
    ["Recovering on track", `${stats.on_track_percent}%`],
    ["Average weeks monitored", stats.average_weeks_monitored],
    ["Average review", `${stats.average_rating} of 5`],
  ];

  return `
    <dl class="ledger">
      ${items.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("")}
    </dl>
    ${stats.demo_data ? `<p class="ledger-note">Calculated from the fictional demo cohort.</p>` : ""}
    <div class="reviews">
      ${stats.reviews.map((review) => `
        <blockquote class="review">
          <p>${esc(review.text)}</p>
          <footer>
            <span class="stars" role="img" aria-label="${review.rating} out of 5">${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}</span>
            ${esc(review.author)}
          </footer>
        </blockquote>`).join("")}
    </div>`;
}

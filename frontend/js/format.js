// Small shared helpers: escaping, icons, labels, and formatting.

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]
  ));
}

// Draws an icon from the sprite in index.html.
export function icon(name, size = 18) {
  return `<svg width="${size}" height="${size}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;
}

export const STATUS = {
  attention: { label: "Needs attention", icon: "alert", rank: 0 },
  watch: { label: "Watch closely", icon: "watch", rank: 1 },
  early: { label: "Early phase", icon: "dot", rank: 2 },
  on_track: { label: "On track", icon: "check", rank: 3 },
};

export function statusChip(status) {
  const meta = STATUS[status] || STATUS.early;
  return `<span class="chip chip--${esc(status)}">${icon(meta.icon, 15)}${meta.label}</span>`;
}

export const LEVEL = {
  critical: { label: "Critical", icon: "alert" },
  warning: { label: "Warning", icon: "watch" },
  success: { label: "On track", icon: "check" },
  info: { label: "Note", icon: "info" },
};

// Patients see plain-language guidance instead of clinical directions.
const PATIENT_MESSAGES = {
  critical:
    "Some of your readings need your surgeon's attention. Contact your clinic soon. " +
    "For severe pain or sudden swelling, seek urgent care.",
  warning:
    "Some readings are outside the usual range. Mention this to your surgeon at your next visit.",
  success: "Your readings show healing is progressing as expected. Keep following your care plan.",
  info: "We are still collecting readings. More detail will appear as weeks are logged.",
};

export function patientMessage(level) {
  return PATIENT_MESSAGES[level] || PATIENT_MESSAGES.info;
}

export function formatDate(iso) {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function firstName(fullName) {
  return String(fullName).replace(/^(Dr\.|Mr\.|Ms\.|Mrs\.)\s+/, "").split(" ")[0];
}

// "up 4 points" / "down 3 points" / "unchanged" between the last two readings.
export function describeChange(logs, key, unit) {
  if (logs.length < 2) return "First reading";
  const diff = Math.round((logs[logs.length - 1][key] - logs[logs.length - 2][key]) * 10) / 10;
  if (diff === 0) return "Unchanged since last week";
  const size = Math.abs(diff);
  return `${diff > 0 ? "Up" : "Down"} ${size} ${unit} since last week`;
}

// lastUpdated.js
document.addEventListener("DOMContentLoaded", () => {
  const el = document.querySelector("#last-updated time");
  if (!el) return;

  const d = new Date(document.lastModified);

  el.textContent = `Last updated: ${d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })}`;

  el.setAttribute("datetime", d.toISOString());
});

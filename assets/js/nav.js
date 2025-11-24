// nav.js
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("menuButton");
  const menu = document.getElementById("mobileMenu");
  const backdrop = document.getElementById("navBackdrop");

  if (!btn || !menu || !backdrop) return;

  const openMenu = () => {
    menu.hidden = false;
    backdrop.hidden = false;
    requestAnimationFrame(() => {
      menu.classList.add("open");
      backdrop.classList.add("visible");
    });
    btn.setAttribute("aria-expanded", "true");
  };

  const closeMenu = () => {
    menu.classList.remove("open");
    backdrop.classList.remove("visible");
    btn.setAttribute("aria-expanded", "false");
    setTimeout(() => {
      menu.hidden = true;
      backdrop.hidden = true;
    }, 180);
  };

  const toggleMenu = () => {
    const expanded = btn.getAttribute("aria-expanded") === "true";
    expanded ? closeMenu() : openMenu();
  };

  btn.addEventListener("click", toggleMenu);
  backdrop.addEventListener("click", closeMenu);

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });
});

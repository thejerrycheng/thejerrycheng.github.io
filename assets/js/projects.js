// projects.js
document.addEventListener("DOMContentLoaded", () => {
  const thumbs = document.querySelectorAll("#projects .proj-thumb");

  thumbs.forEach((thumb) => {
    const video = thumb.querySelector("video");
    if (!video) return;

    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("webkit-playsinline", "");
    video.removeAttribute("controls");

    video.preload = "metadata";

    video.play().then(() => video.pause()).catch(() => {});

    const play = () => {
      video.currentTime = 0;
      video.play().catch(() => {});
    };
    const pause = () => video.pause();

    thumb.addEventListener("mouseenter", play);
    thumb.addEventListener("mouseleave", pause);
    thumb.addEventListener("touchstart", play, { passive: true });
    thumb.addEventListener("touchend", pause, { passive: true });
  });
});

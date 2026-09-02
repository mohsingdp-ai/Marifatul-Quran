/* Marifatul Quran — Material ripple.
   On press, drops an expanding circle into the control under the pointer; style.css
   animates it out and clips it to the control's shape. One delegated listener, so rows the
   app re-renders need no wiring of their own. */
(function () {
  "use strict";

  var HOSTS = [
    ".btn", ".btn-para-step", ".btn-toolbar-transport", ".btn-toolbar-locate", ".btn-toolbar-menu",
    ".toolbar-menu-item", ".audio-play-btn", ".audio-seek-btn", ".audio-speed-btn", ".audio-offline-btn",
    ".audio-share-wa-btn", ".audio-retry-btn", ".hifz-pill", ".verses-toggle", ".share-bulk-links-tile",
    ".settings-role-btn", ".modal-close-btn", ".mq-guide-next", ".mq-guide-skip"
  ].join(",");

  var reduceMotion = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

  document.addEventListener("pointerdown", function (e) {
    if (reduceMotion && reduceMotion.matches) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    var host = e.target && e.target.closest ? e.target.closest(HOSTS) : null;
    if (!host || host.disabled) return;

    var rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    // Large enough to cover the far corner from wherever the press landed.
    var size = Math.ceil(Math.hypot(rect.width, rect.height) * 2);
    var ripple = document.createElement("span");
    ripple.className = "md-ripple";
    ripple.style.width = size + "px";
    ripple.style.height = size + "px";
    ripple.style.left = (e.clientX - rect.left - size / 2) + "px";
    ripple.style.top = (e.clientY - rect.top - size / 2) + "px";
    host.appendChild(ripple);

    var done = false;
    function remove() {
      if (done) return;
      done = true;
      if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
    }
    ripple.addEventListener("animationend", remove);
    setTimeout(remove, 700);
  }, { passive: true });
})();

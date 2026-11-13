/* BO Football Intelligence — light/dark theme control */
(function () {
  "use strict";
  var KEY = "bo-football-theme";
  var BO = window.BO = window.BO || {};
  var root = document.documentElement;
  function fromStorage() {
    try {
      var value = window.localStorage.getItem(KEY);
      return value === "light" || value === "dark" ? value : "dark";
    } catch (_) {
      return "dark";
    }
  }
  function refreshControls() {
    if (typeof BO.icon !== "function") return;
    var isLight = root.dataset.theme === "light";
    document.querySelectorAll(".theme-toggle").forEach(function (button) {
      var label = isLight ? "Koyu temaya geç" : "Açık temaya geç";
      button.setAttribute("aria-label", label);
      button.setAttribute("title", label);
      button.setAttribute("aria-pressed", String(isLight));
      button.innerHTML = BO.icon(isLight ? "moon" : "sun");
    });
  }
  function apply(mode, persist) {
    mode = mode === "light" ? "light" : "dark";
    root.dataset.theme = mode;
    root.style.colorScheme = mode;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", mode === "light" ? "#f6f8fc" : "#060a13");
    if (persist) {
      try { window.localStorage.setItem(KEY, mode); } catch (_) {}
    }
    refreshControls();
  }
  BO.theme = {
    apply: apply,
    bind: function () {
      document.querySelectorAll(".theme-toggle").forEach(function (button) {
        button.addEventListener("click", function () {
          apply(root.dataset.theme === "light" ? "dark" : "light", true);
        });
      });
      refreshControls();
    }
  };
  apply(fromStorage(), false);
  window.addEventListener("storage", function (event) {
    if (event.key === KEY) apply(event.newValue, false);
  });
})();

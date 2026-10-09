/* Global English Academy Online public website:
   Remove Login / Sign In controls from the public marketing site only.
   Booking and contact links are deliberately left untouched. */
(function removePublicLoginControls() {
  "use strict";
  var labels = /^(?:log\s*in|login|sign\s*in|signin|sign-in|登录|登入|登入系统)$/i;
  var paths = /(?:^|\/)(?:login|signin|sign-in)(?:[/?#.]|$)/i;

  function purge() {
    document.querySelectorAll('a,button,input,[role="button"],[onclick],[class*="login" i],[id*="login" i],[aria-label*="login" i],[title*="login" i]').forEach(function (el) {
      var text = (el.innerText || el.textContent || el.value || "").replace(/\s+/g, " ").trim();
      var label = [text, el.getAttribute("aria-label") || "", el.getAttribute("title") || ""].join(" ").trim();
      var href = el.getAttribute("href") || "";
      var action = el.getAttribute("data-action") || "";
      if (labels.test(text) || labels.test(label) || paths.test(href) || /login|signin|sign-in/i.test(action)) {
        el.remove();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", purge, { once: true });
  } else {
    purge();
  }
  new MutationObserver(purge).observe(document.documentElement, { childList: true, subtree: true });
})();

/*
 * cta-attribution.js (#342): forward marketing params from the landing URL to
 * every buy.worldsimp.com link, so orders that start on a landing keep their
 * source in the Marketing tab instead of showing "Chưa xác định".
 *
 * - Copies utm_*, ref and wsf_link from location.search onto each
 *   a[href^="https://buy.worldsimp.com/"].
 * - No utm_* on the landing URL: adds utm_source=ticket_landing,
 *   utm_medium=landing, utm_campaign=<landing folder>.
 * - Never overwrites a param the href already has.
 *
 * Usage (once per landing, before </body>):
 *   <script src="/cta-attribution.js?v=20261108" data-campaign="<FolderName>" defer></script>
 * data-campaign is optional; without it the first path segment is used.
 *
 * Best-effort only: no dependencies, never throws, never touches click
 * handlers. If anything fails the links keep their original href.
 */
(function () {
  'use strict';
  var BUY_PREFIX = 'https://buy.worldsimp.com/';
  var script = document.currentScript;

  function campaignName() {
    try {
      var fromAttr = script && script.getAttribute('data-campaign');
      if (fromAttr) return fromAttr;
      var segment = window.location.pathname.split('/').filter(Boolean)[0];
      return segment ? decodeURIComponent(segment) : 'root';
    } catch (_) {
      return 'unknown';
    }
  }

  // Ordered [key, value] pairs to add to buy links.
  function collectParams(search) {
    var out = [];
    var hasUtm = false;
    new URLSearchParams(search).forEach(function (value, key) {
      value = value.trim();
      if (!value) return;
      var isUtm = key.indexOf('utm_') === 0;
      if (isUtm || key === 'ref' || key === 'wsf_link') {
        if (isUtm) hasUtm = true;
        out.push([key, value]);
      }
    });
    if (!hasUtm) {
      out.push(['utm_source', 'ticket_landing'], ['utm_medium', 'landing'], ['utm_campaign', campaignName()]);
    }
    return out;
  }

  function decorate(href, params) {
    var url = new URL(href);
    var changed = false;
    params.forEach(function (pair) {
      if (!url.searchParams.has(pair[0])) {
        url.searchParams.append(pair[0], pair[1]);
        changed = true;
      }
    });
    return changed ? url.toString() : href;
  }

  function run() {
    try {
      if (typeof URL !== 'function' || typeof URLSearchParams !== 'function') return;
      var params = collectParams(window.location.search);
      var links = document.querySelectorAll('a[href^="' + BUY_PREFIX + '"]');
      for (var i = 0; i < links.length; i++) {
        try {
          var href = links[i].getAttribute('href');
          var next = decorate(href, params);
          if (next !== href) links[i].setAttribute('href', next);
        } catch (_) { /* leave this link as it was */ }
      }
    } catch (_) { /* attribution is best-effort */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();

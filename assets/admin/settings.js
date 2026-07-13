/**
 * Settings screen: client-side tab filtering (APG tabs pattern).
 * Progressive enhancement — without this script every panel stays visible.
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    // Info disclosures: without JavaScript every full description is visible;
    // with it, collapse them behind the (revealed) info buttons.
    Array.prototype.slice.call(document.querySelectorAll('.dbe-info-btn')).forEach(function (btn) {
      var more = document.getElementById(btn.getAttribute('aria-controls'));
      if (!more) { return; }
      more.hidden = true;
      btn.hidden = false;
      btn.setAttribute('aria-expanded', 'false');
      btn.addEventListener('click', function () {
        var open = more.hidden;
        more.hidden = !open;
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });

    var bar = document.querySelector('.dbe-tabbar');
    var tabs = bar ? Array.prototype.slice.call(bar.querySelectorAll('.dbe-tab')) : [];
    var panels = Array.prototype.slice.call(document.querySelectorAll('.dbe-panel'));
    if (!bar || !tabs.length || !panels.length) { return; }

    var STORE_KEY = 'dbeSettingsTab';

    function activate(slug, focusTab) {
      tabs.forEach(function (tab) {
        var active = tab.dataset.tab === slug;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
        tab.tabIndex = active ? 0 : -1;
        if (active && focusTab) { tab.focus(); }
      });
      panels.forEach(function (panel) {
        panel.hidden = panel.dataset.tab !== slug;
      });
      try { sessionStorage.setItem(STORE_KEY, slug); } catch (e) { /* private mode */ }
    }

    // Retrofit ARIA now that the tabs are functional.
    bar.hidden = false;
    bar.setAttribute('role', 'tablist');
    var wrap = document.querySelector('.dbe-settings');
    if (wrap) { wrap.classList.add('dbe-js-tabs'); }
    tabs.forEach(function (tab) {
      tab.setAttribute('role', 'tab');
      tab.id = 'dbe-tab-' + tab.dataset.tab;
      // Completes the APG tabs pattern: the tab names the panel it controls.
      tab.setAttribute('aria-controls', 'dbe-panel-' + tab.dataset.tab);
    });
    panels.forEach(function (panel) {
      panel.setAttribute('role', 'tabpanel');
      panel.id = 'dbe-panel-' + panel.dataset.tab;
      panel.setAttribute('aria-labelledby', 'dbe-tab-' + panel.dataset.tab);
    });

    bar.addEventListener('click', function (e) {
      var tab = e.target.closest('.dbe-tab');
      if (tab) { activate(tab.dataset.tab, false); }
    });

    bar.addEventListener('keydown', function (e) {
      var idx = tabs.indexOf(document.activeElement);
      if (idx === -1) { return; }
      var next = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { next = (idx + 1) % tabs.length; }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { next = (idx - 1 + tabs.length) % tabs.length; }
      if (e.key === 'Home') { next = 0; }
      if (e.key === 'End') { next = tabs.length - 1; }
      if (next !== null) {
        e.preventDefault();
        activate(tabs[next].dataset.tab, true);
      }
    });

    var saved = null;
    try { saved = sessionStorage.getItem(STORE_KEY); } catch (e) { /* private mode */ }
    var initial = tabs.some(function (t) { return t.dataset.tab === saved; }) ? saved : tabs[0].dataset.tab;
    activate(initial, false);
  });
})();

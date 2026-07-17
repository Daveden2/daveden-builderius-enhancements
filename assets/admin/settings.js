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

    var wrap = document.querySelector('.dbe-settings');
    var form = wrap ? wrap.querySelector('form') : null;
    var bar = wrap ? wrap.querySelector('.dbe-tabbar') : null;
    var tabs = bar ? Array.prototype.slice.call(bar.querySelectorAll('.dbe-tab')) : [];
    var panels = wrap ? Array.prototype.slice.call(wrap.querySelectorAll('.dbe-panel')) : [];
    if (!wrap || !form || !bar || !tabs.length || !panels.length) { return; }

    var STORE_KEY = 'dbeSettingsTab';
    var tools = form.querySelector('.dbe-settings-tools');
    var search = form.querySelector('.dbe-feature-search');
    var filter = form.querySelector('.dbe-feature-filter');
    var clearFilters = form.querySelector('.dbe-clear-filters');
    var noResults = form.querySelector('.dbe-no-results');
    var noResultsClear = form.querySelector('.dbe-no-results-clear');
    var filterStatus = form.querySelector('.dbe-filter-status');
    var resetDefaults = form.querySelector('.dbe-reset-defaults');
    var savebar = form.querySelector('.dbe-savebar');
    var saveStatus = form.querySelector('.dbe-save-status');
    var submit = form.querySelector('#submit');
    var fields = Array.prototype.slice.call(form.querySelectorAll('.dbe-field'));
    var settingsControls = Array.prototype.slice.call(form.querySelectorAll('.dbe-switch, select[name^="daveden_builder_enhancements"]'));
    var activeSlug = tabs[0].dataset.tab;
    var submitting = false;

    fields.forEach(function (field) {
      field.dbeSearchText = (field.textContent || '').toLowerCase();
    });

    function clearFilterValues() {
      if (search) { search.value = ''; }
      if (filter) { filter.value = 'all'; }
    }

    function activate(slug, focusTab, preserveFilters) {
      activeSlug = slug;
      if (!preserveFilters) { clearFilterValues(); }
      tabs.forEach(function (tab) {
        var active = tab.dataset.tab === slug;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
        tab.tabIndex = active ? 0 : -1;
        if (active && focusTab) { tab.focus(); }
      });
      panels.forEach(function (panel) {
        panel.hidden = panel.dataset.tab !== slug;
        Array.prototype.slice.call(panel.querySelectorAll('.dbe-field')).forEach(function (field) {
          field.hidden = false;
        });
      });
      wrap.classList.remove('dbe-filter-mode');
      bar.hidden = false;
      if (clearFilters) { clearFilters.hidden = true; }
      if (noResults) { noResults.hidden = true; }
      if (filterStatus) { filterStatus.textContent = ''; }
      if (savebar) { savebar.hidden = slug === 'dashboard'; }
      try { sessionStorage.setItem(STORE_KEY, slug); } catch (e) { /* private mode */ }
    }

    function fieldMatches(field, query, mode) {
      if (query && field.dbeSearchText.indexOf(query) === -1) { return false; }
      var control = field.querySelector('.dbe-switch');
      if (mode === 'enabled') { return !!control && !control.disabled && control.checked; }
      if (mode === 'disabled') { return !!control && !control.disabled && !control.checked; }
      if (mode === 'experimental') { return field.dataset.experimental === '1'; }
      if (mode === 'unavailable') { return field.dataset.unavailable === '1'; }
      return true;
    }

    function applyFilters() {
      var query = search ? search.value.trim().toLowerCase() : '';
      var mode = filter ? filter.value : 'all';
      var filtering = !!query || mode !== 'all';
      if (!filtering) {
        activate(activeSlug, false, true);
        return;
      }

      var count = 0;
      wrap.classList.add('dbe-filter-mode');
      bar.hidden = true;
      if (clearFilters) { clearFilters.hidden = false; }
      panels.forEach(function (panel) {
        if (panel.dataset.tab === 'dashboard') {
          panel.hidden = true;
          return;
        }
        var panelCount = 0;
        Array.prototype.slice.call(panel.querySelectorAll('.dbe-field')).forEach(function (field) {
          var matches = fieldMatches(field, query, mode);
          field.hidden = !matches;
          if (matches) { panelCount += 1; count += 1; }
        });
        panel.hidden = panelCount === 0;
      });
      if (noResults) { noResults.hidden = count !== 0; }
      if (savebar) { savebar.hidden = false; }
      if (filterStatus) {
        var template = count === 1 ? tools.dataset.resultOne : tools.dataset.resultMany;
        filterStatus.textContent = template.replace('%s', String(count));
      }
    }

    function clearAndActivate() {
      clearFilterValues();
      activate(activeSlug, false, true);
      if (search) { search.focus(); }
    }

    // Retrofit ARIA now that the tabs are functional.
    bar.hidden = false;
    bar.setAttribute('role', 'tablist');
    wrap.classList.add('dbe-js-tabs');
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
      if (tab) { activate(tab.dataset.tab, false, false); }
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
        activate(tabs[next].dataset.tab, true, false);
      }
    });

    if (tools) { tools.hidden = false; }
    if (search) {
      search.addEventListener('input', applyFilters);
      search.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); }
      });
    }
    if (filter) { filter.addEventListener('change', applyFilters); }
    if (clearFilters) { clearFilters.addEventListener('click', clearAndActivate); }
    if (noResultsClear) { noResultsClear.addEventListener('click', clearAndActivate); }

    function controlValue(control) {
      return control.type === 'checkbox' ? (control.checked ? '1' : '0') : control.value;
    }

    var initialValues = settingsControls.map(controlValue);

    function isDirty() {
      return settingsControls.some(function (control, index) {
        return controlValue(control) !== initialValues[index];
      });
    }

    function updateDirty(message) {
      var dirty = isDirty();
      if (savebar) { savebar.classList.toggle('is-dirty', dirty); }
      if (saveStatus && savebar) {
        saveStatus.textContent = dirty ? (message || savebar.dataset.dirty) : savebar.dataset.clean;
      }
      if (submit) { submit.disabled = !dirty; }
    }

    form.addEventListener('change', function () {
      updateDirty();
      if (filter && (filter.value === 'enabled' || filter.value === 'disabled')) { applyFilters(); }
    });

    if (resetDefaults) {
      resetDefaults.addEventListener('click', function () {
        settingsControls.forEach(function (control) {
          if (control.disabled) { return; }
          if (control.type === 'checkbox') {
            control.checked = control.closest('.dbe-field').dataset.default === '1';
          } else if (control.dataset.default) {
            control.value = control.dataset.default;
          }
        });
        updateDirty(savebar ? savebar.dataset.reset : '');
        applyFilters();
      });
    }

    form.addEventListener('submit', function () { submitting = true; });
    window.addEventListener('beforeunload', function (e) {
      if (submitting || !isDirty()) { return; }
      e.preventDefault();
      e.returnValue = '';
    });

    var saved = null;
    try { saved = sessionStorage.getItem(STORE_KEY); } catch (e) { /* private mode */ }
    var initial = tabs.some(function (t) { return t.dataset.tab === saved; }) ? saved : tabs[0].dataset.tab;
    activate(initial, false, true);
    updateDirty();
  });
})();

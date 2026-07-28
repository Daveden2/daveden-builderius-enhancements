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
    var dangerZone = form.querySelector('.dbe-danger-zone');
    var presetButtons = Array.prototype.slice.call(form.querySelectorAll('.dbe-apply-preset'));
    var presetStatus = form.querySelector('.dbe-preset-status');
    var savebar = form.querySelector('.dbe-savebar');
    var saveStatus = form.querySelector('.dbe-save-status');
    var submit = form.querySelector('#submit');
    var fields = Array.prototype.slice.call(form.querySelectorAll('.dbe-field'));
    // Name-qualified: the bulk switches are controls over the other switches, not
    // settings, so they carry no name and must stay out of the dirty check and
    // out of reset-to-defaults.
    var settingsControls = Array.prototype.slice.call(
      form.querySelectorAll('input[name^="daveden_builder_enhancements"], select[name^="daveden_builder_enhancements"]')
    );
    var bulkSwitches = Array.prototype.slice.call(form.querySelectorAll('.dbe-switch--bulk'));
    var activeSlug = tabs[0].dataset.tab;
    var submitting = false;

    fields.forEach(function (field) {
      field.dbeSearchText = (field.textContent || '').toLowerCase();
    });

    function clearFilterValues() {
      if (search) { search.value = ''; }
      if (filter) { filter.value = 'all'; }
    }

    // --- Bulk switches: one per tab, one per section ------------------------
    // The switches a bulk control governs: every feature switch inside its
    // scope that the user can actually change. Pro-locked switches are disabled,
    // so they are never counted and never flipped, and a bulk control whose
    // scope is entirely Pro-locked removes itself.
    function bulkTargets(bulk) {
      var scope = bulk.dataset.bulk === 'tab'
        ? bulk.closest('.dbe-panel')
        : bulk.closest('.dbe-feature-group');
      if (!scope) { return []; }
      return Array.prototype.slice
        .call(scope.querySelectorAll('.dbe-field:not(.dbe-field--master) .dbe-switch'))
        .filter(function (control) { return !control.disabled && !control.classList.contains('dbe-switch--bulk'); });
    }

    function syncBulk() {
      bulkSwitches.forEach(function (bulk) {
        var targets = bulkTargets(bulk);
        // Rendered hidden, revealed only once it has something to govern: an
        // entirely Pro-locked group has no changeable switches, and without this
        // script running there is nothing to drive it at all. The switch and its
        // own label sit in different grid cells, so both follow; the section
        // description beside them is not the switch's and stays put.
        var wrap = bulk.closest('.dbe-bulk');
        var body = wrap.nextElementSibling;
        var text = body ? body.querySelector('.dbe-bulk__text') : null;
        wrap.hidden = !targets.length;
        if (text) { text.hidden = !targets.length; }
        if (!targets.length) { return; }
        var on = targets.filter(function (t) { return t.checked; }).length;
        bulk.checked = on === targets.length;
        bulk.indeterminate = on > 0 && on < targets.length;
      });
    }

    function syncCounts() {
      var counts = {};
      panels.forEach(function (panel) {
        var slug = panel.dataset.tab;
        var all = Array.prototype.slice
          .call(panel.querySelectorAll('.dbe-field:not(.dbe-field--master) .dbe-switch'))
          .filter(function (c) { return !c.classList.contains('dbe-switch--bulk'); });
        if (!all.length) { return; }
        counts[slug] = { on: all.filter(function (c) { return c.checked && !c.disabled; }).length, total: all.length };
      });
      Object.keys(counts).forEach(function (slug) {
        var text = counts[slug].on + ' / ' + counts[slug].total;
        var chip = form.querySelector('[data-tabcount-for="' + slug + '"]');
        if (chip) { chip.textContent = text; }
        var line = form.querySelector('[data-count-for="' + slug + '"]');
        if (line) {
          // Written out in full for the panel heading, where it is read rather
          // than scanned. The rail chip beside it is aria-hidden.
          line.textContent = counts[slug].on + ' of ' + counts[slug].total + ' on';
        }
      });
    }

    // A feature's enum sub-setting (default theme, palette shortcut and so on)
    // is meaningless while its parent is off, so it follows the parent. A
    // disabled select drops out of the POST and dbe_sanitise_options() keeps the
    // saved value, so switching a parent off and on again loses nothing.
    function syncSubfields() {
      Array.prototype.slice.call(form.querySelectorAll('.dbe-field__sub[data-parent]')).forEach(function (sub) {
        var parent = document.getElementById('dbe-f-' + sub.dataset.parent);
        if (!parent) { return; }
        var off = !parent.checked || parent.disabled;
        sub.classList.toggle('is-disabled', off);
        Array.prototype.slice.call(sub.querySelectorAll('select')).forEach(function (select) {
          select.disabled = off;
        });
      });
    }

    bulkSwitches.forEach(function (bulk) {
      bulk.addEventListener('change', function () {
        var targets = bulkTargets(bulk);
        // Part-on means "finish the job": only an entirely-on group turns off.
        var turnOn = targets.some(function (t) { return !t.checked; });
        targets.forEach(function (t) { t.checked = turnOn; });
        syncAll();
        updateDirty();
        if (filter && (filter.value === 'enabled' || filter.value === 'disabled')) { applyFilters(); }
      });
    });

    function syncAll() {
      syncBulk();
      syncCounts();
      syncSubfields();
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
        Array.prototype.slice.call(panel.querySelectorAll('.dbe-feature-group')).forEach(function (group) {
          group.hidden = false;
        });
      });
      wrap.classList.remove('dbe-filter-mode');
      bar.hidden = false;
      if (clearFilters) { clearFilters.hidden = true; }
      if (noResults) { noResults.hidden = true; }
      if (filterStatus) { filterStatus.textContent = ''; }
      if (savebar) { savebar.hidden = slug === 'dashboard' && !isDirty(); }
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
        var groups = Array.prototype.slice.call(panel.querySelectorAll('.dbe-feature-group'));
        if (groups.length) {
          groups.forEach(function (group) {
            var groupCount = 0;
            Array.prototype.slice.call(group.querySelectorAll('.dbe-field')).forEach(function (field) {
              var matches = fieldMatches(field, query, mode);
              field.hidden = !matches;
              if (matches) { groupCount += 1; panelCount += 1; count += 1; }
            });
            group.hidden = groupCount === 0;
          });
        } else {
          Array.prototype.slice.call(panel.querySelectorAll('.dbe-field')).forEach(function (field) {
            var matches = fieldMatches(field, query, mode);
            field.hidden = !matches;
            if (matches) { panelCount += 1; count += 1; }
          });
        }
        Array.prototype.slice.call(panel.querySelectorAll('.dbe-feature-group')).forEach(function (group) {
          if (!group.querySelector('.dbe-field')) { group.hidden = true; }
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
    syncOrientation();
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

    // The rail is vertical at width and horizontal below the CSS breakpoint, so
    // the arrow keys follow it: Up/Down for a vertical tab list, Left/Right for
    // a horizontal one, never both (APG). Orientation is read back from the
    // computed flex-direction rather than a breakpoint duplicated here, so the
    // stylesheet stays the single source of truth.
    function railIsVertical() {
      return getComputedStyle(bar).flexDirection === 'column';
    }

    function syncOrientation() {
      bar.setAttribute('aria-orientation', railIsVertical() ? 'vertical' : 'horizontal');
    }

    window.addEventListener('resize', syncOrientation);

    bar.addEventListener('keydown', function (e) {
      var idx = tabs.indexOf(document.activeElement);
      if (idx === -1) { return; }
      var vertical = railIsVertical();
      var next = null;
      if (e.key === (vertical ? 'ArrowDown' : 'ArrowRight')) { next = (idx + 1) % tabs.length; }
      if (e.key === (vertical ? 'ArrowUp' : 'ArrowLeft')) { next = (idx - 1 + tabs.length) % tabs.length; }
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

    form.addEventListener('change', function (e) {
      if (!e.target.classList.contains('dbe-switch--bulk')) { syncAll(); }
      updateDirty();
      if (filter && (filter.value === 'enabled' || filter.value === 'disabled')) { applyFilters(); }
    });

    if (dangerZone) { dangerZone.hidden = false; }
    if (resetDefaults) {
      resetDefaults.addEventListener('click', function () {
        // Reaches every tab, not just the visible one, so it asks first.
        if (resetDefaults.dataset.confirm && !window.confirm(resetDefaults.dataset.confirm)) { return; }
        settingsControls.forEach(function (control) {
          if (control.disabled && control.type === 'checkbox') { return; }
          var field = control.closest('.dbe-field');
          if (control.type === 'checkbox' && field) {
            control.checked = field.dataset.default === '1';
          } else if (control.dataset.default) {
            control.value = control.dataset.default;
          }
        });
        syncAll();
        updateDirty(savebar ? savebar.dataset.reset : '');
        applyFilters();
      });
    }

    // Click-to-load the intro video: no request reaches YouTube until asked.
    var facade = form.querySelector('.dbe-video-facade');
    if (facade) {
      facade.addEventListener('click', function () {
        var frame = document.createElement('iframe');
        frame.src = facade.dataset.embed;
        frame.title = facade.dataset.embedTitle;
        frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        frame.referrerPolicy = 'strict-origin-when-cross-origin';
        frame.allowFullscreen = true;
        facade.replaceWith(frame);
        frame.focus();
      });
    }

    // Dashboard summary rows are in-page links; with the tabs live, the same
    // click switches tab instead of scrolling to a panel that is hidden.
    Array.prototype.slice.call(form.querySelectorAll('a[data-goto-tab]')).forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        activate(link.dataset.gotoTab, true, false);
      });
    });

    presetButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        var changed = 0;
        (button.dataset.features || '').split(',').filter(Boolean).forEach(function (featureId) {
          var control = document.getElementById('dbe-f-' + featureId);
          if (!control || control.disabled || control.checked) { return; }
          control.checked = true;
          changed += 1;
        });
        if (presetStatus) {
          presetStatus.textContent = changed === 0
            ? presetStatus.dataset.none
            : (changed === 1 ? presetStatus.dataset.one : presetStatus.dataset.many.replace('%s', String(changed)));
        }
        syncAll();
        updateDirty(changed ? (savebar ? savebar.dataset.preset : '') : '');
        applyFilters();
      });
    });

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
    syncAll();
    updateDirty();
  });
})();

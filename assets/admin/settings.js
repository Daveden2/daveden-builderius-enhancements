/**
 * Settings screen: client-side tab filtering (APG tabs pattern).
 * Progressive enhancement — without this script every panel stays visible.
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    // Info disclosures: without JavaScript every full description is visible;
    // with it, collapse them behind the (revealed) info buttons.
    Array.prototype.slice.call(document.querySelectorAll('.dbe-info-btn')).forEach((btn) => {
      const more = document.getElementById(btn.getAttribute('aria-controls'));
      if (!more) { return; }
      more.hidden = true;
      btn.hidden = false;
      btn.setAttribute('aria-expanded', 'false');
      btn.addEventListener('click', () => {
        const open = more.hidden;
        more.hidden = !open;
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });

    const wrap = document.querySelector('.dbe-settings');
    const form = wrap ? wrap.querySelector('form') : null;
    const bar = wrap ? wrap.querySelector('.dbe-tabbar') : null;
    const tabs = bar ? Array.prototype.slice.call(bar.querySelectorAll('.dbe-tab')) : [];
    const panels = wrap ? Array.prototype.slice.call(wrap.querySelectorAll('.dbe-panel')) : [];
    if (!wrap || !form || !bar || !tabs.length || !panels.length) { return; }

    const STORE_KEY = 'dbeSettingsTab';
    const tools = form.querySelector('.dbe-settings-tools');
    const search = form.querySelector('.dbe-feature-search');
    const filter = form.querySelector('.dbe-feature-filter');
    const clearFilters = form.querySelector('.dbe-clear-filters');
    const noResults = form.querySelector('.dbe-no-results');
    const noResultsClear = form.querySelector('.dbe-no-results-clear');
    const filterStatus = form.querySelector('.dbe-filter-status');
    const resetDefaults = form.querySelector('.dbe-reset-defaults');
    const dangerZone = form.querySelector('.dbe-danger-zone');
    const presetButtons = Array.prototype.slice.call(form.querySelectorAll('.dbe-apply-preset'));
    const presetStatus = form.querySelector('.dbe-preset-status');
    const savebar = form.querySelector('.dbe-savebar');
    const saveStatus = form.querySelector('.dbe-save-status');
    const submit = form.querySelector('#submit');
    const fields = Array.prototype.slice.call(form.querySelectorAll('.dbe-field'));
    // Name-qualified: the bulk switches are controls over the other switches, not
    // settings, so they carry no name and must stay out of the dirty check and
    // out of reset-to-defaults.
    const settingsControls = Array.prototype.slice.call(
      form.querySelectorAll('input[name^="daveden_builder_enhancements"], select[name^="daveden_builder_enhancements"]')
    );
    const bulkSwitches = Array.prototype.slice.call(form.querySelectorAll('.dbe-switch--bulk'));
    let activeSlug = tabs[0].dataset.tab;
    let submitting = false;

    fields.forEach((field) => {
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
      const scope = bulk.dataset.bulk === 'tab'
        ? bulk.closest('.dbe-panel')
        : bulk.closest('.dbe-feature-group');
      if (!scope) { return []; }
      return Array.prototype.slice
        .call(scope.querySelectorAll('.dbe-field:not(.dbe-field--master) .dbe-switch'))
        .filter((control) => { return !control.disabled && !control.classList.contains('dbe-switch--bulk'); });
    }

    function syncBulk() {
      bulkSwitches.forEach((bulk) => {
        const targets = bulkTargets(bulk);
        // Rendered hidden, revealed only once it has something to govern: an
        // entirely Pro-locked group has no changeable switches, and without this
        // script running there is nothing to drive it at all. The switch and its
        // own label sit in different grid cells, so both follow; the section
        // description beside them is not the switch's and stays put.
        const wrap = bulk.closest('.dbe-bulk');
        const body = wrap.nextElementSibling;
        const text = body ? body.querySelector('.dbe-bulk__text') : null;
        wrap.hidden = !targets.length;
        if (text) { text.hidden = !targets.length; }
        if (!targets.length) { return; }
        const on = targets.filter((t) => { return t.checked; }).length;
        bulk.checked = on === targets.length;
        bulk.indeterminate = on > 0 && on < targets.length;
      });
    }

    function syncCounts() {
      const counts = {};
      panels.forEach((panel) => {
        const slug = panel.dataset.tab;
        const all = Array.prototype.slice
          .call(panel.querySelectorAll('.dbe-field:not(.dbe-field--master) .dbe-switch'))
          .filter((c) => { return !c.classList.contains('dbe-switch--bulk'); });
        if (!all.length) { return; }
        counts[slug] = { on: all.filter((c) => { return c.checked && !c.disabled; }).length, total: all.length };
      });
      Object.keys(counts).forEach((slug) => {
        const text = counts[slug].on + ' / ' + counts[slug].total;
        const chip = form.querySelector('[data-tabcount-for="' + slug + '"]');
        if (chip) { chip.textContent = text; }
        const line = form.querySelector('[data-count-for="' + slug + '"]');
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
      Array.prototype.slice.call(form.querySelectorAll('.dbe-field__sub[data-parent]')).forEach((sub) => {
        const parent = document.getElementById('dbe-f-' + sub.dataset.parent);
        if (!parent) { return; }
        const off = !parent.checked || parent.disabled;
        sub.classList.toggle('is-disabled', off);
        Array.prototype.slice.call(sub.querySelectorAll('select')).forEach((select) => {
          select.disabled = off;
        });
      });
    }

    bulkSwitches.forEach((bulk) => {
      bulk.addEventListener('change', () => {
        const targets = bulkTargets(bulk);
        // Part-on means "finish the job": only an entirely-on group turns off.
        const turnOn = targets.some((t) => { return !t.checked; });
        targets.forEach((t) => { t.checked = turnOn; });
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
      tabs.forEach((tab) => {
        const active = tab.dataset.tab === slug;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
        tab.tabIndex = active ? 0 : -1;
        if (active && focusTab) { tab.focus(); }
      });
      panels.forEach((panel) => {
        panel.hidden = panel.dataset.tab !== slug;
        Array.prototype.slice.call(panel.querySelectorAll('.dbe-field')).forEach((field) => {
          field.hidden = false;
        });
        Array.prototype.slice.call(panel.querySelectorAll('.dbe-feature-group')).forEach((group) => {
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
      const control = field.querySelector('.dbe-switch');
      if (mode === 'enabled') { return !!control && !control.disabled && control.checked; }
      if (mode === 'disabled') { return !!control && !control.disabled && !control.checked; }
      if (mode === 'experimental') { return field.dataset.experimental === '1'; }
      if (mode === 'unavailable') { return field.dataset.unavailable === '1'; }
      return true;
    }

    function applyFilters() {
      const query = search ? search.value.trim().toLowerCase() : '';
      const mode = filter ? filter.value : 'all';
      const filtering = !!query || mode !== 'all';
      if (!filtering) {
        activate(activeSlug, false, true);
        return;
      }

      let count = 0;
      wrap.classList.add('dbe-filter-mode');
      bar.hidden = true;
      if (clearFilters) { clearFilters.hidden = false; }
      panels.forEach((panel) => {
        if (panel.dataset.tab === 'dashboard') {
          panel.hidden = true;
          return;
        }
        let panelCount = 0;
        const groups = Array.prototype.slice.call(panel.querySelectorAll('.dbe-feature-group'));
        if (groups.length) {
          groups.forEach((group) => {
            let groupCount = 0;
            Array.prototype.slice.call(group.querySelectorAll('.dbe-field')).forEach((field) => {
              const matches = fieldMatches(field, query, mode);
              field.hidden = !matches;
              if (matches) { groupCount += 1; panelCount += 1; count += 1; }
            });
            group.hidden = groupCount === 0;
          });
        } else {
          Array.prototype.slice.call(panel.querySelectorAll('.dbe-field')).forEach((field) => {
            const matches = fieldMatches(field, query, mode);
            field.hidden = !matches;
            if (matches) { panelCount += 1; count += 1; }
          });
        }
        Array.prototype.slice.call(panel.querySelectorAll('.dbe-feature-group')).forEach((group) => {
          if (!group.querySelector('.dbe-field')) { group.hidden = true; }
        });
        panel.hidden = panelCount === 0;
      });
      if (noResults) { noResults.hidden = count !== 0; }
      if (savebar) { savebar.hidden = false; }
      if (filterStatus) {
        const template = count === 1 ? tools.dataset.resultOne : tools.dataset.resultMany;
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
    tabs.forEach((tab) => {
      tab.setAttribute('role', 'tab');
      tab.id = 'dbe-tab-' + tab.dataset.tab;
      // Completes the APG tabs pattern: the tab names the panel it controls.
      tab.setAttribute('aria-controls', 'dbe-panel-' + tab.dataset.tab);
    });
    panels.forEach((panel) => {
      panel.setAttribute('role', 'tabpanel');
      panel.id = 'dbe-panel-' + panel.dataset.tab;
      panel.setAttribute('aria-labelledby', 'dbe-tab-' + panel.dataset.tab);
    });

    bar.addEventListener('click', (e) => {
      const tab = e.target.closest('.dbe-tab');
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

    bar.addEventListener('keydown', (e) => {
      const idx = tabs.indexOf(document.activeElement);
      if (idx === -1) { return; }
      const vertical = railIsVertical();
      let next = null;
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
      search.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); }
      });
    }
    if (filter) { filter.addEventListener('change', applyFilters); }
    if (clearFilters) { clearFilters.addEventListener('click', clearAndActivate); }
    if (noResultsClear) { noResultsClear.addEventListener('click', clearAndActivate); }

    function controlValue(control) {
      return control.type === 'checkbox' ? (control.checked ? '1' : '0') : control.value;
    }

    const initialValues = settingsControls.map(controlValue);

    function isDirty() {
      return settingsControls.some((control, index) => {
        return controlValue(control) !== initialValues[index];
      });
    }

    function updateDirty(message) {
      const dirty = isDirty();
      if (savebar) { savebar.classList.toggle('is-dirty', dirty); }
      if (saveStatus && savebar) {
        saveStatus.textContent = dirty ? (message || savebar.dataset.dirty) : savebar.dataset.clean;
      }
      if (submit) { submit.disabled = !dirty; }
    }

    form.addEventListener('change', (e) => {
      if (!e.target.classList.contains('dbe-switch--bulk')) { syncAll(); }
      updateDirty();
      if (filter && (filter.value === 'enabled' || filter.value === 'disabled')) { applyFilters(); }
    });

    if (dangerZone) { dangerZone.hidden = false; }
    if (resetDefaults) {
      resetDefaults.addEventListener('click', () => {
        // Reaches every tab, not just the visible one, so it asks first.
        if (resetDefaults.dataset.confirm && !window.confirm(resetDefaults.dataset.confirm)) { return; }
        settingsControls.forEach((control) => {
          if (control.disabled && control.type === 'checkbox') { return; }
          const field = control.closest('.dbe-field');
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
    const facade = form.querySelector('.dbe-video-facade');
    if (facade) {
      facade.addEventListener('click', () => {
        const frame = document.createElement('iframe');
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
    Array.prototype.slice.call(form.querySelectorAll('a[data-goto-tab]')).forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        activate(link.dataset.gotoTab, true, false);
      });
    });

    presetButtons.forEach((button) => {
      button.addEventListener('click', () => {
        let changed = 0;
        (button.dataset.features || '').split(',').filter(Boolean).forEach((featureId) => {
          const control = document.getElementById('dbe-f-' + featureId);
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

    form.addEventListener('submit', () => { submitting = true; });
    window.addEventListener('beforeunload', (e) => {
      if (submitting || !isDirty()) { return; }
      e.preventDefault();
      e.returnValue = '';
    });

    let saved = null;
    try { saved = sessionStorage.getItem(STORE_KEY); } catch (e) { /* private mode */ }
    const initial = tabs.some((t) => { return t.dataset.tab === saved; }) ? saved : tabs[0].dataset.tab;
    activate(initial, false, true);
    syncAll();
    updateDirty();
  });
})();

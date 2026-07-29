(function () {
    'use strict';

    /* Workspace controllers register after builder.js supplies the shared
       lifecycle, Builderius adapter and command services. */
    var chunks = window.dbeBuilderChunks || {};

    chunks.workspace = function (host) {
        var on = host.on;
        var dbeT = host.translate;
        var dbeFmt = host.format;
        var CFG = host.config;
        var dbeQuery = host.query;
        var dbeNavigatorRow = host.builderius.navigatorRow;
        var activeId = host.builderius.activeId;
        var dbeBreakpoints = host.breakpoints;
        var schedule = host.schedule;
        var setTip = host.tooltip;
        var dbeSyncSelectionContext = host.syncSelectionContext;
        var dbeCanvasInteractive = host.canvas.interactive;
        var dbeSetCanvasInteractive = host.canvas.setInteractive;
        var dbeControllers = host.controllers;
        var dbeObserveChrome = host.observe;
        var dbeObserveFooter = host.observeFooter;
        var dbeUnobserveFooter = host.unobserveFooter;
        var dbeRememberOwnedAttributes = host.rememberOwnedAttributes;
        var dbeBindOwnedEvent = host.bindOwnedEvent;
        var dbeSetOwnedTimeout = host.setOwnedTimeout;
        var dbeSetOwnedFrame = host.setOwnedFrame;
        var dbeDestroyOwnedActivity = host.destroyOwnedActivity;
        var dbeDestroyOwnedGroups = host.destroyOwnedGroups;
        var DBE_WORKSPACE_OWNER = 'workspace';
        var dbeWorkspaceControllerActive = false;

        /* (i) Theme switcher: cycles light -> dark -> auto, persisted per browser.
           html[data-dbe-theme] selects the token palette (00-tokens.css) and sets
           color-scheme for native controls without per-element repainting. Monaco
           follows the resolved theme through the established stylesheet treatment. */
        var THEME_ORDER = ['light', 'dark', 'auto'];
        var THEME_ICONS = {
            light: '<circle cx="7" cy="7" r="3" stroke="currentColor" stroke-width="1.3"/><path d="M7 .9v1.7M7 11.4v1.7M.9 7h1.7M11.4 7h1.7M2.7 2.7l1.2 1.2M10.1 10.1l1.2 1.2M11.3 2.7l-1.2 1.2M3.9 10.1 2.7 11.3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
            dark:  '<path d="M12.1 8.5A5.5 5.5 0 0 1 5.5 1.9 5.6 5.6 0 1 0 12.1 8.5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
            auto:  '<circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.3"/><path d="M7 1.5a5.5 5.5 0 0 1 0 11Z" fill="currentColor"/>'
        };
        /* Translated display names for the theme/density keywords (the keywords
           themselves stay English — they are data attributes and storage keys). */
        function dbeModeName(mode) {
            return {
                light: dbeT('themeLight', 'light'),
                dark: dbeT('themeDark', 'dark'),
                auto: dbeT('themeAuto', 'auto'),
                comfortable: dbeT('densityComfortable', 'comfortable'),
                compact: dbeT('densityCompact', 'compact')
            }[mode] || mode;
        }

        /* Shared live region for the top-bar mode toggles (theme, density). The
           toggles rewrite their own aria-label on each click, but a focused button
           whose label changes silently is NOT re-announced by NVDA/VoiceOver, so
           the switch was inaudible. A role="status" region carries the result
           instead — the joshwcomeau pattern. Created eagerly when a toggle mounts
           (dbeEnsureModeStatus) so it is present in the DOM before the first update;
           a live region added and written in the same tick is unreliable. */
        var dbeModeStatus = null;
        function dbeEnsureModeStatus() {
            if (dbeModeStatus && document.body.contains(dbeModeStatus)) { return dbeModeStatus; }
            dbeModeStatus = document.createElement('div');
            dbeModeStatus.className = 'dbe-visually-hidden';
            dbeModeStatus.setAttribute('role', 'status');
            document.body.appendChild(dbeModeStatus);
            return dbeModeStatus;
        }
        function dbeModeAnnounce(msg) {
            dbeEnsureModeStatus().textContent = msg;
        }

        /* The MODE (light / dark / auto) lives in data-dbe-theme-mode + storage;
           data-dbe-theme only ever carries the RESOLVED light/dark (the bootstrap
           script resolves before first paint and follows OS changes while the
           mode is auto). The switcher cycles and displays the MODE. */
        function currentTheme() {
            var t = document.documentElement.dataset.dbeThemeMode;
            return THEME_ORDER.indexOf(t) !== -1 ? t : ((CFG.theme && CFG.theme.default) || 'auto');
        }
        function dbeResolveTheme(mode) {
            try {
                return mode === 'auto'
                    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                    : mode;
            } catch (e) { return mode === 'auto' ? 'dark' : mode; }
        }

        function decorateThemeButton(btn) {
            var t = currentTheme();
            var next = THEME_ORDER[(THEME_ORDER.indexOf(t) + 1) % THEME_ORDER.length];
            btn.querySelector('span').innerHTML =
                '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
                THEME_ICONS[t] + '</svg>';
            var tip = dbeFmt(dbeT('themeTip', 'Theme: %1$s (switch to %2$s)'), dbeModeName(t), dbeModeName(next));
            setTip(btn, tip);
            // setTip only sets aria-label when absent (it must not clobber static
            // controls an observer re-decorates); this label is dynamic, so keep the
            // accessible name in sync with the current state on every toggle.
            btn.setAttribute('aria-label', tip);
        }
        function setTheme(t, announce) {
            document.documentElement.dataset.dbeThemeMode = t;
            document.documentElement.dataset.dbeTheme = dbeResolveTheme(t);
            try { localStorage.setItem('dbeBuilderTheme', t); } catch (e) {}
            var btn = document.querySelector('.dbe-theme-btn');
            if (btn) { decorateThemeButton(btn); }
            // Only speak on a user switch, never on the initial restore.
            if (announce) { dbeModeAnnounce(dbeFmt(dbeT('themeAnnounce', 'Theme set to %s'), dbeModeName(t))); }
        }
        function ensureThemeButton() {
            var col = document.querySelector('.uniTopPanel__rightCol');
            if (!col || col.querySelector('.dbe-theme-btn')) { return; }
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'uniPanelButton dbe-theme-btn';
            btn.appendChild(document.createElement('span'));
            btn.addEventListener('click', function () {
                setTheme(THEME_ORDER[(THEME_ORDER.indexOf(currentTheme()) + 1) % THEME_ORDER.length], true);
            });
            decorateThemeButton(btn);
            dbeEnsureModeStatus(); // present before the first click so the switch is announced
            col.insertBefore(btn, col.firstChild);
        }

        /* (i2) Density toggle: comfortable <-> compact, persisted per browser.
           html[data-dbe-density] drives the row/padding tokens (62-density.css). */
        var DENSITY_ICONS = {
            comfortable: '<path d="M1.5 3h11M1.5 7h11M1.5 11h11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
            compact: '<path d="M1.5 2.4h11M1.5 5.4h11M1.5 8.4h11M1.5 11.4h11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>'
        };
        function currentDensity() {
            var d = document.documentElement.dataset.dbeDensity;
            return d === 'compact' ? 'compact' : 'comfortable';
        }
        function decorateDensityButton(btn) {
            var d = currentDensity();
            var next = d === 'compact' ? 'comfortable' : 'compact';
            btn.querySelector('span').innerHTML =
                '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
                DENSITY_ICONS[d] + '</svg>';
            var tip = dbeFmt(dbeT('densityTip', 'Density: %1$s (switch to %2$s)'), dbeModeName(d), dbeModeName(next));
            setTip(btn, tip);
            // Dynamic label — set explicitly so the accessible name tracks each toggle
            // (setTip won't overwrite an existing aria-label).
            btn.setAttribute('aria-label', tip);
        }
        function ensureDensityButton() {
            var col = document.querySelector('.uniTopPanel__rightCol');
            if (!col || col.querySelector('.dbe-density-btn')) { return; }
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'uniPanelButton dbe-density-btn';
            btn.appendChild(document.createElement('span'));
            btn.addEventListener('click', function () {
                var next = currentDensity() === 'compact' ? 'comfortable' : 'compact';
                document.documentElement.dataset.dbeDensity = next;
                try { localStorage.setItem('dbeBuilderDensity', next); } catch (e) {}
                decorateDensityButton(btn);
                dbeModeAnnounce(dbeFmt(dbeT('densityAnnounce', 'Density set to %s'), dbeModeName(next)));
            });
            decorateDensityButton(btn);
            dbeEnsureModeStatus(); // present before the first click so the switch is announced
            // Sit next to the theme button when both are on.
            var themeBtn = col.querySelector('.dbe-theme-btn');
            col.insertBefore(btn, themeBtn ? themeBtn.nextSibling : col.firstChild);
        }

        /* Move keyboard focus to one of the builder's regions. Targets are chosen for
           resilience: the Navigator hands off to navigator_keyboard's roving row; the
           settings panel and the quick-insert bar fall back to their container (given
           a -1 tabindex) when they have no focusable control mounted; the canvas is
           the preview iframe itself. */
        function dbeFocusArea(which, compactReady) {
            if (!compactReady && on('compact_panes') && dbeCompactActive()) {
                if (dbeSetCompactPane(which, { announce: true, focus: false })) {
                    dbeSetOwnedTimeout(DBE_WORKSPACE_OWNER, function () { dbeFocusArea(which, true); }, which === 'inserter' || which === 'settings' ? 140 : 0);
                }
                return;
            }
            /* On wide layouts the Element library and Element settings still share
               one native panel. A region shortcut must switch that native mode
               before choosing a focus target; otherwise "Element library" from
               Settings either does nothing or lands in the Navigator favourites. */
            if (!compactReady && (!on('compact_panes') || !dbeCompactActive())
                && (which === 'inserter' || which === 'settings')
                && dbeCompactLeftMode() !== which) {
                if (!dbeEnsureCompactLeftMode(which)) { return; }
                dbeSetOwnedTimeout(DBE_WORKSPACE_OWNER, function () { dbeFocusArea(which, true); }, 140);
                return;
            }
            var wrappers = dbePanelWrappers();
            var side = which === 'navigator' ? 'right' : ((which === 'settings' || which === 'inserter') ? 'left' : '');
            if (side && dbePanelSideHidden(side, wrappers[side])) {
                dbeSetPanelVisibility(side, false);
                dbeSetOwnedTimeout(DBE_WORKSPACE_OWNER, function () { dbeFocusArea(which); }, 120);
                return;
            }
            var el = null;
            if (which === 'navigator') {
                el = dbeNavigatorRow(activeId()) || dbeQuery('navigatorFirstRow');
                if (el) { el.setAttribute('tabindex', '0'); }
            } else if (which === 'settings') {
                // The settings panel shows the selected element's settings — nothing to
                // go to without a selection.
                if (!activeId()) { return; }
                var left = dbeQuery('leftPanel');
                el = (left && left.querySelector('button, input, select, textarea, a[href], [tabindex="0"]')) || left;
                if (el === left && left && left.tabIndex < 0) { left.setAttribute('tabindex', '-1'); }
            } else if (which === 'canvas') {
                el = dbeQuery('previewFrame');
            } else if (which === 'inserter') {
                el = document.querySelector('.uniModItems__item')
                    || document.querySelector('.uniModTree__favouritesListItem');
                if (el && el.tabIndex < 0 && !/^(a|button|input)$/i.test(el.tagName)) { el.setAttribute('tabindex', '-1'); }
            } else if (which === 'footer') {
                var footerBar = dbeQuery('footerBar');
                el = footerBar && (footerBar.querySelector('button[tabindex="0"]')
                    || footerBar.querySelector('button:not([disabled]):not([aria-disabled="true"])'));
            }
            if (!el) { return; }
            try { el.focus(); } catch (e) {}
            try { el.scrollIntoView({ block: 'nearest' }); } catch (e) {}
        }

        function ensureCanvasModeControl() {
            var toggle = document.querySelector('.overlayToggleIcon');
            if (!toggle) { return; }
            dbeRememberOwnedAttributes(DBE_WORKSPACE_OWNER, toggle, ['role', 'tabindex', 'aria-pressed', 'aria-label']);
            var interactive = dbeCanvasInteractive();
            var label = interactive
                ? dbeT('exitInteractiveCanvas', 'Select elements')
                : dbeT('enterInteractiveCanvas', 'Interact with page');
            if (toggle.getAttribute('role') !== 'button') { toggle.setAttribute('role', 'button'); }
            if (toggle.getAttribute('tabindex') !== '0') { toggle.setAttribute('tabindex', '0'); }
            if (toggle.getAttribute('aria-pressed') !== String(interactive)) { toggle.setAttribute('aria-pressed', String(interactive)); }
            if (toggle.getAttribute('aria-label') !== label) { toggle.setAttribute('aria-label', label); }
            dbeBindOwnedEvent(DBE_WORKSPACE_OWNER, toggle, 'canvas-mode-keys', 'keydown', function (e) {
                if (e.key !== 'Enter' && e.key !== ' ') { return; }
                e.preventDefault();
                e.stopPropagation();
                dbeSetCanvasInteractive(!dbeCanvasInteractive());
            });
        }

        /* Preview resize handles (preview_resize): drag either edge of the canvas
           to resize it around the centre — a container-query-style workflow.
           Width writes go through the builder's OWN top-bar width input
           (.uniGlobalBreakpoints__canvasControl input[name=width]): driving it
           with the native value setter + an input event makes React resize the
           canvas, keep the readout in sync AND highlight the breakpoint whose
           range the width falls into — identical to typing in the field. The one
           width that has no numeric equivalent is the base/"All" state (see
           dbeApplyPreviewWidth): a full-open drag selects it by clicking the base
           button rather than writing a width that would land on Desktop/Tablet. */
        var DBE_PREVIEW_MIN = 240;

        function dbeSetCanvasWidth(w) {
            var input = document.querySelector('.uniGlobalBreakpoints__canvasControl input[name="width"]');
            if (!input) { return false; }
            try {
                var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                setter.call(input, String(Math.round(w)));
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            } catch (e) { return false; }
        }

        function dbeCanvasInner() { return dbeQuery('canvasInner'); }

        function dbeCanvasMax() {
            var outer = dbeQuery('canvasOuter');
            return outer ? Math.round(outer.getBoundingClientRect().width) : window.innerWidth;
        }

        /* Widest breakpoint max (Desktop's "max 1279px" → 1279), 0 if unknown. */
        function dbeLargestBpMax() {
            var bps = dbeBreakpoints();
            var m = 0;
            if (bps) { bps.forEach(function (bp) { if (bp.width && bp.width > m) { m = bp.width; } }); }
            return m;
        }

        /* The breakpoint button whose range covers width w — the smallest max ≥ w,
           or the base/"All" button when w is wider than every breakpoint. Button
           order matches the breakpoint list (same pairing dbeAllBreakpointBtn
           relies on); null when the two cannot be paired. */
        function dbeBpBtnForWidth(w) {
            var btns = document.querySelectorAll('.uniPanelButtonBreakpoint');
            var bps = dbeBreakpoints();
            if (!btns.length || !bps || bps.length !== btns.length) { return null; }
            var best = -1, bestW = Infinity;
            for (var i = 0; i < bps.length; i++) {
                if (bps[i].width && w <= bps[i].width && bps[i].width < bestW) { best = i; bestW = bps[i].width; }
            }
            if (best !== -1) { return btns[best]; }
            for (var j = 0; j < bps.length; j++) { if (!bps[j].width) { return btns[j]; } }
            return btns[0];
        }

        /* The base/"All" (full-width, no media query) breakpoint button. It carries
           no width in the breakpoint list; in the top-bar row it sits first. */
        function dbeAllBreakpointBtn() {
            var btns = document.querySelectorAll('.uniPanelButtonBreakpoint');
            if (!btns.length) { return null; }
            var bps = dbeBreakpoints();
            if (bps && bps.length === btns.length) {
                for (var i = 0; i < bps.length; i++) {
                    if (!bps[i].width) { return btns[i]; }
                }
            }
            return btns[0];
        }

        /* --- Preview width channel ------------------------------------------------
           The builder couples canvas SIZE and breakpoint CONTEXT through one width
           input, and above the widest breakpoint it has no canvas size of its own: any
           width there is "All", which it renders at full width — the readout keeps
           your number but the canvas is pinned to full. To let the drag rest at any
           width past the widest breakpoint (previewing base styles wider than Desktop,
           what the container-query workflow wants), split the two sides of that
           boundary:

             - At/below the widest breakpoint — native drives both: dbeSetCanvasWidth
               sizes the canvas AND lights the Mobile/Tablet/Desktop band.
             - Between the widest breakpoint and full — keep the base/"All" context (one
               click as we cross in) but OWN the canvas width: write it as a plain inline
               width on the sized element, and set the readout value directly (no input
               event — an input event would send us back through the native path that
               pins to full). React leaves the inline width alone until something
               re-renders that element (picking a breakpoint does, and its write then
               replaces ours — which is why plain, not !important: an !important would
               survive and override those later clicks).
             - At full — the true native "All", no override, so the state stays clean. */

        function dbePreviewSetReadout(w) {
            var input = document.querySelector('.uniGlobalBreakpoints__canvasControl input[name="width"]');
            if (!input) { return; }
            try {
                var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                setter.call(input, String(Math.round(w)));
            } catch (e) {}
        }

        var dbePreviewOverriding = false;
        var dbePreviewWantW = 0;
        var dbePreviewGuardObserver = null;
        var dbePreviewGuardTimer = 0;
        var dbePreviewGuardRaf = 0;

        /* Hold the canvas at our width across React's re-render when we flip to the
           base/"All" context. Clicking that button makes React reset the sized element
           to full width, and its timing (a synchronous flush or a later effect) is not
           guaranteed — a plain re-apply can land a paint late and flash. Two channels:
           - a MutationObserver re-applies our inline width in the same microtask as
             React's reset, before the browser paints, so the canvas never flashes wide;
           - a rAF loop re-pins the readout INPUT, which React reverts too but via its
             value property (not an attribute), so the observer can't see it.
           Needed only around the context flip, so it self-stops shortly after the last
           override tick (and outright when the drag ends or leaves the zone) — which
           keeps it from ever fighting a later breakpoint click or a manual width entry. */
        function dbePreviewGuard(wantW) {
            dbePreviewWantW = wantW;
            var inner = dbeCanvasInner();
            if (inner && !dbePreviewGuardObserver && window.MutationObserver) {
                dbePreviewGuardObserver = new MutationObserver(function () {
                    if (!dbePreviewOverriding) { return; }
                    var el = dbeCanvasInner();
                    if (el && el.style.width !== dbePreviewWantW + 'px') {
                        el.style.width = dbePreviewWantW + 'px';
                    }
                });
                dbePreviewGuardObserver.observe(inner, { attributes: true, attributeFilter: ['style'] });
                dbePreviewGuardRaf = requestAnimationFrame(function tick() {
                    if (!dbePreviewGuardObserver) { return; }
                    if (dbePreviewOverriding) { dbePreviewSetReadout(dbePreviewWantW); }
                    dbePreviewGuardRaf = requestAnimationFrame(tick);
                });
            }
            if (dbePreviewGuardTimer) { clearTimeout(dbePreviewGuardTimer); }
            dbePreviewGuardTimer = setTimeout(dbePreviewGuardStop, 300);
        }
        function dbePreviewGuardStop() {
            if (dbePreviewGuardTimer) { clearTimeout(dbePreviewGuardTimer); dbePreviewGuardTimer = 0; }
            if (dbePreviewGuardRaf) { cancelAnimationFrame(dbePreviewGuardRaf); dbePreviewGuardRaf = 0; }
            if (dbePreviewGuardObserver) { dbePreviewGuardObserver.disconnect(); dbePreviewGuardObserver = null; }
        }

        function dbePreviewClearOverride() {
            dbePreviewGuardStop();
            if (!dbePreviewOverriding) { return; }
            var inner = dbeCanvasInner();
            if (inner) { inner.style.removeProperty('width'); }
            dbePreviewOverriding = false;
        }

        function dbeApplyPreviewWidth(w, max) {
            w = Math.round(w);
            var bpMax = dbeLargestBpMax();
            var inner = dbeCanvasInner();

            // Native "hide side panels" pins the canvas to width:100% and IGNORES
            // the numeric width channel entirely (verified: while hidden, a width
            // write updates the readout and the breakpoint band but never sizes
            // the canvas). Handing over to the native path mid-drag would collapse
            // the canvas — so while hidden, OWN the width across the WHOLE range
            // with the same inline+guard channel the above-widest zone uses, and
            // keep the breakpoint CONTEXT in step by clicking the matching band.
            if (inner && w < max && document.documentElement.classList.contains('dbe-panels-hidden')) {
                var band = dbeBpBtnForWidth(w);
                if (band && !band.classList.contains('active')) {
                    try { band.click(); } catch (e) {}
                }
                inner.style.width = w + 'px';
                dbePreviewOverriding = true;
                dbePreviewSetReadout(w);
                dbePreviewGuard(w); // re-assert across the band click's re-render
                return;
            }

            // Custom width strictly between the widest breakpoint and full: base/"All"
            // context, canvas sized by us.
            if (bpMax && inner && w > bpMax && w < max) {
                var all = dbeAllBreakpointBtn();
                if (all && !all.classList.contains('active')) {
                    try { all.click(); } catch (e) {}
                }
                inner.style.width = w + 'px';
                dbePreviewOverriding = true;
                dbePreviewSetReadout(w);
                dbePreviewGuard(w); // re-apply across React's post-click reset (no flash)
                return;
            }

            // Fully open: native full-width "All". Set the sized element to full
            // explicitly — when All was already active (we came from a custom width)
            // native won't reassert its 100% on its own, so just clearing our width
            // would collapse the canvas to nothing.
            if (w >= max) {
                dbePreviewGuardStop();
                var allBtn = dbeAllBreakpointBtn();
                if (allBtn && !allBtn.classList.contains('active')) {
                    try { allBtn.click(); } catch (e) {}
                }
                if (inner) { inner.style.width = '100%'; }
                dbePreviewOverriding = false;
                dbePreviewSetReadout(dbeCanvasMax());
                return;
            }

            // At/below the widest breakpoint: native owns size + band.
            dbePreviewClearOverride();
            dbeSetCanvasWidth(w);
        }

        /* Conditional writes: this also runs from schedule() to catch layout
           changes that move the canvas maximum (detaching/docking the Navigator,
           hiding the side panels), so it must not churn attributes every tick. */
        function dbeSyncHandleAria(handle) {
            var inner = dbeCanvasInner();
            if (!inner) { return; }
            var set = function (name, value) {
                if (handle.getAttribute(name) !== value) { handle.setAttribute(name, value); }
            };
            set('aria-valuemin', String(DBE_PREVIEW_MIN));
            set('aria-valuemax', String(dbeCanvasMax()));
            var width = Math.round(inner.getBoundingClientRect().width);
            set('aria-valuenow', String(width));
            set('aria-valuetext', dbeFmt(dbeT('pixelsWide', '%s pixels wide'), width));
        }

        function makePreviewHandle(edge) {
            var h = document.createElement('button');
            h.type = 'button';
            h.className = 'dbe-preview-handle';
            h.setAttribute('data-edge', edge);
            h.setAttribute('role', 'separator');
            h.setAttribute('aria-orientation', 'vertical');
            h.setAttribute('aria-label', edge === 'left'
                ? dbeT('resizePreviewLeft', 'Resize canvas from left edge')
                : dbeT('resizePreviewRight', 'Resize canvas from right edge'));

            var drag = null;
            h.addEventListener('pointerdown', function (ev) {
                var inner = dbeCanvasInner();
                if (!inner) { return; }
                ev.preventDefault();
                // Drag spans the whole available canvas: the widest breakpoint is a
                // boundary within it (dbeApplyPreviewWidth), not a ceiling.
                drag = { x: ev.clientX, w: inner.getBoundingClientRect().width, max: dbeCanvasMax(), raf: 0 };
                try { h.setPointerCapture(ev.pointerId); } catch (e) {}
                var panel = dbeQuery('canvasPanel');
                if (panel) { panel.classList.add('dbe-preview-resizing'); }
            });
            h.addEventListener('pointermove', function (ev) {
                if (!drag || drag.raf) { return; }
                // The canvas is centred, so a 1px pointer move changes the width
                // by 2px (both edges mirror around the middle).
                var delta = (ev.clientX - drag.x) * (edge === 'right' ? 2 : -2);
                var w = Math.max(DBE_PREVIEW_MIN, Math.min(drag.max, drag.w + delta));
                drag.raf = dbeSetOwnedFrame(DBE_WORKSPACE_OWNER, function () {
                    if (!drag) { return; }
                    drag.raf = 0;
                    dbeApplyPreviewWidth(w, drag.max);
                    dbeSyncHandleAria(h);
                });
            });
            function endPreviewDrag() {
                if (!drag) { return; }
                drag = null;
                var panel = dbeQuery('canvasPanel');
                if (panel) { panel.classList.remove('dbe-preview-resizing'); }
                // Release the guard now the drag is over, so it can never fight a
                // breakpoint click; the custom width stays as a plain inline value.
                dbePreviewGuardStop();
            }
            h.addEventListener('pointerup', endPreviewDrag);
            h.addEventListener('pointercancel', endPreviewDrag);

            h.addEventListener('keydown', function (ev) {
                var inner = dbeCanvasInner();
                if (!inner) { return; }
                var max = dbeCanvasMax();
                var w = inner.getBoundingClientRect().width;
                var step = ev.shiftKey ? 50 : 10;
                var next;
                switch (ev.key) {
                    case 'ArrowRight':
                    case 'ArrowUp':
                        next = w + step; break;
                    case 'ArrowLeft':
                    case 'ArrowDown':
                        next = w - step; break;
                    case 'Home': next = DBE_PREVIEW_MIN; break;
                    case 'End': next = max; break;
                    default: return;
                }
                // Handled keys must not reach the builder's global shortcuts
                // (arrows move the canvas selection).
                ev.preventDefault();
                ev.stopPropagation();
                dbeApplyPreviewWidth(Math.max(DBE_PREVIEW_MIN, Math.min(max, next)), max);
                dbeSyncHandleAria(h);
            });
            return h;
        }

        function ensurePreviewHandles() {
            var inner = dbeCanvasInner();
            if (!inner) { return; }
            // No native width input = no write channel; don't render dead handles.
            if (!document.querySelector('.uniGlobalBreakpoints__canvasControl input[name="width"]')) { return; }
            var existing = inner.querySelectorAll(':scope > .dbe-preview-handle');
            if (existing.length) {
                // The range moves whenever the canvas maximum does (Navigator
                // detached/docked, side panels hidden) — keep the ARIA in step.
                existing.forEach(dbeSyncHandleAria);
                return;
            }
            var left = makePreviewHandle('left');
            var right = makePreviewHandle('right');
            inner.appendChild(left);
            inner.appendChild(right);
            dbeSyncHandleAria(left);
            dbeSyncHandleAria(right);
        }

        /* Side-panel resize (panel_resize): drag the inner edge of either side panel
           to set ONE shared width for both — the settings/styles panel (left) and the
           Navigator (right) always match. The width is a single CSS custom property,
           --dbe-panel-width on <body>, that every panel-width rule reads (see
           75-panel-resize.css), so moving either handle moves both. The left panel is
           a normal flex item (the canvas reflows on its own); the right panel is an
           absolutely-positioned overlay whose reserved space lives in the iframe
           panel's own margin — 75-panel-resize.css re-points both at the variable,
           scoped to when the Navigator is actually mounted so a closed panel still
           gives the space back. Width persists in localStorage and re-applies after
           native re-renders. Keyboard: arrows nudge, Home/End jump to the clamp ends. */
        var DBE_PANEL_KEY = 'dbeBuilderPanelWidth';
        var DBE_PANEL_MIN = 260;
        var DBE_PANEL_MAX = 600;
        var DBE_PANEL_DEFAULT = 320;

        function dbePanelWidth() {
            var v = parseInt(getComputedStyle(document.body).getPropertyValue('--dbe-panel-width'), 10);
            return isNaN(v) ? DBE_PANEL_DEFAULT : v;
        }
        function dbeSetPanelWidth(w) {
            w = Math.max(DBE_PANEL_MIN, Math.min(DBE_PANEL_MAX, Math.round(w)));
            document.body.style.setProperty('--dbe-panel-width', w + 'px');
            try { localStorage.setItem(DBE_PANEL_KEY, String(w)); } catch (e) {}
            dbeSyncPanelHandlesAria();
            return w;
        }
        function dbeSyncPanelHandlesAria() {
            var w = dbePanelWidth();
            document.querySelectorAll('.dbe-panel-handle').forEach(function (h) {
                h.setAttribute('aria-valuemin', String(DBE_PANEL_MIN));
                h.setAttribute('aria-valuemax', String(DBE_PANEL_MAX));
                h.setAttribute('aria-valuenow', String(w));
                h.setAttribute('aria-valuetext', dbeFmt(dbeT('pixelsWide', '%s pixels wide'), w));
            });
        }

        function makePanelHandle(side) { // side: 'left' | 'right'
            var h = document.createElement('button');
            h.type = 'button';
            h.className = 'dbe-panel-handle';
            h.setAttribute('data-side', side);
            h.setAttribute('role', 'separator');
            h.setAttribute('aria-orientation', 'vertical');
            h.setAttribute('aria-label', side === 'left'
                ? dbeT('resizePanelLeft', 'Resize left panel')
                : dbeT('resizePanelRight', 'Resize right panel'));

            var drag = null;
            h.addEventListener('pointerdown', function (ev) {
                ev.preventDefault();
                drag = { raf: 0 };
                try { h.setPointerCapture(ev.pointerId); } catch (e) {}
                document.body.classList.add('dbe-panel-resizing');
            });
            h.addEventListener('pointermove', function (ev) {
                if (!drag || drag.raf) { return; }
                // Left panel's inner edge is measured from viewport x=0; the right
                // panel sits flush to the viewport's right edge.
                var vw = document.documentElement.clientWidth;
                var w = side === 'left' ? ev.clientX : (vw - ev.clientX);
                drag.raf = dbeSetOwnedFrame(DBE_WORKSPACE_OWNER, function () {
                    if (!drag) { return; }
                    drag.raf = 0;
                    dbeSetPanelWidth(w);
                });
            });
            function endPanelDrag() {
                if (!drag) { return; }
                drag = null;
                document.body.classList.remove('dbe-panel-resizing');
            }
            h.addEventListener('pointerup', endPanelDrag);
            h.addEventListener('pointercancel', endPanelDrag);

            h.addEventListener('keydown', function (ev) {
                var step = ev.shiftKey ? 40 : 10;
                var w = dbePanelWidth();
                var next;
                switch (ev.key) {
                    case 'ArrowRight':
                    case 'ArrowUp': next = w + step; break;
                    case 'ArrowLeft':
                    case 'ArrowDown': next = w - step; break;
                    case 'Home': next = DBE_PANEL_MIN; break;
                    case 'End': next = DBE_PANEL_MAX; break;
                    default: return;
                }
                // Keep arrows off the builder's global canvas-nudge shortcuts.
                ev.preventDefault();
                ev.stopPropagation();
                dbeSetPanelWidth(next);
            });
            return h;
        }

        /* The native "hide side panels" toggle collapses both panel wrappers with
           INLINE width/min-width/max-width: 0. Two of our stylesheets pin those
           same properties with !important — 75-panel-resize.css (deliberately, to
           beat the native resize bar's inline widths) and 40-css-code-default.css
           (the anti-auto-widen clamp) — which would pin the panels OPEN and make
           the native toggle look dead. So the native state is mirrored onto a
           root class here (called from schedule() whenever either feature is on),
           and every width-forcing rule in both files stands down while it is set.
           Detection reads the native mechanism itself (the inline max-width: 0),
           not the top-bar button, so it works with tooltips off. BOTH wrappers
           must be collapsed: the CSS vars tab collapses the LEFT panel on its own
           (while widening the right wrapper to 600px), and reading the left panel
           alone mistook that tab for the hide toggle — panels vanished and the
           width pins dropped every time it opened. */
        function dbePanelCollapsed(el) {
            return !!(el && /max-width:\s*0px/.test(el.getAttribute('style') || ''));
        }

        var DBE_PANEL_VISIBILITY_KEY = 'dbeBuilderPanelVisibility';
        var DBE_COMPACT_QUERY = '(max-width: 720px)';
        var dbeCompactMql = null;
        var dbeCompactPane = 'canvas';

        function dbeCompactMedia() {
            if (!dbeCompactMql) {
                try {
                    dbeCompactMql = window.matchMedia(DBE_COMPACT_QUERY);
                } catch (e) {}
            }
            if (dbeCompactMql && dbeWorkspaceControllerActive) {
                dbeBindOwnedEvent(DBE_WORKSPACE_OWNER, dbeCompactMql, 'compact-media-change', 'change', schedule);
            }
            return dbeCompactMql;
        }

        function dbeCompactActive() {
            var mq = dbeCompactMedia();
            return !!(mq && mq.matches && document.documentElement.classList.contains('dbe-compact-panes'));
        }

        function dbeCompactPaneLabel(pane) {
            return {
                inserter: dbeT('regionInserter', 'Element library'),
                settings: dbeT('regionSettings', 'Element settings'),
                canvas: dbeT('regionCanvas', 'Canvas'),
                navigator: dbeT('regionNavigator', 'Navigator')
            }[pane] || dbeT('regionCanvas', 'Canvas');
        }

        function dbeCompactElementsButton() {
            /* Compact CSS deliberately hides this native toggle. It still owns the
               Builderius state transition between the library and settings, so find
               it by structure rather than rendered visibility. */
            return document.querySelector(
                '.uniTopPanel__leftCol > .uniPanelButton:not(.uniPanelButton--builderiusMenu)'
            );
        }

        function dbeCompactLeftMode() {
            var left = document.querySelector('.uniLeftPanel');
            return left && left.querySelector('.uniModList') ? 'inserter' : 'settings';
        }

        function dbeEnsureCompactLeftMode(pane) {
            if (pane !== 'inserter' && pane !== 'settings') { return true; }
            if (pane === 'settings' && !activeId()) {
                dbeModeAnnounce(dbeT('compactSelectElement', 'Select an element before opening Element settings'));
                return false;
            }
            if (dbeCompactLeftMode() === pane) { return true; }
            var button = dbeCompactElementsButton();
            if (button) {
                /* This native control is a standard React onClick button. A full
                   synthetic pointer sequence does not complete the wide-layout
                   library/settings transition; one HTMLElement click is reliable
                   in both wide and compact views. */
                button.click();
                dbeSetOwnedTimeout(DBE_WORKSPACE_OWNER, schedule, 0);
            }
            return true;
        }

        function dbeCompactSelect() {
            return document.querySelector('.dbe-compact-pane-switcher select');
        }

        function dbeSyncCompactSelect() {
            var select = dbeCompactSelect();
            if (!select) { return; }
            var settings = select.querySelector('option[value="settings"]');
            if (settings) { settings.disabled = !activeId(); }
            if (select.value !== dbeCompactPane) { select.value = dbeCompactPane; }
        }

        function dbeEnsureCompactSwitcher() {
            var col = document.querySelector('.uniTopPanel__leftCol');
            if (!col) { return null; }
            var existing = col.querySelector('.dbe-compact-pane-switcher');
            if (existing) { return existing; }
            var label = document.createElement('label');
            label.className = 'dbe-compact-pane-switcher';
            var select = document.createElement('select');
            select.setAttribute('aria-label', dbeT('compactView', 'Builder view'));
            ['inserter', 'settings', 'canvas', 'navigator'].forEach(function (pane) {
                var option = document.createElement('option');
                option.value = pane;
                option.textContent = dbeCompactPaneLabel(pane);
                select.appendChild(option);
            });
            select.addEventListener('change', function () {
                dbeSetCompactPane(select.value, { announce: true, focus: true });
            });
            label.appendChild(select);
            var menu = col.querySelector('.uniPanelButton--builderiusMenu');
            col.insertBefore(label, menu ? menu.nextSibling : col.firstChild);
            return label;
        }

        function dbeSetCompactPane(pane, opts) {
            opts = opts || {};
            if (['inserter', 'settings', 'canvas', 'navigator'].indexOf(pane) === -1) { pane = 'canvas'; }
            if (!dbeEnsureCompactLeftMode(pane)) {
                dbeSyncCompactSelect();
                return false;
            }
            dbeCompactPane = pane;
            document.documentElement.dataset.dbeCompactPane = pane;
            dbeSyncCompactSelect();
            dbeSyncPanelsHidden();
            if (opts.announce) {
                dbeModeAnnounce(dbeFmt(
                    dbeT('compactViewChanged', '%s view shown'),
                    dbeCompactPaneLabel(pane)
                ));
            }
            if (opts.focus) {
                dbeSetOwnedTimeout(DBE_WORKSPACE_OWNER, function () { dbeFocusArea(pane, true); }, pane === 'inserter' || pane === 'settings' ? 140 : 0);
            }
            return true;
        }

        function dbeSetCompactAccessibility() {
            var wrappers = dbePanelWrappers();
            var canvas = dbeQuery('canvasPanel');
            var iframe = dbeQuery('previewFrame');
            var tabs = document.querySelector('.uniIframeTabs');
            var leftShown = dbeCompactPane === 'inserter' || dbeCompactPane === 'settings';
            var canvasShown = dbeCompactPane === 'canvas';
            var navigatorShown = dbeCompactPane === 'navigator';
            var active = document.activeElement;
            var hidingFocus = active && (
                (!leftShown && wrappers.left && wrappers.left.contains(active))
                || (!canvasShown && iframe && iframe === active)
                || (!navigatorShown && wrappers.right && wrappers.right.contains(active))
            );
            dbeSetPanelHiddenState(wrappers.left, !leftShown);
            dbeSetPanelHiddenState(wrappers.right, !navigatorShown);
            dbeSetPanelHiddenState(iframe, !canvasShown);
            dbeSetPanelHiddenState(tabs, !canvasShown);
            if (canvas) {
                dbeRememberOwnedAttributes(DBE_WORKSPACE_OWNER, canvas, ['role', 'aria-label']);
                if (leftShown) {
                    dbeSetPanelHiddenState(canvas, true);
                } else {
                    dbeSetPanelHiddenState(canvas, false);
                }
                if (navigatorShown) {
                    canvas.setAttribute('role', 'presentation');
                    canvas.removeAttribute('aria-label');
                } else if (canvasShown) {
                    canvas.setAttribute('role', 'region');
                    canvas.setAttribute('aria-label', dbeT('regionCanvas', 'Canvas'));
                }
            }
            document.documentElement.classList.toggle('dbe-panels-hidden', canvasShown);
            if (hidingFocus) {
                var select = dbeCompactSelect();
                if (select) { try { select.focus(); } catch (e) {} }
            }
            return canvasShown;
        }

        function ensureCompactPanes() {
            var mq = dbeCompactMedia();
            var root = document.documentElement;
            if (!mq || !mq.matches) {
                var switcher = document.querySelector('.dbe-compact-pane-switcher');
                var restoreFocus = !!(switcher && switcher.contains(document.activeElement));
                if (switcher) { switcher.remove(); }
                root.classList.remove('dbe-compact-panes');
                delete root.dataset.dbeCompactPane;
                dbeSetPanelHiddenState(dbeQuery('canvasPanel'), false);
                dbeSetPanelHiddenState(dbeQuery('previewFrame'), false);
                dbeSetPanelHiddenState(document.querySelector('.uniIframeTabs'), false);
                if (restoreFocus) {
                    var frame = dbeQuery('previewFrame');
                    if (frame) { try { frame.focus(); } catch (e) {} }
                }
                return false;
            }
            root.classList.add('dbe-compact-panes');
            var seeded = root.dataset.dbeCompactPane;
            if (['inserter', 'settings', 'canvas', 'navigator'].indexOf(seeded) !== -1) {
                dbeCompactPane = seeded;
            }
            if ((dbeCompactPane === 'inserter' || dbeCompactPane === 'settings') && dbeCompactLeftMode() !== dbeCompactPane) {
                dbeCompactPane = dbeCompactLeftMode();
                root.dataset.dbeCompactPane = dbeCompactPane;
            } else if (!root.dataset.dbeCompactPane) {
                root.dataset.dbeCompactPane = dbeCompactPane;
            }
            dbeEnsureCompactSwitcher();
            dbeSyncCompactSelect();
            return true;
        }

        function dbePanelVisibility() {
            var state = {};
            try { state = JSON.parse(localStorage.getItem(DBE_PANEL_VISIBILITY_KEY) || '{}') || {}; } catch (e) {}
            return { left: state.left === true, right: state.right === true };
        }

        function dbeApplyPanelVisibility(state) {
            var next = state || dbePanelVisibility();
            document.documentElement.classList.toggle('dbe-left-panel-hidden', next.left);
            document.documentElement.classList.toggle('dbe-right-panel-hidden', next.right);
            return next;
        }

        function dbeSavePanelVisibility(state) {
            var next = { left: state.left === true, right: state.right === true };
            try { localStorage.setItem(DBE_PANEL_VISIBILITY_KEY, JSON.stringify(next)); } catch (e) {}
            dbeApplyPanelVisibility(next);
            dbeSyncPanelsHidden();
            return next;
        }

        function dbeSetPanelVisibility(side, hidden) {
            var state = dbePanelVisibility();
            state[side] = !!hidden;
            return dbeSavePanelVisibility(state);
        }

        function dbePanelWrappers() {
            var rp = dbeQuery('navigatorPanel');
            return {
                left: dbeQuery('leftPanelOuter'),
                right: rp && rp.parentElement
            };
        }

        function dbePanelsAreHidden() {
            var wrappers = dbePanelWrappers();
            return dbePanelSideHidden('left', wrappers.left) && (!wrappers.right || dbePanelSideHidden('right', wrappers.right));
        }

        function dbePanelSideHidden(side, wrapper) {
            if (on('compact_panes') && dbeCompactActive()) {
                if (side === 'left') { return dbeCompactPane !== 'inserter' && dbeCompactPane !== 'settings'; }
                if (side === 'right') { return dbeCompactPane !== 'navigator'; }
            }
            return document.documentElement.classList.contains('dbe-' + side + '-panel-hidden') || dbePanelCollapsed(wrapper);
        }

        function dbeSidePanelsButton() {
            return [].slice.call(document.querySelectorAll('.uniTopPanel__rightCol .uniPanelButton')).filter(function (b) {
                var path = b.querySelector('svg path');
                return path && (path.getAttribute('d') || '').indexOf('M14.4551') === 0;
            })[0] || null;
        }

        function dbeSyncPanelToggle(button, hidden) {
            if (!button) { return; }
            dbeRememberOwnedAttributes(DBE_WORKSPACE_OWNER, button, ['aria-label', 'aria-pressed', 'data-dbe-tip']);
            var label = hidden ? dbeT('showSidePanels', 'Show side panels') : dbeT('hideSidePanels', 'Hide side panels (full-width canvas)');
            if (button.getAttribute('aria-label') !== label) { button.setAttribute('aria-label', label); }
            var pressed = hidden ? 'true' : 'false';
            if (button.getAttribute('aria-pressed') !== pressed) { button.setAttribute('aria-pressed', pressed); }
            if (on('tooltips') && button.getAttribute('data-dbe-tip') !== label) { button.setAttribute('data-dbe-tip', label); }
            if (on('command_palette')) {
                dbeBindOwnedEvent(DBE_WORKSPACE_OWNER, button, 'persisted-panels', 'click', function (event) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    var nextHidden = !dbePanelsAreHidden();
                    dbeSavePanelVisibility({ left: nextHidden, right: nextHidden });
                }, true);
            }
        }

        function dbeSetPanelHiddenState(wrapper, hidden) {
            if (!wrapper) { return; }
            dbeRememberOwnedAttributes(DBE_WORKSPACE_OWNER, wrapper, ['inert', 'aria-hidden']);
            if (hidden) {
                if (!wrapper.hasAttribute('inert')) { wrapper.setAttribute('inert', ''); }
                if (wrapper.getAttribute('aria-hidden') !== 'true') { wrapper.setAttribute('aria-hidden', 'true'); }
            } else {
                if (wrapper.hasAttribute('inert')) { wrapper.removeAttribute('inert'); }
                if (wrapper.hasAttribute('aria-hidden')) { wrapper.removeAttribute('aria-hidden'); }
            }
        }

        function dbeSyncPanelsHidden() {
            if (on('command_palette')) { dbeApplyPanelVisibility(); }
            if (on('compact_panes') && dbeCompactActive()) {
                var compactCanvas = dbeSetCompactAccessibility();
                if (on('reveal_selected')) { try { dbeSyncSelectionContext(); } catch (e) {} }
                return compactCanvas;
            }
            var wrappers = dbePanelWrappers();
            var leftHidden = dbePanelSideHidden('left', wrappers.left);
            var rightHidden = !wrappers.right || dbePanelSideHidden('right', wrappers.right);
            var hidden = dbePanelsAreHidden();
            if (document.activeElement &&
                ((leftHidden && wrappers.left && wrappers.left.contains(document.activeElement)) ||
                    (rightHidden && wrappers.right && wrappers.right.contains(document.activeElement)))) {
                var fallback = document.querySelector('.dbe-palette-btn') || dbeQuery('previewFrame') || dbeSidePanelsButton();
                if (fallback) { try { fallback.focus(); } catch (e) {} }
            }
            document.documentElement.classList.toggle('dbe-panels-hidden', hidden);
            dbeSetPanelHiddenState(wrappers.left, leftHidden);
            dbeSetPanelHiddenState(wrappers.right, rightHidden);
            dbeSyncPanelToggle(dbeSidePanelsButton(), hidden);
            if (on('reveal_selected')) { try { dbeSyncSelectionContext(); } catch (e) {} }
            return hidden;
        }

        function dbeToggleSidePanels(done) {
            var wantHidden = !dbePanelsAreHidden();
            dbeSavePanelVisibility({ left: wantHidden, right: wantHidden });
            if (done) { done(true); }
            return true;
        }

        function ensurePanelHandles() {
            // Left settings/inserter panel — grip on its inner (right) edge. The outer
            // is made position:relative by 75-panel-resize.css so the absolute grip
            // anchors to it without taking flex space.
            var lpo = document.querySelector('.uniLeftPanelOuter');
            if (lpo && !lpo.querySelector(':scope > .dbe-panel-handle')) {
                lpo.appendChild(makePanelHandle('left'));
            }
            // Right Navigator panel — grip on its inner (left) edge, appended to the
            // absolutely-positioned wrapper so panel overflow can't clip it.
            var rp = document.querySelector('.uniRightPanel');
            var rpWrap = rp && rp.parentElement;
            if (rpWrap && !rpWrap.querySelector(':scope > .dbe-panel-handle')) {
                rpWrap.appendChild(makePanelHandle('right'));
            }
            dbeSyncPanelHandlesAria();
        }

        /* Seed --dbe-panel-width from the stored value before the handles mount.
           The FIRST-paint seed actually happens earlier, in the wp_head bootstrap
           (output-builder.php), inline on <html> — this script only runs once the
           SPA has mounted, ~1s after the canvas painted, and seeding only here
           made a stored width visibly snap the canvas. This body-level write
           remains the live channel the drag handles use, and a belt-and-braces
           re-seed in case head output was filtered away. Clamp mirrors the
           bootstrap's. */
        function applyStoredPanelWidth() {
            var v;
            try { v = parseInt(localStorage.getItem(DBE_PANEL_KEY), 10); } catch (e) {}
            if (!isNaN(v)) {
                document.body.style.setProperty('--dbe-panel-width',
                    Math.max(DBE_PANEL_MIN, Math.min(DBE_PANEL_MAX, v)) + 'px');
            }
        }

        /* Detachable Navigator (panel_detach, experimental): float the Navigator free
           of the docked layout so it can sit over the canvas. We do NOT move the
           React-owned panel node (that would sever its store bindings) — instead we
           switch its absolutely-positioned wrapper to position:fixed and drive its box
           from CSS vars (--dbe-nav-x/y/w/h) that 76-panel-detach.css reads, and the
           canvas reclaims the docked column via body.dbe-nav-detached. Drag by the
           panel header, resize from the bottom-inline-end grip. The detached flag and
           geometry persist in localStorage and re-apply idempotently after native
           re-renders (CSS vars + a body class, never one-shot inline writes). */
        var DBE_NAV_KEY = 'dbeBuilderNavFloat';
        var DBE_NAV_MIN_W = 240;
        var DBE_NAV_MIN_H = 200;
        function navWrap() {
            var rp = document.querySelector('.uniRightPanel');
            return rp ? rp.parentElement : null;
        }
        function navFloatState() {
            try { return JSON.parse(localStorage.getItem(DBE_NAV_KEY)) || null; } catch (e) { return null; }
        }
        function saveNavFloat(st) {
            try { localStorage.setItem(DBE_NAV_KEY, JSON.stringify(st)); } catch (e) {}
        }
        /* Keep the floating panel inside the viewport (below the ~47px top bar), with
           a sensible minimum size. */
        function clampNav(st) {
            var vw = document.documentElement.clientWidth;
            var vh = document.documentElement.clientHeight;
            st.w = Math.max(DBE_NAV_MIN_W, Math.min(st.w, vw));
            st.h = Math.max(DBE_NAV_MIN_H, Math.min(st.h, vh - 47));
            st.x = Math.max(0, Math.min(st.x, vw - 40));
            st.y = Math.max(47, Math.min(st.y, vh - 40));
            return st;
        }
        function applyNavFloatVars(st) {
            var r = document.documentElement.style;
            r.setProperty('--dbe-nav-x', st.x + 'px');
            r.setProperty('--dbe-nav-y', st.y + 'px');
            r.setProperty('--dbe-nav-w', st.w + 'px');
            r.setProperty('--dbe-nav-h', st.h + 'px');
        }

        function detachNav() {
            var wrap = navWrap();
            if (!wrap) { return; }
            var st = navFloatState();
            if (!st || !st.detached) {
                // Seed geometry from the panel's current docked box so it floats in place.
                var r = wrap.getBoundingClientRect();
                st = { detached: true, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
            } else {
                st.detached = true;
            }
            clampNav(st);
            applyNavFloatVars(st);
            document.body.classList.add('dbe-nav-detached');
            saveNavFloat(st);
            syncDetachButton();
            dbeNavRescheduled();
        }
        function dockNav() {
            document.body.classList.remove('dbe-nav-detached');
            var st = navFloatState() || {};
            st.detached = false;
            saveNavFloat(st);
            syncDetachButton();
            dbeNavRescheduled();
        }
        /* The canvas maximum moves when the Navigator detaches or docks — resync
           the preview-handle ARIA now, and again once the canvas reclaim
           transition (76-panel-detach.css, .25s) has settled on the final width. */
        function dbeNavRescheduled() {
            schedule();
            dbeSetOwnedTimeout(DBE_WORKSPACE_OWNER, schedule, 300);
        }
        function toggleNav() {
            if (document.body.classList.contains('dbe-nav-detached')) { dockNav(); } else { detachNav(); }
        }

        var DETACH_SVG = '<svg width="13" height="13" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
            '<path d="M8 1.5h4.5V6M12.5 1.5 7 7M6 2H2.5A1 1 0 0 0 1.5 3v8.5a1 1 0 0 0 1 1H11a1 1 0 0 0 1-1V8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>' +
            '</svg>';


        function syncDetachButton() {
            var btn = document.querySelector('.uniRightPanel .dbe-detach-btn');
            if (!btn) { return; }
            var floating = document.body.classList.contains('dbe-nav-detached');
            btn.classList.toggle('is-detached', floating);
            btn.setAttribute('aria-pressed', floating ? 'true' : 'false');
            var label = floating ? dbeT('dockPanel', 'Dock panel') : dbeT('detachPanel', 'Detach panel');
            btn.setAttribute('aria-label', label);
            // Prefer our branded chip. The label is dynamic (Detach ↔ Dock), so this
            // button can't ride the static DBE_TIPS list like the other header icons
            // — set data-dbe-tip here and drop the native title so the two never
            // double up. With the tooltips feature off, fall back to the title.
            if (on('tooltips')) {
                btn.setAttribute('data-dbe-tip', label);
                btn.removeAttribute('title');
            } else {
                btn.title = label;
                btn.removeAttribute('data-dbe-tip');
            }
        }

        function ensureDetachButton() {
            var icons = document.querySelector('.uniRightPanel .uniPanelHeader__icons');
            if (!icons || icons.querySelector('.dbe-detach-btn')) { return; }
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'uniPanelIconButton uniPanelIconButtonSmall dbe-detach-btn';
            btn.innerHTML = '<span>' + DETACH_SVG + '</span>';
            btn.addEventListener('click', toggleNav);
            icons.appendChild(btn);
            syncDetachButton();
        }

        /* Inject a visible drag handle at the top of the header. The header itself is
           the drag surface (bindNavHeaderDrag), but nothing told users so; this marks
           where to grab. A centred horizontal bar (styled in 76-panel-detach.css) reads
           as "drag to move" the way a bottom-sheet grabber does. A decorative <span>
           (not a button) so the delegated header-drag handler — which ignores
           buttons/inputs — still fires on it. Re-added each schedule() tick, so it
           survives the header re-rendering. */
        function ensureNavGrip() {
            var header = document.querySelector('.uniRightPanel .uniPanelHeader');
            if (!header || header.querySelector(':scope > .dbe-nav-grip')) { return; }
            var grip = document.createElement('span');
            grip.className = 'dbe-nav-grip';
            grip.setAttribute('aria-hidden', 'true');
            grip.title = dbeT('dragToMove', 'Drag to move');
            header.insertBefore(grip, header.firstChild);
        }

        function ensureNavResizeGrip() {
            var wrap = navWrap();
            if (!wrap || wrap.querySelector(':scope > .dbe-nav-resize')) { return; }
            var grip = document.createElement('button');
            grip.type = 'button';
            grip.className = 'dbe-nav-resize';
            grip.setAttribute('aria-label', dbeT('resizePanel', 'Resize panel'));
            var drag = null;
            grip.addEventListener('pointerdown', function (ev) {
                ev.preventDefault();
                ev.stopPropagation();
                var st = navFloatState() || {};
                drag = { x: ev.clientX, y: ev.clientY, w: st.w, h: st.h, raf: 0 };
                try { grip.setPointerCapture(ev.pointerId); } catch (e) {}
                document.body.classList.add('dbe-nav-dragging');
            });
            grip.addEventListener('pointermove', function (ev) {
                if (!drag || drag.raf) { return; }
                drag.raf = dbeSetOwnedFrame(DBE_WORKSPACE_OWNER, function () {
                    if (!drag) { return; }
                    drag.raf = 0;
                    var st = navFloatState() || {};
                    st.w = drag.w + (ev.clientX - drag.x);
                    st.h = drag.h + (ev.clientY - drag.y);
                    clampNav(st);
                    applyNavFloatVars(st);
                    saveNavFloat(st);
                });
            });
            function end() { if (drag) { drag = null; document.body.classList.remove('dbe-nav-dragging'); } }
            grip.addEventListener('pointerup', end);
            grip.addEventListener('pointercancel', end);
            wrap.appendChild(grip);
        }

        /* Drag the whole float by its header (delegated + bound once on document, so
           it survives the header re-rendering). Ignores clicks on the header's own
           buttons so the detach/collapse/expand icons still work. */
        function bindNavHeaderDrag() {
            var drag = null;
            dbeBindOwnedEvent(DBE_WORKSPACE_OWNER, document, 'navigator-drag-start', 'pointerdown', function (ev) {
                if (!document.body.classList.contains('dbe-nav-detached')) { return; }
                var header = ev.target.closest && ev.target.closest('.uniRightPanel .uniPanelHeader');
                if (!header) { return; }
                if (ev.target.closest('button, input, [contenteditable="true"]')) { return; }
                var st = navFloatState();
                if (!st) { return; }
                ev.preventDefault();
                drag = { px: ev.clientX, py: ev.clientY, x: st.x, y: st.y, raf: 0 };
                document.body.classList.add('dbe-nav-dragging');
            }, true);
            dbeBindOwnedEvent(DBE_WORKSPACE_OWNER, document, 'navigator-drag-move', 'pointermove', function (ev) {
                if (!drag || drag.raf) { return; }
                drag.raf = dbeSetOwnedFrame(DBE_WORKSPACE_OWNER, function () {
                    if (!drag) { return; }
                    drag.raf = 0;
                    var st = navFloatState() || {};
                    st.x = drag.x + (ev.clientX - drag.px);
                    st.y = drag.y + (ev.clientY - drag.py);
                    clampNav(st);
                    applyNavFloatVars(st);
                    saveNavFloat(st);
                });
            }, true);
            function end() { if (drag) { drag = null; document.body.classList.remove('dbe-nav-dragging'); } }
            dbeBindOwnedEvent(DBE_WORKSPACE_OWNER, document, 'navigator-drag-end', 'pointerup', end, true);
            dbeBindOwnedEvent(DBE_WORKSPACE_OWNER, document, 'navigator-drag-cancel', 'pointercancel', end, true);
        }

        /* Called from schedule(): keep the detach button + resize grip present, and
           re-assert the floating state (body class + CSS vars) after re-renders. */
        function ensureNavDetach() {
            ensureDetachButton();
            ensureNavGrip();
            ensureNavResizeGrip();
            bindNavHeaderDrag();
            var st = navFloatState();
            if (st && st.detached) {
                clampNav(st);
                applyNavFloatVars(st);
                if (!document.body.classList.contains('dbe-nav-detached')) {
                    document.body.classList.add('dbe-nav-detached');
                }
            }
            syncDetachButton();
        }

        host.setWorkspaceApi(Object.freeze({
            focusArea: dbeFocusArea,
            compactActive: dbeCompactActive,
            panelWrappers: dbePanelWrappers,
            panelSideHidden: dbePanelSideHidden,
            toggleSidePanels: dbeToggleSidePanels,
            setPanelVisibility: dbeSetPanelVisibility
        }));

        function dbeObserveWorkspace() {
            var main = dbeQuery('mainPanel');
            dbeObserveChrome('workspace-main', main, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'style']
            });
            dbeObserveChrome('workspace-top', (on('compact_panes') || on('theme_switcher') || on('density_toggle')) ? dbeQuery('topPanel') : null, {
                childList: true,
                subtree: true
            });
            if (on('keyboard_shortcuts')) { dbeObserveFooter(dbeQuery('footerBar'), 'workspace-footer'); }
            else { dbeUnobserveFooter('workspace-footer'); }
        }
        function dbeRefreshWorkspace() {
            if (!dbeWorkspaceControllerActive) { return; }
            dbeObserveWorkspace();
            if (on('keyboard_shortcuts')) { ensureCanvasModeControl(); }
            if (on('preview_resize')) { ensurePreviewHandles(); }
            if (on('compact_panes')) { ensureCompactPanes(); }
            dbeSyncPanelsHidden();
            if (on('panel_resize')) { ensurePanelHandles(); }
            if (on('panel_detach')) { ensureNavDetach(); }
            if (on('theme_switcher')) { ensureThemeButton(); }
            if (on('density_toggle')) { ensureDensityButton(); }
        }
        function dbeRestoreWorkspaceState() {
            var root = document.documentElement;
            var body = document.body;
            dbePreviewClearOverride();
            dbeObserveChrome('workspace-main', null);
            dbeObserveChrome('workspace-top', null);
            dbeUnobserveFooter('workspace-footer');
            dbeDestroyOwnedActivity(DBE_WORKSPACE_OWNER);
            dbeDestroyOwnedGroups(DBE_WORKSPACE_OWNER);
            document.querySelectorAll(
                '.dbe-preview-handle, .dbe-panel-handle, .dbe-compact-pane-switcher, ' +
                '.dbe-detach-btn, .dbe-nav-grip, .dbe-nav-resize, .dbe-theme-btn, .dbe-density-btn'
            ).forEach(function (node) { node.remove(); });
            if (dbeModeStatus) { dbeModeStatus.remove(); }
            dbeModeStatus = null;
            root.classList.remove(
                'dbe-compact-panes', 'dbe-panels-hidden',
                'dbe-left-panel-hidden', 'dbe-right-panel-hidden'
            );
            delete root.dataset.dbeCompactPane;
            ['--dbe-panel-width', '--dbe-nav-x', '--dbe-nav-y', '--dbe-nav-w', '--dbe-nav-h'].forEach(function (name) {
                root.style.removeProperty(name);
            });
            if (body) {
                body.classList.remove('dbe-nav-detached', 'dbe-nav-dragging', 'dbe-panel-resizing');
                body.style.removeProperty('--dbe-panel-width');
            }
            var canvas = dbeQuery('canvasPanel');
            if (canvas) { canvas.classList.remove('dbe-preview-resizing'); }
            dbeCompactMql = null;
            dbeCompactPane = 'canvas';
        }
        function destroyWorkspace() {
            dbeWorkspaceControllerActive = false;
            dbeRestoreWorkspaceState();
        }
        dbeControllers.register(DBE_WORKSPACE_OWNER, {
            init: function (context) {
                if (!context || !context.builderius) { return; }
                dbeWorkspaceControllerActive = true;
                if (on('panel_resize')) { applyStoredPanelWidth(); }
                if (on('panel_detach')) {
                    var navState = navFloatState();
                    if (navState && navState.detached) {
                        applyNavFloatVars(clampNav(navState));
                        document.body.classList.add('dbe-nav-detached');
                    }
                }
                dbeRefreshWorkspace();
            },
            refresh: function (reason) {
                if (reason) { dbeRefreshWorkspace(); }
            },
            destroy: function () {
                destroyWorkspace();
            }
        }, on('preview_resize') || on('panel_resize') || on('compact_panes') ||
            on('panel_detach') || on('keyboard_shortcuts') || on('command_palette') ||
            on('css_code_default') || on('panel_tabs') || on('reveal_selected') ||
            on('theme_switcher') || on('density_toggle'));
    };

    window.dbeBuilderChunks = chunks;
})();

(function () {
    'use strict';

    /* Styles-domain controllers register after builder.js supplies the shared
       lifecycle, Builderius adapter, editing helpers and command services. */
    const chunks = window.dbeBuilderChunks || {};

    chunks.styles = function (host) {
        const on = host.on;
        const dbeT = host.translate;
        const dbeFmt = host.format;
        const dbeQuery = host.query;
        const store = host.builderius.store;
        const activeId = host.builderius.activeId;
        const clickSeq = host.click;
        const waitFor = host.waitFor;
        const schedule = host.schedule;
        const dbeControllers = host.controllers;
        const dbeObserveChrome = host.observe;
        const dbeSetOwnedTimeout = host.setOwnedTimeout;
        const dbeSetOwnedFrame = host.setOwnedFrame;
        const dbeDestroyOwnedActivity = host.destroyOwnedActivity;
        const NEED_STYLES = host.needStyles;

    /* Reliable state detection. .monaco-editor and .uniModCssCatWrapper are NOT
       code-mode markers — the Content field also mounts a Monaco editor, and the
       category wrapper is reused by the Content tab. The CSS code editor is the
       only view that renders .uniSettingsPageModuleDataForEditorWrapper. */
    function isCssCodeMode(lp) {
        return !!lp.querySelector('.uniSettingsPageModuleDataForEditorWrapper');
    }
    function nativeStripActiveTab(lp) {
        const strip = lp.querySelector('.uniPanelTabs');           // native tab strip (absent in code mode)
        const active = strip && strip.querySelector('.uniPanelTabs__tab.active:not(.dbe-code-tab)');
        return active ? (active.textContent || '').trim() : null;
    }

    function dbeStyleCurrentSelector() {
        try { return store().storeGet('activeSelector') || ''; } catch (e) { return ''; }
    }

    /* (f) Styles tab -> default to the CSS code editor, and disable the visual
       accordion. Builderius' CSS-mode (.uniIconCssMode) is a GLOBAL, sticky
       toggle. Whenever the native Styles tab is the active view (and we are not
       already in code mode), flip to the code editor. Keyed off the ACTIVE native
       tab, so the Content tab is never touched. The raw toggle is hidden by CSS
       (redundant now) but still works when clicked programmatically below.
       `goingToContent` suppresses the flip during the Content bounce. */
    let goingToContent = false;
    let dbeCssCodeDefaultForced = false;
    function ensureCssCodeDefault() {
        if (goingToContent) { return; }
        const lp = document.querySelector('.uniLeftPanel');
        if (!lp) { return; }
        if (isCssCodeMode(lp)) { return; }                       // already in code mode
        if (!/Styles/i.test(nativeStripActiveTab(lp) || '')) { return; } // only flip from the Styles tab
        const btn = lp.querySelector('.uniIconCssMode');
        if (btn) { dbeCssCodeDefaultForced = true; clickSeq(btn); }
    }

    /* In code mode Builderius drops the whole Content/Styles tab strip, so there
       is no way back to element settings without leaving the editor. Re-inject a
       matching switcher. "Styles" is the current view; "Content" bounces out of
       code mode (which restores the native strip) and clicks the real Content
       tab. `goingToContent` stops ensureCssCodeDefault re-flipping mid-bounce. */
    function gotoContent() {
        const lp = document.querySelector('.uniLeftPanel');
        if (!lp) { return; }
        goingToContent = true;
        const toggle = lp.querySelector('.uniIconCssMode');
        if (toggle) { clickSeq(toggle); } // exit code mode -> native tabs return
        let tries = 0;
        (function waitForContentTab() {
            const lp2 = document.querySelector('.uniLeftPanel');
            const contentTab = lp2 && [].slice.call(lp2.querySelectorAll('.uniPanelTabs__tab:not(.dbe-code-tab)'))
                .filter((t) => { return /Content/i.test(t.textContent || ''); })[0];
            if (contentTab) {
                clickSeq(contentTab);
                goingToContent = false;
            } else if (tries++ < 40) {
                dbeSetOwnedFrame(DBE_STYLES_OWNER, waitForContentTab);
            } else {
                goingToContent = false;
            }
        })();
    }

    function ensureCodeModeTabs() {
        const lp = document.querySelector('.uniLeftPanel');
        if (!lp) { return; }
        const sp = lp.querySelector('.uniSettingsPage');
        const codeMode = isCssCodeMode(lp);
        const existing = lp.querySelector('.dbe-code-tabs');
        if (!codeMode || !sp) { if (existing) { existing.remove(); } return; }
        if (existing) { return; }
        const strip = document.createElement('div');
        strip.className = 'uniPanelTabs uniPanelTabs--2 dbe-code-tabs';
        strip.setAttribute('role', 'tablist');
        const mk = function (label, active, onClick) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'uniPanelTabs__tab dbe-code-tab' + (active ? ' active' : '');
            b.setAttribute('role', 'tab');
            b.setAttribute('aria-selected', active ? 'true' : 'false');
            const s = document.createElement('span');
            s.textContent = label;
            b.appendChild(s);
            if (onClick) { b.addEventListener('click', onClick); }
            return b;
        };
        strip.appendChild(mk(dbeT('contentTab', 'Content'), false, gotoContent));
        strip.appendChild(mk(dbeT('stylesTab', 'Styles'), true, null));
        const header = sp.querySelector('.uniPanelHeader');
        if (header && header.nextSibling) { sp.insertBefore(strip, header.nextSibling); }
        else { sp.insertBefore(strip, sp.firstChild); }
    }

    /* (g) CSS scope: surface the Global/Template switch at the Styles editor and
       indicate the current level. The scope lives in the builder store as the
       boolean `isGlobalScope` — the native Global/Template buttons' ENTIRE
       onClick is storeSet('isGlobalScope', bool) (verified 5 Jul 2026 via the
       buttons' React props), so reading and writing that key is exactly the
       native control, repaints every consumer reactively, and — unlike mounting
       the Selectors tab — does not deselect the element. The old Selectors-tab
       bounce (setScope's slow path) is kept only as a fallback for the day the
       key is renamed. Level = local when the selected selector is
       %local%/%#local%, else the global/template scope. */
    let dbeScope = 'global';        // cached scope; default matches Builderius
    let dbeSwitchingScope = false;
    let dbeScopeFinish = null;

    /* Display name for the non-global scope. It follows the entity being
       edited: "Component" when a component is open, "Template" otherwise —
       mirroring the native TemplateScopeBtn, which labels itself from
       entityMeta.type (verified 8 Jul 2026: editing a component, getEntitySettings
       already returns the COMPONENT's CSS, so the store routes edits correctly;
       only our label lagged). The internal scope key stays 'template' for both,
       so nothing about the switch behaviour or the data-dbe-level CSS changes —
       only the words the user reads. */
    function entityScopeLabel() {
        let t;
        try { const m = store().storeGet('entityMeta'); t = m && m.type; } catch (e) { /* store not ready */ }
        return t === 'component' ? dbeT('scopeComponent', 'Component') : dbeT('scopeTemplate', 'Template');
    }

    /* The store's scope boolean, or null when unavailable (store not ready, or
       the key renamed by a Builderius update). */
    function scopeStoreValue() {
        try {
            const v = store().storeGet('isGlobalScope');
            return typeof v === 'boolean' ? v : null;
        } catch (e) { return null; }
    }

    function readScopeFromControl() {
        const v = scopeStoreValue();
        if (v !== null) { dbeScope = v ? 'global' : 'template'; return; }
        const ctrl = document.querySelector('.uniRightPanel .uniScopeControl');
        if (!ctrl) { return; }
        const active = ctrl.querySelector('button.active');
        if (active) { dbeScope = /template/i.test(active.textContent || '') ? 'template' : 'global'; }
    }

    function currentSelectorName(lp) {
        const sel = lp.querySelector('.uniModuleCssSelectorItemSelected');
        return sel ? (sel.textContent || '').trim() : '';
    }
    function currentCssLevel(lp) {
        const name = currentSelectorName(lp);
        if (!name || name.charAt(0) === '%') { return 'local'; } // %local% / %#local%
        return dbeScope;                                          // a class selector -> global | template
    }

    /* Re-point the styles editor at `target` scope for the active class.

       The native builder has a defect: when a class has saved rules in only ONE
       scope, an effect force-switches the working object
       (activeSelectorSettingsCssObj) back to that scope on every render, so a
       raw isGlobalScope write cannot open the EMPTY scope to add a first rule
       there. Verified 7 Jul 2026 against the store: with a template-only class
       selected, isGlobalScope read Global while activeSelectorSettingsCssObj
       stayed Template, and edits saved to Template. The effect is gated on
       `!isCssMode`, so it bites the visual properties panel; in the CSS code
       editor the same symptom appears because the editor's content is bound to
       the working object, which nothing refreshes on a scope flip in code mode.

       Builderius' own public hook `cssSelector.modifyCssObj` sets that working
       object with an EXPLICIT scope, loading the class's existing rules FROM the
       target scope's stylesheet (or empty when the class isn't there yet), so
       the user's next declaration lands in the target scope. Once a rule exists
       in both scopes the native force-switch stops firing and the toggle is free.

       `force` splits the two calls in setScope: the immediate one sets the
       scope; the deferred one only RE-asserts if the native effect has since
       flipped the working object back, so it never clobbers an edit already in
       flight when no revert happened (e.g. code mode, where the effect is
       dormant). Class selectors only; %local% one-offs are unambiguous. */
    function repointScope(target, force) {
        try {
            const sf = store();
            const sel = sf.storeGet('activeSelector');
            if (!sel || sel.charAt(0) === '%') { return; }
            const want = target === 'global';
            const cur = sf.storeGet('activeSelectorSettingsCssObj') || {};
            if (!force && cur.selector === sel && cur.isGlobalScope === want) { return; }
            const settings = want ? sf.storeGet('getGlobalSettings') : sf.storeGet('getEntitySettings');
            const css = settings && typeof settings.css === 'string' ? settings.css : '';
            const bp = sf.storeGet('activeBreakpoint') || '';
            window.Builderius.API.hooks.doAction('builderius.cssSelector.modifyCssObj', {
                value: css, selector: sel, breakpoint: bp, isGlobalScope: want
            });
        } catch (e) { /* store or hooks unavailable; leave the native toggle as-is */ }
    }

    /* Give a class that has rules only in the OTHER scope ("elsewhere") a real,
       empty rule in the ACTIVE scope, so it becomes cleanly editable HERE.

       Builderius mounts the per-selector code editor onto the scope where the
       class physically has rules, ignoring the active scope — so a Global view of
       a Template-only class shows (and would fork) Template's rules. Seeding an
       empty `sel {}` into the active scope's stylesheet makes the class exist in
       both scopes: Builderius re-mounts the editor onto the active scope's own
       (empty) model, and edits then save to the active scope. Uses the public
       modifyCssAll hook with plain CSS text, so it never touches Builderius'
       internal rule-object shape. No-ops if the active scope already has the rule
       (so it can't clobber real styles) — and modifyCssAll REPLACES the whole
       stylesheet, so we read the current text fresh and only append. */
    function seedActiveScope() {
        try {
            const sf = store();
            const sel = sf.storeGet('activeSelector');
            if (!sel || sel.charAt(0) !== '.') { return; }        // class selectors only
            const isGlobal = sf.storeGet('isGlobalScope') === true;
            const settings = isGlobal ? sf.storeGet('getGlobalSettings') : sf.storeGet('getEntitySettings');
            const css = settings && typeof settings.css === 'string' ? settings.css : '';
            if (selectorInScope(css, sel)) { return; }            // already editable here; nothing to seed
            window.Builderius.API.hooks.doAction('builderius.cssSelector.modifyCssAll', {
                value: css + '\n' + sel + ' {\n}\n',
                scope: isGlobal ? 'global' : 'entity'
            });
        } catch (e) { /* store or hooks unavailable; leave the warning as-is */ }
    }

    /* Switch the CSS scope from the Styles editor.

       FAST PATH: write the store's `isGlobalScope` boolean — byte-for-byte what
       the native Global/Template buttons do on click — and everything bound to
       it repaints in place, selection untouched. Near-instant, no mask.

       SLOW PATH (fallback only, e.g. the key renamed by an update): the native
       scope control is reachable only via the Selectors tab, and ACTIVATING that
       tab deselects the element. So: bounce to Selectors -> click the target
       scope button -> restore the previous right-panel tab -> re-select the
       element by clicking its tree row (a REAL selection; storeSet leaves the
       class list un-hydrated) -> reopen Styles -> re-pick the class the user was
       on. Guarded against re-entry; ends by refreshing the bar. */
    function setScope(target) {
        if (scopeStoreValue() !== null) {
            try {
                store().storeSet('isGlobalScope', target === 'global');
                dbeScope = target;
                repointScope(target, true);                              // open the target scope now
                dbeSetOwnedTimeout(DBE_STYLES_OWNER, () => { repointScope(target, false); }, 60); // re-assert if the native effect reverts it
                schedule();
                return Promise.resolve();
            } catch (e) { /* fall through to the slow path */ }
        }
        if (dbeSwitchingScope) { return Promise.resolve(); }
        const lp = document.querySelector('.uniLeftPanel');
        if (!lp) { return Promise.resolve(); }
        const savedModule = activeId();
        const savedSelector = currentSelectorName(lp);
        const rp = document.querySelector('.uniRightPanel');
        const prevTab = rp && rp.querySelector('.uniPanelTabs__tab.active:not(.dbe-code-tab)');
        const prevTabText = prevTab ? (prevTab.textContent || '').trim() : 'Elements';
        dbeSwitchingScope = true;

        // Returns a promise that ALWAYS resolves — a View Transition wraps this, so
        // an unresolved promise would freeze the page. A safety timer guarantees it.
        return new Promise((resolve) => {
            let finished = false;
            function done() {
                if (finished) { return; }
                finished = true;
                dbeSwitchingScope = false;
                dbeScopeFinish = null;
                if (dbeStylesControllerActive) { schedule(); }
                resolve();
            }
            dbeScopeFinish = done;
            dbeSetOwnedTimeout(DBE_STYLES_OWNER, done, 6000);

            const selTab = rp && [].slice.call(rp.querySelectorAll('.uniPanelTabs__tab'))
                .filter((t) => { return /Selector/i.test(t.textContent || ''); })[0];
            if (selTab && !selTab.classList.contains('active')) { clickSeq(selTab); }

            waitFor(() => { return document.querySelector('.uniRightPanel .uniScopeControl'); }, (ctrl) => {
                if (ctrl) {
                    const btn = [].slice.call(ctrl.querySelectorAll('button'))
                        .filter((b) => { return new RegExp(target, 'i').test(b.textContent || ''); })[0];
                    if (btn && !btn.classList.contains('active')) { clickSeq(btn); }
                    dbeScope = target;
                }
                // restore the right-panel tab the user was on
                const restore = [].slice.call(document.querySelectorAll('.uniRightPanel .uniPanelTabs__tab'))
                    .filter((t) => { return new RegExp('^' + prevTabText, 'i').test((t.textContent || '').trim()); })[0];
                if (restore && !restore.classList.contains('active')) { clickSeq(restore); }
                // Re-select the element the Selectors tab cleared by clicking its tree
                // row. This must be a REAL selection: storeSet('activeModule') renders
                // the panel shell but leaves the CSS class list un-hydrated (same class
                // of limitation as raw store writes elsewhere). Needs the Elements tab
                // (restored above) and the row visible (not in a collapsed branch).
                waitFor(() => {
                    return !savedModule || document.querySelector('.uniRightPanel .uni-tree-node-' + savedModule);
                }, (row) => {
                    if (row && row.nodeType === 1) { clickSeq(row); }
                    waitFor(() => { return document.querySelector('.uniLeftPanel .uniPanelTabs__tab:not(.dbe-code-tab)'); }, () => {
                        const lp2 = document.querySelector('.uniLeftPanel');
                        const styles = lp2 && [].slice.call(lp2.querySelectorAll('.uniPanelTabs__tab:not(.dbe-code-tab)'))
                            .filter((t) => { return /Styles/i.test(t.textContent || ''); })[0];
                        if (styles && !styles.classList.contains('active')) { clickSeq(styles); }
                        waitFor(() => { return document.querySelector('.uniLeftPanel .uniSettingsPageModuleDataForEditorWrapper'); }, () => {
                            if (savedSelector && savedSelector.charAt(0) !== '%') {
                                // The class list hydrates a beat after the editor wrapper — wait
                                // for the specific item, then re-pick the user's selector.
                                waitFor(() => {
                                    const lp4 = document.querySelector('.uniLeftPanel');
                                    return lp4 && [].slice.call(lp4.querySelectorAll('.uniModuleCssClassesSelect__list li'))
                                        .filter((x) => { return (x.textContent || '').trim().indexOf(savedSelector) === 0; })[0];
                                }, (li) => {
                                    if (li && li.querySelector('span')) { clickSeq(li.querySelector('span')); }
                                    done();
                                }, 24, DBE_STYLES_OWNER);
                            } else {
                                done();
                            }
                        }, 60, DBE_STYLES_OWNER);
                    }, 60, DBE_STYLES_OWNER);
                }, 60, DBE_STYLES_OWNER);
            }, 60, DBE_STYLES_OWNER);
        });
    }

    /* Cover the settings + navigator panels with an opaque, panel-coloured mask
       for the duration of the switch, then fade it out to reveal the settled
       result. The mask starts fully opaque (no fade-in) so no churn peeks through;
       only the reveal is animated. Runs promiseFactory() and clears on resolve. */
    function withScopeMask(promiseFactory) {
        const panels = ['.uniLeftPanel', '.uniRightPanel']
            .map((s) => { return document.querySelector(s); })
            .filter(Boolean);
        const masks = panels.map((el) => {
            const r = el.getBoundingClientRect();
            const m = document.createElement('div');
            m.className = 'dbe-scope-mask';
            m.style.left = r.left + 'px';
            m.style.top = r.top + 'px';
            m.style.width = r.width + 'px';
            m.style.height = r.height + 'px';
            document.body.appendChild(m);
            return m;
        });
        // Label only the widest mask (the settings panel) so the brief wait reads
        // as an intentional "working" state rather than a frozen panel.
        if (masks.length) {
            const lbl = document.createElement('div');
            lbl.className = 'dbe-scope-mask__label';
            lbl.textContent = dbeT('switchingScope', 'Switching scope…');
            masks[0].appendChild(lbl);
        }
        const cleanup = function () {
            masks.forEach((m) => {
                if (!dbeStylesControllerActive) {
                    if (m.parentNode) { m.parentNode.removeChild(m); }
                    return;
                }
                m.classList.add('is-fading');
                dbeSetOwnedTimeout(DBE_STYLES_OWNER, () => { if (m.parentNode) { m.parentNode.removeChild(m); } }, 340);
            });
        };
        let p;
        try { p = promiseFactory(); } catch (e) { cleanup(); throw e; }
        if (p && typeof p.then === 'function') { p.then(cleanup, cleanup); }
        else { dbeSetOwnedTimeout(DBE_STYLES_OWNER, cleanup, 400); }
        return p;
    }

    /* Handle to the visible left-panel (Styles) Monaco editor. window.monaco is
       NOT global here, but Builderius exposes the namespace at
       window.Builderius.API.monaco — that gives getEditors(), Range and the
       reveal/decoration API the "All CSS" jump needs. Returns {m, ed} or null. */
    function leftPanelMonaco() {
        try {
            const m = window.Builderius.API.monaco;
            if (!m || !m.editor || !m.editor.getEditors) { return null; }
            const eds = m.editor.getEditors();
            for (let i = 0; i < eds.length; i++) {
                const n = eds[i].getDomNode && eds[i].getDomNode();
                if (n && n.offsetParent !== null && n.closest('.uniLeftPanel')) { return { m, ed: eds[i] }; }
            }
        } catch (e) { /* API shape changed — jump degrades to a no-op */ }
        return null;
    }

    /* The native "Selector CSS" | "All CSS" sub-tab (label-matched) in the Styles
       code editor. These are the only .uniPanelTabs__tab in the left panel
       carrying that text, so a text match is unambiguous. */
    function cssViewTab(label) {
        const lp = document.querySelector('.uniLeftPanel');
        if (!lp) { return null; }
        const tabs = [].slice.call(lp.querySelectorAll('.uniPanelTabs__tab'));
        for (let i = 0; i < tabs.length; i++) {
            if ((tabs[i].textContent || '').trim() === label) { return tabs[i]; }
        }
        return null;
    }

    /* Reveal the current selector's rule in the (already-open) All CSS view and
       flash it, so the eye lands on where its CSS lives in the full stylesheet.
       In All CSS the token is RESOLVED (e.g. `.page-content {`), not `%selector%`. */
    let dbeAllCssDecos = [];
    let dbeFlashGen = 0; // two rapid All-CSS clicks = two live polls; only the newest may touch the shared decorations
    function flashSelectorLine(name) {
        const gen = ++dbeFlashGen;
        const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // The class as a standalone selector in a rule head — not a value, and
        // not a longer BEM sibling (.card must not match .card__title).
        const re = new RegExp('(^|[\\s,>+~(])' + esc + '(?![\\w-])');
        // Reaching All CSS triggers several builder re-renders that swap the
        // Monaco instance; a decoration applied mid-churn is dropped with the old
        // editor. So WAIT for the editor to settle — the All-CSS model present and
        // its length unchanged for two ticks — then flash the live one once.
        let lastLen = -1, stable = 0, tries = 0;
        (function poll() {
            if (gen !== dbeFlashGen) { return; } // a newer flash took over
            const h = leftPanelMonaco();
            const text = h ? h.ed.getModel().getValue() : '';
            const ready = !!h && text.indexOf(name) > -1;
            stable = (ready && text.length === lastLen) ? stable + 1 : 0;
            lastLen = ready ? text.length : -1;
            if (ready && stable >= 2) {
                const lines = text.split('\n');
                let lineNo = -1;
                for (let i = 0; i < lines.length; i++) { if (re.test(lines[i])) { lineNo = i + 1; break; } }
                if (lineNo > 0) {
                    try {
                        dbeAllCssDecos = h.ed.deltaDecorations(dbeAllCssDecos, [{
                            range: new h.m.Range(lineNo, 1, lineNo, 1),
                            options: { isWholeLine: true, className: 'dbe-allcss-flash', linesDecorationsClassName: 'dbe-allcss-flash-gutter' }
                        }]);
                        h.ed.revealLineInCenter(lineNo);
                        // A flash to locate, not a permanent mark — clear it after a beat.
                        dbeSetOwnedTimeout(DBE_STYLES_OWNER, () => {
                            if (gen !== dbeFlashGen) { return; } // the decorations belong to a newer flash now
                            const g = leftPanelMonaco();
                            try { if (g) { g.ed.deltaDecorations(dbeAllCssDecos, []); } } catch (e) { /* editor gone */ }
                            dbeAllCssDecos = [];
                        }, 2600);
                    } catch (e) { dbeAllCssDecos = []; }
                }
                return;
            }
            if (tries++ < 45) { dbeSetOwnedTimeout(DBE_STYLES_OWNER, poll, 150); } // wait up to ~7s for the churn to settle
        })();
    }

    /* A top-level Navigator tab (Elements / Selectors / CSS vars) by label.
       "Selectors" is unique across every .uniPanelTabs__tab, so no scoping. */
    function navPanelTab(label) {
        const tabs = [].slice.call(document.querySelectorAll('.uniPanelTabs__tab'));
        for (let i = 0; i < tabs.length; i++) {
            if ((tabs[i].textContent || '').trim() === label) { return tabs[i]; }
        }
        return null;
    }

    /* Scope-bar "All CSS" button. The native "All CSS" view lives in the
       Navigator's Selectors tab, NOT the element's Styles editor where this
       button sits — the two are separate panels. So this drives the same route
       a user would: open Selectors → pick the selector (which mounts the
       Selector CSS | All CSS sub-tabs) → switch to All CSS → flash the rule.
       Scope (Global/Template) rides the shared store value, so All CSS already
       shows whichever the switch beside this button has active. Each step waits
       for the builder to re-render before the next (it rebuilds the panel). */
    function openAllCss() {
        if (!dbeStylesControllerActive) { return; }
        const lp = document.querySelector('.uniLeftPanel');
        const name = lp ? currentSelectorName(lp) : '';   // capture before we navigate away
        const flashName = (name && name.charAt(0) === '.') ? name : '';  // only class selectors flash safely
        const nav = navPanelTab('Selectors');
        if (!nav) { return; }
        clickSeq(nav);   // the Selectors list is React-driven — plain .click() is ignored, so fire the full pointer sequence
        // Switching to Selectors from an active element re-renders the list a few
        // times; a single item click during that churn hits a node that is about
        // to be replaced and is lost. Re-click the current selector (or any item,
        // to bootstrap) until the Selector CSS | All CSS sub-tabs actually mount.
        clickSelectorUntilLoaded(name, 30, (allTab) => {
            if (!allTab) { return; }
            if (!allTab.classList.contains('active')) { clickSeq(allTab); }  // picking an item may already land on All CSS
            if (flashName) { flashSelectorLine(flashName); }                 // flashSelectorLine polls for the live editor itself
        });
    }

    /* Re-click a Selectors-list item until the CSS editor mounts (its All CSS
       sub-tab appears), tolerating the list's post-navigation re-renders. Calls
       done(allTab) on success, done(null) if it never mounts. */
    function clickSelectorUntilLoaded(name, attemptsLeft, done) {
        if (!dbeStylesControllerActive) { done(null); return; }
        const allTab = cssViewTab('All CSS');
        // The editor may already be mounted for a previously selected item.
        // Only finish once the requested selector is the store's active one;
        // otherwise a compound-rule edit could open the wrong CSS model.
        if (allTab && (!name || normSel(dbeStyleCurrentSelector()) === normSel(name))) { done(allTab); return; }
        if (attemptsLeft <= 0) { done(null); return; }
        const items = document.querySelectorAll('.uniSelectorsCss__item');
        if (items.length) {
            let target = null;
            for (let i = 0; i < items.length && name; i++) {
                if (normSel(items[i].textContent || '') === normSel(name)) { target = items[i]; break; }
            }
            clickSeq(target || items[0]);
        }
        dbeSetOwnedTimeout(DBE_STYLES_OWNER, () => { clickSelectorUntilLoaded(name, attemptsLeft - 1, done); }, 120);
    }

    function ensureScopeBar() {
        const lp = document.querySelector('.uniLeftPanel');
        if (!lp) { return; }
        if (!isCssCodeMode(lp)) {
            lp.removeAttribute('data-dbe-level');
            const ex = lp.querySelector('.dbe-scope-bar');
            if (ex) { ex.remove(); }
            return;
        }
        const level = currentCssLevel(lp);
        lp.setAttribute('data-dbe-level', level);
        const picker = lp.querySelector('.uniSettingsPageModuleDataForEditorWrapper');
        if (!picker) { return; }
        let bar = lp.querySelector('.dbe-scope-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.className = 'dbe-scope-bar';
            const badge = document.createElement('span');
            badge.className = 'dbe-scope-badge';
            // Builderius initially shows a class's existing rules no matter
            // which scope is active. The isolation guard below protects rules
            // stored elsewhere; explain that outcome rather than the confusing
            // native model behind it.
            badge.setAttribute('data-dbe-tip',
                dbeT('scopeBadgeTip', 'Choose where edits are saved. If these rules live in the other scope, the editor is protected until you switch scope or add rules here.'));
            badge.tabIndex = 0;
            bar.appendChild(badge);
            const sw = document.createElement('div');
            sw.className = 'dbe-scope-switch';
            sw.setAttribute('role', 'group');
            sw.setAttribute('aria-label', dbeT('cssScope', 'CSS scope'));
            ['global', 'template'].forEach((sc) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.setAttribute('data-scope', sc);
                b.textContent = sc === 'global' ? dbeT('scopeGlobal', 'Global') : entityScopeLabel();
                b.addEventListener('click', () => {
                    // Fast path (store write) is instant — no cover needed. Only
                    // the slow Selectors-tab bounce gets masked: it is a multi-
                    // step, builder-re-rendered re-selection (~2.5s) that would
                    // flicker. (document.startViewTransition CAN'T smooth that
                    // one: its update callback must settle quickly, but the steps
                    // depend on the builder re-rendering, which the transition's
                    // render-suppression stalls — it times out and aborts.)
                    if (scopeStoreValue() !== null) { setScope(sc); }
                    else { withScopeMask(() => { return setScope(sc); }); }
                });
                sw.appendChild(b);
            });
            bar.appendChild(sw);
            // "All CSS": jump from this selector's rules to the whole active-scope
            // stylesheet, with the selector's rule flashed. Sits after the scope
            // switch so the cluster reads scope → view.
            const allBtn = document.createElement('button');
            allBtn.type = 'button';
            allBtn.className = 'dbe-scope-allcss';
            // Icon-only (Builderius' own CSS-file glyph, cloned so it tracks any
            // icon change) to leave the Template/Component label its full width.
            // The label moves to the accessible name + tooltip. Text fallback if
            // the native icon isn't in the DOM.
            const cssIcon = document.querySelector('.uniIconCssMode svg');
            if (cssIcon) { allBtn.appendChild(cssIcon.cloneNode(true)); allBtn.classList.add('dbe-scope-allcss--icon'); }
            else { allBtn.textContent = dbeT('scopeAllCss', 'All CSS'); }
            allBtn.setAttribute('aria-label', dbeT('scopeAllCss', 'All CSS'));
            allBtn.setAttribute('data-dbe-tip', dbeT('scopeAllCssTip', 'Show the full CSS for the active scope and jump to this selector'));
            allBtn.addEventListener('click', openAllCss);
            bar.appendChild(allBtn);
            if (picker.nextSibling) { picker.parentNode.insertBefore(bar, picker.nextSibling); }
            else { picker.parentNode.appendChild(bar); }
        }
        const entLabel = entityScopeLabel();
        // Only write when the text actually changes: this runs every schedule()
        // tick, and rewriting textContent replaces the text node even when the
        // value is identical — a childList mutation the left-panel observer would
        // catch, re-scheduling us into a self-sustaining loop (the label visibly
        // flickered in the DOM).
        const badgeText = level === 'local' ? dbeT('scopeLocal', 'Local') : (level === 'template' ? entLabel : dbeT('scopeGlobal', 'Global'));
        // Re-queried (not the creation-branch variable): the bar may pre-date this call.
        const currentBadge = bar.querySelector('.dbe-scope-badge');
        if (currentBadge.textContent !== badgeText) { currentBadge.textContent = badgeText; }
        [].slice.call(bar.querySelectorAll('.dbe-scope-switch button')).forEach((b) => {
            const sc = b.getAttribute('data-scope');
            if (sc === 'template' && b.textContent !== entLabel) { b.textContent = entLabel; } // keep in sync after an entity switch
            b.classList.toggle('is-active', sc === dbeScope);
        });
        // "All CSS" needs a class selector to locate — a %local% one-off has no
        // shared rule to jump to, so disable it at the local level.
        const currentAllBtn = bar.querySelector('.dbe-scope-allcss');
        if (currentAllBtn) { currentAllBtn.disabled = (level === 'local'); }
    }

    /* (h) Scope isolation.

       The native per-selector CSS editor shows a class's rules from whichever
       scope PHYSICALLY stores them, ignoring the active Global/Template scope —
       the scope only routes where a SAVE lands. So the same rules appear under
       both scopes, and an edit made while the "wrong" scope is active silently
       forks the rules into it. We can't rebind the native Monaco editor
       reliably: neither writing `isGlobalScope` nor the public
       `cssSelector.modifyCssObj` hook re-renders it (verified 8 Jul 2026 against
       the live store — the editor content is bound to a model set at selection
       time and nothing refreshes it on a scope flip).

       So we drive the truth from the one authoritative source instead: each
       scope's raw stylesheet in the store (getGlobalSettings.css /
       getEntitySettings.css — the latter is the component's OR the template's
       CSS, whichever entity is open, so this works identically for both). When
       the active scope has NO rules for the selector but the other scope does,
       we cover the editor — hiding the phantom rules and blocking the
       fork-prone edit — and offer a one-click switch. A status line names the
       scope the visible rules belong to at all times.

       Base breakpoint + class selectors only: %local% is unambiguous, and
       per-breakpoint presence isn't reliably parseable from the flat stylesheet
       (a false "empty" would hide real CSS). This supersedes the older
       REST-fed scope guard, which only warned and left the merged view intact. */
    function scopeCss(which) {
        try {
            const s = store().storeGet(which === 'global' ? 'getGlobalSettings' : 'getEntitySettings');
            return s && typeof s.css === 'string' ? s.css : '';
        } catch (e) { return ''; }
    }
    /* Strip comments, collapse whitespace, tighten comma groups — so a stored
       rule head compares equal to the store's `activeSelector` string. */
    function normSel(str) {
        return String(str).replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\s*,\s*/g, ',').replace(/\s+/g, ' ').trim();
    }
    /* True when `selector` is a base-breakpoint (top-level) rule head in `css`.
       Walks balanced braces; conditional at-rule bodies (@media/@supports/…) and
       other at-rules (@font-face, @keyframes) are skipped, so a responsive
       override never counts as a base rule. Grouped heads (`.a, .b`) match on
       any member. */
    function selectorInScope(css, selector) {
        if (!css) { return false; }
        const want = normSel(selector);
        let i = 0;
        const n = css.length;
        while (i < n) {
            if (css[i] === '/' && css[i + 1] === '*') { const e = css.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
            const open = css.indexOf('{', i);
            if (open < 0) { break; }
            const head = css.slice(i, open);
            let depth = 1, j = open + 1;
            while (j < n && depth > 0) {
                const c = css[j];
                if (c === '/' && css[j + 1] === '*') { const e2 = css.indexOf('*/', j + 2); j = e2 < 0 ? n : e2 + 2; continue; }
                if (c === '{') { depth++; } else if (c === '}') { depth--; }
                j++;
            }
            const h = normSel(head);
            if (h.charAt(0) !== '@' && (h === want || h.split(',').indexOf(want) >= 0)) { return true; }
            i = j;
        }
        return false;
    }

    /* selectorInScope is a full brace-balancing walk over a whole stylesheet
       and ensureScopeIsolation runs it twice per schedule() tick on the
       busiest observer. The store returns an unchanged css string between
       edits, so one memo slot per scope skips the parse on almost every tick
       (string === is a cheap reference check when nothing changed). */
    let dbeSelScopeMemo = { global: { css: null, sel: null, hit: false }, entity: { css: null, sel: null, hit: false } };
    function selectorInScopeCached(which, sel) {
        const css = scopeCss(which);
        const m = dbeSelScopeMemo[which];
        if (m.css === css && m.sel === sel) { return m.hit; }
        m.css = css;
        m.sel = sel;
        m.hit = selectorInScope(css, sel);
        return m.hit;
    }

    /* Render the scope status line for the active selector. Idempotent and
       signature-guarded so an unchanged tick writes no DOM (the panel
       MutationObserver re-runs schedule() on our own edits otherwise). */
    function ensureScopeIsolation() {
        const lp = document.querySelector('.uniLeftPanel');
        if (!lp) { return; }
        const mon = lp.querySelector('.monaco-editor');
        const holder = mon && mon.parentElement;
        function teardown() {
            const st = lp.querySelector('.dbe-scope-status'); if (st) { st.remove(); }
            const cov = lp.querySelector('.dbe-scope-cover'); if (cov) { cov.remove(); }
            if (holder) { holder.classList.remove('dbe-scope-hold'); }
            if (mon) { mon.classList.remove('dbe-scope-covered'); mon.removeAttribute('inert'); }
        }
        if (!isCssCodeMode(lp) || !holder) { return teardown(); }
        let sf; try { sf = store(); } catch (e) { return teardown(); }
        let sel, bp, isGlobal;
        try {
            sel = sf.storeGet('activeSelector');
            bp = sf.storeGet('activeBreakpoint') || '';
            isGlobal = sf.storeGet('isGlobalScope') === true;
        } catch (e) { return teardown(); }
        // Base breakpoint only — see the note above. The local (element) scope
        // surfaces when NO class is selected: activeSelector is empty and
        // Builderius targets the element's own autogenerated %local% class. Class
        // selectors are compared across scopes; any other selector kind (id,
        // element, …) gets no status.
        if (bp !== '') { return teardown(); }
        const isLocal = !sel || sel.charAt(0) === '%';         // no class selected, or the %local% / %#local% token
        if (!isLocal && sel.charAt(0) !== '.') { return teardown(); }

        let displaySel = sel;
        // activeHas is only read in the else branch that assigns it; otherHas is
        // read past the branch, so it keeps its default.
        let activeName, otherName = '', otherTarget = '', activeHas, otherHas = false, state;
        if (isLocal) {
            // %local% is the element's own autogenerated class, derived from the
            // element JSON. It belongs to no class and sits outside the
            // Global/Template scopes, so there is nothing to compare across scopes
            // and never anything to cover.
            state = 'local';
            activeName = dbeT('scopeLocal', 'Local');
            displaySel = '%local%';
        } else {
            activeName = isGlobal ? dbeT('scopeGlobal', 'Global') : entityScopeLabel();
            otherName = isGlobal ? entityScopeLabel() : dbeT('scopeGlobal', 'Global');
            otherTarget = isGlobal ? 'template' : 'global';
            activeHas = selectorInScopeCached(isGlobal ? 'global' : 'entity', sel);
            otherHas = selectorInScopeCached(isGlobal ? 'entity' : 'global', sel);
            state = activeHas ? 'own' : (otherHas ? 'elsewhere' : 'new');
        }
        const sig = state + '|' + displaySel + '|' + activeName + '|' + otherName + '|' + (otherHas ? 1 : 0);

        // Status line — always present, anchored under the scope bar.
        let status = lp.querySelector('.dbe-scope-status');
        if (!status) {
            status = document.createElement('div');
            status.className = 'dbe-scope-status';
            status.setAttribute('role', 'status');
            const bar = lp.querySelector('.dbe-scope-bar');
            const anchor = bar || lp.querySelector('.uniSettingsPageModuleDataForEditorWrapper');
            if (!anchor) { return; }
            if (anchor.nextSibling) { anchor.parentNode.insertBefore(status, anchor.nextSibling); }
            else { anchor.parentNode.appendChild(status); }
        }

        if (status.getAttribute('data-dbe-sig') !== sig) {
            status.setAttribute('data-dbe-sig', sig);
            status.setAttribute('data-dbe-state', state);
            const verb = state === 'own' ? dbeFmt(dbeT('scopeEditing', 'Editing %s rules'), activeName)
                : state === 'new' ? dbeFmt(dbeT('scopeNewRule', 'New %s rule'), activeName)
                    : state === 'local' ? dbeT('scopeLocalEditing', 'Editing element styles')
                        : dbeFmt(dbeT('scopeNoRules', 'No %s rules'), activeName); // elsewhere
            status.innerHTML = '';
            const vspan = document.createElement('span');
            vspan.className = 'dbe-scope-status__verb';
            vspan.textContent = verb;
            const code = document.createElement('code');
            code.textContent = displaySel;
            status.appendChild(vspan);
            status.appendChild(code);
            if (state === 'own' && otherHas) {
                const dup = document.createElement('span');
                dup.className = 'dbe-scope-status__dup';
                dup.textContent = ' ' + dbeFmt(dbeT('scopeAlsoIn', '· also in %s'), otherName);
                status.appendChild(dup);
            } else if (state === 'elsewhere') {
                // Name where the rules currently live; the actions live in the
                // editor cover below (built further down).
                const where = document.createElement('span');
                where.className = 'dbe-scope-status__dup';
                where.textContent = ' ' + dbeFmt(dbeT('scopeRulesIn', '· rules in %s'), otherName);
                status.appendChild(where);
            }
        }

        // In "elsewhere" the editor is showing the OTHER scope's rules (Builderius
        // mounts the model where the rules physically live), so typing here would
        // edit — and fork — those rules. Cover the editor with a light, inert
        // scrim until the user picks an action: "Add <scope> rules" seeds an empty
        // editable rule in THIS scope (via seedActiveScope), "Switch to <other>"
        // jumps to where the rules live. Any other state clears the cover.
        if (state === 'elsewhere') {
            holder.classList.add('dbe-scope-hold');
            mon.classList.add('dbe-scope-covered');
            mon.setAttribute('inert', '');                 // block accidental typing / tab-in
            let cover = holder.querySelector('.dbe-scope-cover');
            if (!cover) {
                cover = document.createElement('div');
                cover.className = 'dbe-scope-cover';
                const note = document.createElement('p');
                note.className = 'dbe-scope-cover__note';
                const actions = document.createElement('div');
                actions.className = 'dbe-scope-cover__actions';
                const addBtn = document.createElement('button');
                addBtn.type = 'button';
                addBtn.className = 'dbe-scope-status__btn dbe-scope-status__add';
                addBtn.addEventListener('click', () => { seedActiveScope(); });
                const swBtn = document.createElement('button');
                swBtn.type = 'button';
                swBtn.className = 'dbe-scope-status__btn dbe-scope-status__switch';
                swBtn.addEventListener('click', () => {
                    const t = cover.getAttribute('data-dbe-target');
                    if (t) { try { setScope(t); } catch (e) {} }
                });
                actions.appendChild(addBtn);
                actions.appendChild(swBtn);
                cover.appendChild(note);
                cover.appendChild(actions);
                holder.appendChild(cover);
            }
            if (cover.getAttribute('data-dbe-sig') !== sig) {
                cover.setAttribute('data-dbe-sig', sig);
                cover.setAttribute('data-dbe-target', otherTarget);
                cover.querySelector('.dbe-scope-cover__note').textContent =
                    dbeFmt(dbeT('scopeCoverWhy', 'Editing here would change %s rules'), otherName);
                cover.querySelector('.dbe-scope-status__add').textContent = dbeFmt(dbeT('scopeAddHere', 'Add %s rules'), activeName);
                cover.querySelector('.dbe-scope-status__switch').textContent = dbeFmt(dbeT('switchTo', 'Switch to %s'), otherName);
            }
        } else {
            const existingCover = holder.querySelector('.dbe-scope-cover');
            if (existingCover) { existingCover.remove(); }
            holder.classList.remove('dbe-scope-hold');
            mon.classList.remove('dbe-scope-covered');
            mon.removeAttribute('inert');
        }
    }


    /* Monaco is deliberately NOT retheming via setTheme(): the light theme is
       produced by the pixel-invert filter in 60-theme.css, refined across
       several releases (find-widget, native-edit-context). A real setTheme('vs')
       underneath that filter would invert a light editor back to dark, so no JS
       theming here — the CSS tracks [data-dbe-theme] and the OS scheme itself. */

    /* Turn off Monaco's minimap (the code-overview strip) on every builder editor.
       43-scope-isolation.css hides the minimap PAINT, but Monaco still reserves
       its width in the layout, so long lines clip ~77px short of the right edge.
       The only real fix is the editor option — which needs the Monaco namespace.
       It is not exposed as window.monaco here, so we pull it out of the builder's
       webpack bundle once (chunk-push to grab __webpack_require__, then find the
       module that exports `editor.getEditors`/`onDidCreateEditor`) and disable the
       minimap on all current editors + every future one. Wrapped throughout: if
       the bundle internals ever change we fail soft and the CSS hide still applies
       (overview gone, width merely reserved). */
    let dbeMonacoNs = null;      // resolved Monaco namespace, cached once found
    let dbeWebpackReq = null;    // the builder bundle's __webpack_require__
    let dbeProbeN = 0;           // unique id per chunk-push so the callback always fires
    let dbeMinimapDone = false;  // current editors done + onDidCreateEditor hooked
    let dbeMinimapCreateListener = null;
    let dbeMinimapEditors = [];
    function dbeGetMonaco() {
        if (dbeMonacoNs) { return dbeMonacoNs; }
        try {
            if (!dbeWebpackReq) {
                const chunk = window.webpackChunkbuilderius;
                if (!chunk || typeof chunk.push !== 'function') { return null; }
                let req = null;
                chunk.push([['dbe-monaco-' + (dbeProbeN++)], {}, function (r) { req = r; }]);
                if (typeof req === 'function' && req.m) { dbeWebpackReq = req; } else { return null; }
            }
            const m = dbeWebpackReq.m;
            for (const id in m) {
                let src;
                try { src = m[id].toString(); } catch (e) { continue; }
                if (src.indexOf('onDidCreateEditor') < 0 && src.indexOf('getEditors') < 0) { continue; }
                let ex;
                try { ex = dbeWebpackReq(id); } catch (e) { continue; }
                if (ex && ex.editor && typeof ex.editor.getEditors === 'function'
                    && typeof ex.editor.onDidCreateEditor === 'function') {
                    dbeMonacoNs = ex;
                    return ex;
                }
            }
        } catch (e) { /* bundle internals changed — the CSS hide is the fallback */ }
        return null;
    }
    function dbeDisableEditorMinimap(ed) {
        if (!ed || dbeMinimapEditors.some((item) => { return item.editor === ed; })) { return; }
        let enabled = true;
        try {
            const raw = typeof ed.getRawOptions === 'function' ? ed.getRawOptions() : null;
            if (raw && raw.minimap && typeof raw.minimap.enabled === 'boolean') { enabled = raw.minimap.enabled; }
        } catch (e) { /* retain Monaco's enabled default */ }
        dbeMinimapEditors.push({ editor: ed, enabled });
        try { ed.updateOptions({ minimap: { enabled: false } }); } catch (e) {}
    }
    function dbeDisableMinimap() {
        if (dbeMinimapDone) { return; }
        if (!document.querySelector('.monaco-editor')) { return; } // Monaco not loaded yet
        const monaco = dbeGetMonaco();
        if (!monaco) { return; }
        try {
            monaco.editor.getEditors().forEach(dbeDisableEditorMinimap);
            dbeMinimapCreateListener = monaco.editor.onDidCreateEditor(dbeDisableEditorMinimap);
            dbeMinimapDone = true;
        } catch (e) { /* fail soft */ }
    }
    function dbeRestoreMinimap() {
        if (dbeMinimapCreateListener) {
            try { dbeMinimapCreateListener.dispose(); } catch (e) {}
        }
        dbeMinimapCreateListener = null;
        dbeMinimapEditors.forEach((item) => {
            try { item.editor.updateOptions({ minimap: { enabled: item.enabled } }); } catch (e) {}
        });
        dbeMinimapEditors = [];
        dbeMinimapDone = false;
    }

    /* CSS-panel hint (css_hint_dialog): Builderius prints a two-line
       selector/breakpoint hint (.uniInlineTooltipMessage) under the CSS editor
       that eats vertical space AND whose wording is inconsistent by scope — the
       %local% variant lists the breakpoint VARIABLES (--desktop/--tablet/--mobile),
       while the class/%selector% variant mentions only the breakpoints switcher.
       We hide the native lines (44-css-hint.css) and replace them with one
       compact, dismissable affordance whose dialog carries a SINGLE unified
       explanation covering both tokens and both breakpoint facts. First run shows
       a one-line banner with a close (×); dismissing it (remembered in
       localStorage) collapses it to a small info button that always reopens the
       dialog, so the help is reclaimed-but-recoverable. */
    const DBE_HINT_KEY = 'dbeBuilderCssHintDismissed';
    let dbeCssHintFocusReturn = null;

    function cssHintDismissed() {
        try { return localStorage.getItem(DBE_HINT_KEY) === '1'; } catch (e) { return false; }
    }

    function cssHintCode(value) {
        const code = document.createElement('code');
        code.textContent = value;
        return code;
    }

    function cssHintBody() {
        const dl = document.createElement('dl');
        dl.className = 'dbe-css-hint-dl';
        function row(term, parts) {
            const dt = document.createElement('dt');
            const dd = document.createElement('dd');
            if (term && term.nodeType) { dt.appendChild(term); } else { dt.textContent = term; }
            parts.forEach((part) => {
                dd.appendChild(part && part.nodeType ? part : document.createTextNode(part));
            });
            dl.appendChild(dt);
            dl.appendChild(dd);
        }
        row(cssHintCode('%local%'), [
            dbeT('cssHintLocalLead', 'Targets this element only, through its automatic class. Use '),
            cssHintCode('%#local%'),
            dbeT('cssHintLocalTail', ' to target it by ID instead.')
        ]);
        row(cssHintCode('%selector%'), [
            dbeT('cssHintSelector', 'Targets every element that uses the current class.')
        ]);
        row(dbeT('cssHintBreakpointsTerm', 'Breakpoints'), [
            dbeT('cssHintBreakpointsLead', 'Switch breakpoint in the top bar to write CSS for a specific screen size. Inside a rule you can also use '),
            cssHintCode('--desktop'), ', ', cssHintCode('--tablet'), ' ', dbeT('or', 'or'), ' ', cssHintCode('--mobile'),
            dbeT('cssHintBreakpointsTail', ' as breakpoint-variable values.')
        ]);
        return dl;
    }

    function openCssHintDialog() {
        dbeCssHintFocusReturn = document.activeElement;
        let dlg = document.getElementById('dbe-css-hint-dialog');
        if (!dlg) {
            dlg = document.createElement('dialog');
            dlg.id = 'dbe-css-hint-dialog';
            dlg.className = 'dbe-css-hint-dialog';
            dlg.setAttribute('aria-labelledby', 'dbe-css-hint-dialog-title');
            const head = document.createElement('div');
            head.className = 'dbe-css-hint-dialog__head';
            const title = document.createElement('h2');
            title.id = 'dbe-css-hint-dialog-title';
            title.className = 'dbe-css-hint-dialog__title';
            title.textContent = dbeT('cssHintTitle', 'Selector tokens & breakpoints');
            const close = document.createElement('button');
            close.type = 'button';
            close.className = 'dbe-css-hint-dialog__close';
            close.setAttribute('aria-label', dbeT('cssHintClose', 'Close'));
            close.textContent = '×';
            const body = document.createElement('div');
            body.className = 'dbe-css-hint-dialog__body';
            body.appendChild(cssHintBody());
            head.appendChild(title);
            head.appendChild(close);
            dlg.appendChild(head);
            dlg.appendChild(body);
            close.addEventListener('click', () => { dlg.close(); });
            // Keep builder shortcuts from firing while the dialog has focus;
            // close Escape explicitly before an embedded/native handler can
            // consume it without reaching the browser's dialog cancellation.
            dlg.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') { e.preventDefault(); dlg.close(); }
                e.stopPropagation();
            });
            // Backdrop click offers the equivalent pointer exit.
            dlg.addEventListener('click', (e) => { if (e.target === dlg) { dlg.close(); } });
            dlg.addEventListener('close', () => {
                const target = dbeCssHintFocusReturn && dbeCssHintFocusReturn.isConnected
                    ? dbeCssHintFocusReturn : document.querySelector('.dbe-css-hint-btn, .dbe-scope-badge');
                dbeCssHintFocusReturn = null;
                if (target) { try { target.focus(); } catch (e) {} }
            });
            document.body.appendChild(dlg);
        }
        if (!dlg.open) { dlg.showModal(); }
    }

    function ensureCssHint() {
        // Anchor to the native hint block so our affordance lands exactly where
        // the help used to be. The native lines are hidden by CSS (still in the
        // DOM), so their presence is a reliable "we're in the styles view" signal.
        const firstMsg = document.querySelector('.uniLeftPanel .uniInlineTooltipMessage');
        if (!firstMsg) {
            const stale = document.querySelector('.dbe-css-hint');
            if (stale) { stale.remove(); }
            return;
        }
        const host = firstMsg.parentElement;
        const dismissed = cssHintDismissed();
        const existing = host.querySelector(':scope > .dbe-css-hint');
        if (existing) {
            existing.classList.toggle('is-collapsed', dismissed);
            return;
        }
        const el = document.createElement('div');
        el.className = 'dbe-css-hint' + (dismissed ? ' is-collapsed' : '');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dbe-css-hint-btn';
        const icon = document.createElement('span');
        icon.className = 'dbe-css-hint-i';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = 'i';
        const label = document.createElement('span');
        label.className = 'dbe-css-hint-label';
        label.textContent = dbeT('cssHintBanner', 'How %local%, %selector% & breakpoints work');
        const dismiss = document.createElement('button');
        dismiss.type = 'button';
        dismiss.className = 'dbe-css-hint-dismiss';
        dismiss.setAttribute('aria-label', dbeT('cssHintDismiss', 'Dismiss hint'));
        dismiss.textContent = '×';
        btn.appendChild(icon);
        btn.appendChild(label);
        el.appendChild(btn);
        el.appendChild(dismiss);
        btn.setAttribute('aria-label', dbeT('cssHintOpen', 'Selector and breakpoint help'));
        btn.addEventListener('click', openCssHintDialog);
        dismiss.addEventListener('click', () => {
            try { localStorage.setItem(DBE_HINT_KEY, '1'); } catch (e) {}
            el.classList.add('is-collapsed');
        });
        host.insertBefore(el, firstMsg);
    }




    const DBE_STYLES_OWNER = 'styles';
    let dbeStylesControllerActive = false;

    function dbeObserveStyles() {
        const main = dbeQuery('mainPanel');
        dbeObserveChrome('styles-main', main, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['class', 'style']
        });
    }

    function dbeRefreshStyles() {
        if (!dbeStylesControllerActive) { return; }
        dbeObserveStyles();
        if (on('css_code_default')) {
            try { ensureCssCodeDefault(); } catch (e) {}
            try { ensureCodeModeTabs(); } catch (e) {}
        }
        if (on('css_hint_dialog')) { try { ensureCssHint(); } catch (e) {} }
        if (on('hide_minimap')) { try { dbeDisableMinimap(); } catch (e) {} }
        if (on('scope_bar')) {
            try { readScopeFromControl(); } catch (e) {}
            try { ensureScopeBar(); } catch (e) {}
            try { ensureScopeIsolation(); } catch (e) {}
        }
    }

    function dbeClearAllCssDecorations() {
        dbeFlashGen++;
        const handle = leftPanelMonaco();
        try { if (handle && dbeAllCssDecos.length) { handle.ed.deltaDecorations(dbeAllCssDecos, []); } } catch (e) {}
        dbeAllCssDecos = [];
    }

    function destroyStyles() {
        dbeStylesControllerActive = false;
        dbeObserveChrome('styles-main', null);
        if (dbeScopeFinish) { dbeScopeFinish(); }
        dbeDestroyOwnedActivity(DBE_STYLES_OWNER);
        dbeClearAllCssDecorations();

        const hintDialog = document.getElementById('dbe-css-hint-dialog');
        if (hintDialog && hintDialog.open) { try { hintDialog.close(); } catch (e) {} }
        if (hintDialog && hintDialog.isConnected) { hintDialog.remove(); }
        dbeCssHintFocusReturn = null;

        document.querySelectorAll(
            '.dbe-code-tabs, .dbe-scope-bar, .dbe-scope-status, .dbe-scope-cover, ' +
            '.dbe-scope-mask, .dbe-css-hint'
        ).forEach((node) => { node.remove(); });

        document.querySelectorAll('.uniLeftPanel').forEach((left) => {
            left.removeAttribute('data-dbe-level');
            left.querySelectorAll('.dbe-scope-hold').forEach((node) => { node.classList.remove('dbe-scope-hold'); });
            left.querySelectorAll('.dbe-scope-covered').forEach((node) => {
                node.classList.remove('dbe-scope-covered');
                node.removeAttribute('inert');
            });
        });

        const currentLeft = document.querySelector('.uniLeftPanel');
        if (dbeCssCodeDefaultForced && currentLeft && isCssCodeMode(currentLeft)) {
            const cssToggle = currentLeft.querySelector('.uniIconCssMode');
            if (cssToggle) { clickSeq(cssToggle); }
        }
        dbeCssCodeDefaultForced = false;
        goingToContent = false;
        dbeSwitchingScope = false;
        dbeScopeFinish = null;
        dbeSelScopeMemo = { global: { css: null, sel: null, hit: false }, entity: { css: null, sel: null, hit: false } };
        dbeRestoreMinimap();
    }

    dbeControllers.register(DBE_STYLES_OWNER, {
        init (context) {
            if (!context || !context.builderius) { return; }
            dbeStylesControllerActive = true;
            dbeRefreshStyles();
        },
        refresh (reason) {
            if (reason) { dbeRefreshStyles(); }
        },
        destroy () {
            destroyStyles();
        }
    }, NEED_STYLES);

    };

    window.dbeBuilderChunks = chunks;
}());

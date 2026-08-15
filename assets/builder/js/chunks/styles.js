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
        const modules = host.builderius.modules;
        const activeId = host.builderius.activeId;
        const clickSeq = host.click;
        const waitFor = host.waitFor;
        const schedule = host.schedule;
        const dbeControllers = host.controllers;
        const dbeObserveChrome = host.observe;
        const dbeSetOwnedTimeout = host.setOwnedTimeout;
        const dbeSetOwnedFrame = host.setOwnedFrame;
        const dbeDestroyOwnedActivity = host.destroyOwnedActivity;
        const moduleClasses = host.editing.moduleClasses;
        const bemModuleTag = host.editing.moduleTag;
        const makeCtxItem = host.commands.makeContextItem;
        const driveSelectedClose = host.commands.closeSelectedClass;
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

    /* (si) Style inspector (style_inspector).

       The context menu and command palette both route into Builderius' native
       Styles view. DBE selects the module, selector and scope, then gets out of
       the way: there is one editing surface and one save path. The companion
       inspector is deliberately read-only. It combines getComputedStyle() with
       accessible CSSOM rules from the live preview, which makes it useful for
       framework and page CSS as well as Builderius-authored rules. */
    let dbeStyleInspectorState = {
        id: null,
        instance: 0,
        tab: 'rules',
        filter: '',
        allComputed: false,
        focusReturn: null
    };

    const DBE_STYLE_COMMON_PROPERTIES = [
        'display', 'position', 'inset', 'inset-block', 'inset-inline', 'z-index',
        'box-sizing', 'inline-size', 'block-size', 'min-inline-size', 'max-inline-size',
        'min-block-size', 'max-block-size', 'margin', 'padding', 'overflow',
        'grid', 'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row',
        'flex', 'flex-direction', 'flex-wrap', 'align-items', 'align-content',
        'justify-content', 'justify-items', 'gap', 'order',
        'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
        'letter-spacing', 'text-align', 'text-decoration', 'text-transform',
        'color', 'background', 'border', 'border-radius', 'box-shadow', 'opacity',
        'transform', 'transition', 'visibility', 'cursor', 'pointer-events'
    ];

    /* Properties whose computed values normally inherit from an ancestor.
       Custom properties are handled separately in dbeStyleCanInherit(). The
       list deliberately includes inherited SVG presentation properties and
       common shorthands such as font/list-style so authored rules remain
       recognisable instead of being exploded into browser longhands. */
    const DBE_STYLE_INHERITED_PROPERTIES = {};
    (
        'accent-color border-collapse border-spacing caption-side color cursor direction empty-cells ' +
        'fill fill-opacity fill-rule font font-family font-feature-settings font-kerning font-language-override ' +
        'font-optical-sizing font-palette font-size font-size-adjust font-stretch font-style font-synthesis ' +
        'font-variant font-variation-settings font-weight hyphens image-rendering letter-spacing line-break ' +
        'line-height list-style list-style-image list-style-position list-style-type marker marker-end marker-mid ' +
        'marker-start orphans overflow-wrap paint-order pointer-events quotes ruby-align ruby-position shape-rendering ' +
        'speak stroke stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit ' +
        'stroke-opacity stroke-width tab-size text-align text-align-last text-combine-upright text-indent text-justify ' +
        'text-orientation text-rendering text-shadow text-transform text-underline-position visibility white-space ' +
        'widows word-break word-spacing word-wrap writing-mode'
    ).split(' ').forEach((name) => { DBE_STYLE_INHERITED_PROPERTIES[name] = true; });

    const DBE_STYLE_PSEUDO_PROPERTIES = [
        'content', 'display', 'position', 'inset', 'z-index', 'box-sizing',
        'inline-size', 'block-size', 'margin', 'padding', 'overflow',
        'font-family', 'font-size', 'font-weight', 'line-height', 'color',
        'background', 'border', 'border-radius', 'box-shadow', 'opacity',
        'transform', 'transition', 'visibility', 'pointer-events'
    ];

    const DBE_STYLE_STATE_PSEUDOS = [
        'active', 'checked', 'disabled', 'enabled', 'focus', 'focus-visible',
        'focus-within', 'hover', 'invalid', 'open', 'placeholder-shown',
        'target', 'user-invalid', 'valid', 'visited'
    ];

    const DBE_STYLE_STATE_RE = new RegExp(':(?:' + DBE_STYLE_STATE_PSEUDOS.join('|') + ')(?![A-Za-z0-9_-])', 'gi');
    const DBE_STYLE_ELEMENT_RE = /::[A-Za-z-]+(?:\([^)]*\))?|:(?:before|after|first-letter|first-line)(?![A-Za-z0-9_-])/gi;

    function dbeStyleTargets(id) {
        try {
            const iframe = dbeQuery('previewFrame');
            const idoc = iframe && iframe.contentDocument;
            return idoc ? [].slice.call(idoc.querySelectorAll('.uni-node-' + id)) : [];
        } catch (e) { return []; }
    }

    function dbeStyleTargetName(id) {
        const mods = modules() || {};
        const mod = mods[id];
        if (!mod) { return id || ''; }
        const tag = bemModuleTag(mod, '') || mod.name || 'element';
        const classes = moduleClasses(mod);
        return '<' + tag + '>' + (classes.length ? ' .' + classes.join(' .') : '');
    }

    function dbeStyleCurrentSelector() {
        try { return store().storeGet('activeSelector') || ''; } catch (e) { return ''; }
    }

    function dbeStyleFocusEditor() {
        if (!dbeStylesControllerActive) { return; }
        dbeSetOwnedTimeout(DBE_STYLES_OWNER, () => {
            const h = leftPanelMonaco();
            if (h && h.ed && h.ed.focus) { h.ed.focus(); return; }
            const lp = document.querySelector('.uniLeftPanel');
            const focusable = lp && lp.querySelector('input:not([disabled]), button:not([disabled]), textarea:not([disabled])');
            if (focusable) { try { focusable.focus(); } catch (e) {} }
        }, 120);
    }

    /* Select an already-applied class through its native chip. The picker hides
       the applied-class list while another selector is active, so close that
       selector first and wait for the list to return. `%local%` is Builderius'
       no-active-class state, reached through the same native Close action. */
    function dbeStyleSelectSelector(selector, done) {
        if (!dbeStylesControllerActive) { done(false); return; }
        const want = selector === '%local%' ? '' : selector;
        const current = dbeStyleCurrentSelector();
        if ((want === '' && (!current || current.charAt(0) === '%')) || current === want) {
            done(true); return;
        }
        if (current && current.charAt(0) !== '%') {
            driveSelectedClose((ok) => {
                if (!dbeStylesControllerActive || !ok) { done(false); return; }
                dbeSetOwnedTimeout(DBE_STYLES_OWNER, () => { dbeStyleSelectSelector(selector, done); }, 80);
            });
            return;
        }
        waitFor(() => {
            return [].slice.call(document.querySelectorAll('.uniModuleCssClassesSelect__list li')).filter((li) => {
                const text = ((li.querySelector('span') || li).textContent || '').trim();
                return text === want || text === want.replace(/^\./, '');
            })[0] || null;
        }, (li) => {
            if (!li) { done(false); return; }
            clickSeq(li.querySelector('span') || li);
            waitFor(() => { return dbeStyleCurrentSelector() === want || null; }, (selected) => {
                done(!!selected);
            }, 40, DBE_STYLES_OWNER);
        }, 50, DBE_STYLES_OWNER);
    }

    function dbeOpenStyleEditor(id, selector, scopeName) {
        if (!dbeStylesControllerActive) { return; }
        const row = id && document.querySelector('.uniRightPanel .uni-tree-node-' + id);
        // Clicking the already-active Navigator row toggles its selection off,
        // leaving the settings panel empty. Only drive the row when the command
        // targets a different module (e.g. a context menu on an unselected row).
        if (row && activeId() !== id) { clickSeq(row); }
        waitFor(() => { return activeId() === id || null; }, (selected) => {
            if (!selected) { return; }
            const lp = document.querySelector('.uniLeftPanel');
            const styles = lp && [].slice.call(lp.querySelectorAll('.uniPanelTabs__tab'))
                .filter((tab) => { return /Styles/i.test(tab.textContent || ''); })[0];
            if (styles && !styles.classList.contains('active')) { clickSeq(styles); }
            waitFor(() => {
                const left = document.querySelector('.uniLeftPanel');
                return left && (isCssCodeMode(left) || left.querySelector('.uniSystemSelectClasses'));
            }, (ready) => {
                if (!ready) { return; }
                dbeStyleSelectSelector(selector, (selectorReady) => {
                    if (!selectorReady) { return; }
                    if (scopeName && selector !== '%local%') {
                        setScope(scopeName).then(dbeStyleFocusEditor);
                    } else {
                        dbeStyleFocusEditor();
                    }
                });
            }, 80, DBE_STYLES_OWNER);
        }, 50, DBE_STYLES_OWNER);
    }

    /* Compound/custom selectors are authored through Builderius' Navigator
       Selectors view, not the applied-class chips in an element's Styles view.
       Select the exact native selector after switching scope, then leave the
       user in Builderius' own Selector CSS editor. */
    function dbeOpenStylesheetSelector(selector, scopeName) {
        if (!dbeStylesControllerActive) { return; }
        function openSelector() {
            const nav = navPanelTab('Selectors');
            if (!nav) { return; }
            if (!nav.classList.contains('active')) { clickSeq(nav); }
            clickSelectorUntilLoaded(selector, 30, () => {
                const selectorTab = cssViewTab('Selector CSS');
                if (selectorTab && !selectorTab.classList.contains('active')) { clickSeq(selectorTab); }
                dbeStyleFocusEditor();
            });
        }
        if (scopeName) { setScope(scopeName).then(openSelector); }
        else { openSelector(); }
    }

    let dbeStyleScopeSelectorMemo = {
        global: { css: null, selectors: {} },
        entity: { css: null, selectors: {} }
    };

    /* Build the selector set through the browser's CSS parser so formatting
       differences and selectors nested in @layer/@media do not hide authored
       Builderius rules from the edit route. Cache by stylesheet string because
       the inspector is refreshed from the builder's busy mutation loop. */
    function dbeStyleScopeSelectors(which) {
        const css = scopeCss(which);
        const memo = dbeStyleScopeSelectorMemo[which];
        if (memo.css === css) { return memo.selectors; }
        const selectors = {};
        function walk(rules) {
            for (let i = 0; i < rules.length; i++) {
                const rule = rules[i];
                if (rule.selectorText) { selectors[normSel(rule.selectorText)] = true; }
                if (rule.cssRules) { try { walk(rule.cssRules); } catch (e) {} }
            }
        }
        try {
            const sheet = new CSSStyleSheet();
            sheet.replaceSync(css);
            walk(sheet.cssRules);
        } catch (e) { /* malformed/unsupported rule: attribution stays conservative */ }
        memo.css = css;
        memo.selectors = selectors;
        return selectors;
    }

    function dbeStyleSelectorInScope(which, selector) {
        return !!dbeStyleScopeSelectors(which)[normSel(selector)];
    }

    function dbeStyleRuleSource(rule, id) {
        const selector = rule.selectorText || '';
        if (selector.indexOf('.uni-node-' + id) !== -1) { return 'local'; }
        const ruleText = String(rule.cssText || '').replace(/\s+/g, ' ').trim();
        const entityCss = scopeCss('entity');
        const globalCss = scopeCss('global');
        const entity = entityCss.replace(/\s+/g, ' ');
        const global = globalCss.replace(/\s+/g, ' ');
        if (ruleText && entity.indexOf(ruleText) !== -1) { return 'entity'; }
        if (ruleText && global.indexOf(ruleText) !== -1) { return 'global'; }
        // Formatting differs between authored CSS and CSSOM serialisation in
        // some browsers (notably spaces inserted inside :is()/:where() lists).
        // Compare parsed rule heads rather than raw substrings; only attribute
        // a selector when it exists in one Builderius scope.
        const inEntity = selector && dbeStyleSelectorInScope('entity', selector);
        const inGlobal = selector && dbeStyleSelectorInScope('global', selector);
        if (inEntity && !inGlobal) { return 'entity'; }
        if (inGlobal && !inEntity) { return 'global'; }
        return 'page';
    }

    function dbeStyleMatchedClass(selector, id) {
        const mod = (modules() || {})[id];
        const classes = moduleClasses(mod);
        for (let i = 0; i < classes.length; i++) {
            const cls = '.' + classes[i];
            const esc = cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (new RegExp(esc + '(?![A-Za-z0-9_-])').test(selector)) { return cls; }
        }
        return '';
    }

    function dbeStyleCanInherit(name, includeCustomProperties) {
        return (includeCustomProperties && name.indexOf('--') === 0) || !!DBE_STYLE_INHERITED_PROPERTIES[name];
    }

    function dbeStyleElementModuleId(el) {
        if (!el || !el.classList) { return ''; }
        const mods = modules() || {};
        for (let i = 0; i < el.classList.length; i++) {
            const match = /^uni-node-(.+)$/.exec(el.classList[i]);
            if (match && mods[match[1]]) { return match[1]; }
        }
        return '';
    }

    function dbeStyleSelectorModuleId(selector) {
        const mods = modules() || {};
        const re = /\.uni-node-([A-Za-z0-9_-]+)/g;
        let match;
        while ((match = re.exec(selector))) {
            if (mods[match[1]]) { return match[1]; }
        }
        return '';
    }

    function dbeStyleClosestMatch(el, selector) {
        try { return el.closest(selector); } catch (e) { return null; }
    }

    function dbeStyleElementName(el) {
        if (!el || !el.tagName) { return ''; }
        let name = '<' + el.tagName.toLowerCase();
        if (el.id) { name += '#' + el.id; }
        const classes = [].slice.call(el.classList || []).filter((className) => {
            return className.indexOf('uni-node-') !== 0;
        }).slice(0, 3);
        if (classes.length) { name += '.' + classes.join('.'); }
        return name + '>';
    }

    /* Native CSS nesting keeps child CSSStyleRules inside the parent rule and
       serialises their relative selectors with `&`. Resolve that selector for
       Element.matches() while retaining the outer selector as the edit route.
       :is() preserves selector lists without a fragile string cross-product. */
    function dbeStyleResolveNestedSelector(parentSelector, selector) {
        if (!parentSelector) { return selector; }
        const parent = ':is(' + parentSelector + ')';
        return dbeStyleSplitSelectorList(selector).map((part) => {
            if (part.indexOf('&') !== -1) { return part.replace(/&/g, parent); }
            return parent + ' ' + part;
        }).join(', ');
    }

    /* Flatten every accessible rule from ordinary and adopted stylesheets.
       Unlike the old walker, a CSSStyleRule is not a leaf: CSS Nesting makes
       it a grouping rule, so its child rules must be visited with the resolved
       parent selector. Nested conditional rules keep the same parent context. */
    function dbeStyleAccessibleRules(el, id) {
        const found = [];
        const idoc = el.ownerDocument;
        const view = idoc.defaultView;
        function walk(rules, contexts, parentSelector, root) {
            for (let i = 0; i < rules.length; i++) {
                const rule = rules[i];
                if (rule.selectorText && rule.style) {
                    const resolvedSelector = dbeStyleResolveNestedSelector(parentSelector, rule.selectorText);
                    let rootInfo = root;
                    if (!rootInfo) {
                        const selectorId = dbeStyleSelectorModuleId(rule.selectorText);
                        const owner = dbeStyleClosestMatch(el, resolvedSelector);
                        const targetId = selectorId || dbeStyleElementModuleId(owner) || id;
                        const source = dbeStyleRuleSource(rule, targetId);
                        const matchedClass = dbeStyleMatchedClass(rule.selectorText, targetId);
                        const simpleClass = matchedClass && normSel(rule.selectorText) === matchedClass;
                        rootInfo = {
                            source,
                            targetId,
                            editSelector: source === 'local' ? '%local%' : (source === 'page' ? '' : rule.selectorText),
                            editMode: source === 'local' || simpleClass ? 'element' : 'stylesheet'
                        };
                    }
                    if (rule.style.length) {
                        found.push({
                            selector: resolvedSelector,
                            authoredSelector: rule.selectorText,
                            style: rule.style,
                            source: rootInfo.source,
                            targetId: rootInfo.targetId,
                            contexts: contexts.slice(),
                            nested: !!parentSelector,
                            editSelector: rootInfo.editSelector,
                            editMode: rootInfo.editMode
                        });
                    }
                    if (rule.cssRules) {
                        try { walk(rule.cssRules, contexts, resolvedSelector, rootInfo); } catch (e) {}
                    }
                    continue;
                }
                // Declarations written after a nested rule are represented by
                // CSSNestedDeclarations: a style block with no selector of its
                // own. They still belong to the current parent selector.
                if (rule.style && parentSelector && rule.style.length && root) {
                    found.push({
                        selector: parentSelector,
                        authoredSelector: parentSelector,
                        style: rule.style,
                        source: root.source,
                        targetId: root.targetId,
                        contexts: contexts.slice(),
                        nested: true,
                        editSelector: root.editSelector,
                        editMode: root.editMode
                    });
                }
                if (!rule.cssRules) { continue; }
                const nextContexts = contexts.slice();
                if (rule.media && rule.media.mediaText) {
                    try { if (!view.matchMedia(rule.media.mediaText).matches) { continue; } } catch (e) {}
                    nextContexts.push('@media ' + rule.media.mediaText);
                } else if (rule.conditionText) {
                    nextContexts.push(rule.cssText.split('{')[0].trim());
                }
                try { walk(rule.cssRules, nextContexts, parentSelector, root); } catch (e) {}
            }
        }
        // Builderius places the saved global/entity styles in constructable
        // adoptedStyleSheets; ordinary linked and inline CSS lives in
        // document.styleSheets. Inspect both, de-duplicated for browsers that
        // may expose an adopted sheet through both collections.
        const sheets = [].slice.call(idoc.styleSheets || []).concat([].slice.call(idoc.adoptedStyleSheets || []));
        sheets.filter((sheet, index) => { return sheets.indexOf(sheet) === index; }).forEach((sheet) => {
            try { walk(sheet.cssRules, [], '', null); } catch (e) { /* cross-origin stylesheet */ }
        });
        return found;
    }

    function dbeStyleMatchedRules(el, id, accessibleRules) {
        const found = (accessibleRules || dbeStyleAccessibleRules(el, id)).filter((rule) => {
            try { return el.matches(rule.selector); } catch (e) { return false; }
        });
        return found.reverse(); // later rules first, matching DevTools' scan order
    }

    function dbeStyleInheritedRuleGroups(el, accessibleRules, query) {
        const ancestors = [];
        let parent = el.parentElement;
        while (parent) {
            ancestors.push({ element: parent, label: dbeStyleElementName(parent), rules: [] });
            parent = parent.parentElement;
        }
        if (!ancestors.length) { return []; }
        const childComputed = el.ownerDocument.defaultView.getComputedStyle(el);
        accessibleRules.forEach((rule) => {
            try { if (el.matches(rule.selector)) { return; } } catch (e) { return; }
            const inherited = [];
            for (let i = 0; i < rule.style.length; i++) {
                const property = rule.style[i];
                if (dbeStyleCanInherit(property, !!query)) { inherited.push(property); }
            }
            if (!inherited.length) { return; }
            ancestors.forEach((group) => {
                try { if (!group.element.matches(rule.selector)) { return; } } catch (e) { return; }
                const ancestorComputed = group.element.ownerDocument.defaultView.getComputedStyle(group.element);
                const activeProperties = inherited.filter((property) => {
                    const childValue = childComputed.getPropertyValue(property).trim();
                    return childValue && childValue === ancestorComputed.getPropertyValue(property).trim();
                });
                if (!activeProperties.length) { return; }
                const inheritedRule = {};
                Object.keys(rule).forEach((key) => { inheritedRule[key] = rule[key]; });
                inheritedRule.properties = activeProperties;
                group.rules.push(inheritedRule);
            });
        });
        ancestors.forEach((group) => { group.rules.reverse(); });
        return ancestors.filter((group) => { return group.rules.length; });
    }

    /* Split grouped selectors without treating commas inside functional
       pseudo-classes or attribute selectors as selector separators. */
    function dbeStyleSplitSelectorList(selector) {
        const parts = [];
        let start = 0;
        let round = 0;
        let square = 0;
        let quote = '';
        let escaped = false;
        for (let i = 0; i < selector.length; i++) {
            const char = selector.charAt(i);
            if (escaped) { escaped = false; continue; }
            if (char === '\\') { escaped = true; continue; }
            if (quote) {
                if (char === quote) { quote = ''; }
                continue;
            }
            if (char === '"' || char === "'") { quote = char; continue; }
            if (char === '(') { round++; continue; }
            if (char === ')') { round = Math.max(0, round - 1); continue; }
            if (char === '[') { square++; continue; }
            if (char === ']') { square = Math.max(0, square - 1); continue; }
            if (char === ',' && !round && !square) {
                parts.push(selector.slice(start, i).trim());
                start = i + 1;
            }
        }
        parts.push(selector.slice(start).trim());
        return parts.filter(Boolean);
    }

    function dbeStylePseudoTokens(selector) {
        const states = [];
        const elements = [];
        const seen = {};
        selector.replace(DBE_STYLE_ELEMENT_RE, (token) => {
            token = token.toLowerCase().replace(/^:(before|after|first-letter|first-line)$/, '::$1');
            if (!seen[token]) { seen[token] = true; elements.push(token); }
            return token;
        });
        selector.replace(DBE_STYLE_STATE_RE, (token) => {
            token = token.toLowerCase();
            if (!seen[token]) { seen[token] = true; states.push(token); }
            return token;
        });
        return { states, elements, all: states.concat(elements) };
    }

    /* Remove the state and generated-box portion to find whether the authored
       selector is connected to the selected element even while a state such
       as :hover is inactive. Empty functional pseudos are cleaned afterwards. */
    function dbeStylePseudoBaseSelector(selector) {
        let base = selector.replace(DBE_STYLE_ELEMENT_RE, '').replace(DBE_STYLE_STATE_RE, '');
        let previous = '';
        while (base !== previous) {
            previous = base;
            base = base
                .replace(/:(?:not|is|where|has)\(\s*(?:,\s*)*\)/gi, '')
                .replace(/\(\s*,/g, '(')
                .replace(/,\s*\)/g, ')');
        }
        return base.trim() || '*';
    }

    function dbeStylePseudoRules(el, id) {
        const found = [];
        dbeStyleAccessibleRules(el, id).forEach((rule) => {
            dbeStyleSplitSelectorList(rule.selector).forEach((selector) => {
                const tokens = dbeStylePseudoTokens(selector);
                if (!tokens.all.length) { return; }
                try {
                    if (!el.matches(dbeStylePseudoBaseSelector(selector))) { return; }
                    const activeSelector = selector.replace(DBE_STYLE_ELEMENT_RE, '').trim() || '*';
                    const pseudoRule = {};
                    Object.keys(rule).forEach((key) => { pseudoRule[key] = rule[key]; });
                    pseudoRule.selector = selector;
                    pseudoRule.tokens = tokens;
                    pseudoRule.active = el.matches(activeSelector);
                    found.push(pseudoRule);
                } catch (e) { /* selector unsupported by Element.matches */ }
            });
        });
        return found.reverse();
    }

    function dbeStyleSourceLabel(source) {
        if (source === 'local') { return dbeT('styleSourceLocal', 'Local'); }
        if (source === 'global') { return dbeT('styleSourceGlobal', 'Global'); }
        if (source === 'entity') { return entityScopeLabel(); }
        return dbeT('styleSourcePage', 'Page or framework');
    }

    function dbeStyleEmpty(message) {
        const p = document.createElement('p');
        p.className = 'dbe-style-inspector__empty';
        p.textContent = message;
        return p;
    }

    function dbeStyleRenderComputed(content, el) {
        const computed = el.ownerDocument.defaultView.getComputedStyle(el);
        let names = [];
        if (dbeStyleInspectorState.allComputed) {
            for (let i = 0; i < computed.length; i++) { names.push(computed[i]); }
        } else {
            names = DBE_STYLE_COMMON_PROPERTIES.filter((name) => {
                return computed.getPropertyValue(name).trim() !== '';
            });
        }
        const query = dbeStyleInspectorState.filter.toLowerCase();
        names = names.filter((name) => {
            const value = computed.getPropertyValue(name).trim();
            return !query || name.toLowerCase().indexOf(query) !== -1 || value.toLowerCase().indexOf(query) !== -1;
        });
        if (!names.length) {
            content.appendChild(dbeStyleEmpty(dbeT('styleNoProperties', 'No computed properties match this filter.')));
            return;
        }
        const dl = document.createElement('dl');
        dl.className = 'dbe-style-inspector__properties';
        names.forEach((name) => {
            const row = document.createElement('div');
            row.className = 'dbe-style-inspector__property';
            const dt = document.createElement('dt');
            const dd = document.createElement('dd');
            dt.textContent = name;
            dd.textContent = computed.getPropertyValue(name).trim();
            row.appendChild(dt); row.appendChild(dd); dl.appendChild(row);
        });
        content.appendChild(dl);
    }

    function dbeStyleRuleProperties(rule) {
        if (rule.properties) { return rule.properties; }
        const properties = [];
        for (let i = 0; i < rule.style.length; i++) { properties.push(rule.style[i]); }
        return properties;
    }

    function dbeStyleRuleMatchesFilter(rule, query, extra) {
        if (!query) { return true; }
        let text = rule.selector + ' ' + (extra || '') + ' ';
        dbeStyleRuleProperties(rule).forEach((property) => {
            text += property + ' ' + rule.style.getPropertyValue(property) + ' ';
        });
        return text.toLowerCase().indexOf(query) !== -1;
    }

    function dbeStyleRenderRuleList(rules, fallbackId) {
        const list = document.createElement('ol');
        list.className = 'dbe-style-inspector__rules';
        rules.forEach((rule) => {
            const item = document.createElement('li');
            item.className = 'dbe-style-inspector__rule';
            item.setAttribute('data-source', rule.source);
            const head = document.createElement('div');
            head.className = 'dbe-style-inspector__rule-head';
            const copy = document.createElement('div');
            const selector = document.createElement('div');
            selector.className = 'dbe-style-inspector__selector';
            selector.textContent = rule.selector;
            copy.appendChild(selector);
            const meta = document.createElement('div');
            meta.className = 'dbe-style-inspector__rule-meta';
            const metaLabels = [dbeStyleSourceLabel(rule.source)];
            if (rule.nested) { metaLabels.push(dbeT('styleNestedRule', 'Nested')); }
            metaLabels.concat(rule.contexts).forEach((label) => {
                const badge = document.createElement('span');
                badge.className = 'dbe-style-inspector__badge';
                badge.textContent = label;
                meta.appendChild(badge);
            });
            copy.appendChild(meta); head.appendChild(copy);
            if (rule.editSelector && rule.source !== 'page') {
                const edit = document.createElement('button');
                edit.type = 'button';
                edit.className = 'dbe-style-inspector__edit';
                edit.textContent = dbeT('styleEditRule', 'Edit rule');
                edit.addEventListener('click', () => {
                    const editScope = rule.source === 'global' ? 'global' : (rule.source === 'entity' ? 'template' : null);
                    const inspector = document.querySelector('.dbe-style-inspector');
                    if (inspector) { inspector.remove(); dbeStyleInspectorState.id = null; }
                    if (rule.editMode === 'stylesheet') { dbeOpenStylesheetSelector(rule.editSelector, editScope); }
                    else { dbeOpenStyleEditor(rule.targetId || fallbackId, rule.editSelector, editScope); }
                });
                head.appendChild(edit);
            }
            item.appendChild(head);
            const declarations = document.createElement('dl');
            declarations.className = 'dbe-style-inspector__declarations';
            dbeStyleRuleProperties(rule).forEach((prop) => {
                const decl = document.createElement('div');
                decl.className = 'dbe-style-inspector__declaration';
                const dt = document.createElement('dt');
                const dd = document.createElement('dd');
                dt.textContent = prop + ':';
                dd.textContent = rule.style.getPropertyValue(prop).trim() + (rule.style.getPropertyPriority(prop) ? ' !important' : '');
                decl.appendChild(dt); decl.appendChild(dd); declarations.appendChild(decl);
            });
            item.appendChild(declarations); list.appendChild(item);
        });
        return list;
    }

    function dbeStyleRenderRules(content, el, id) {
        const query = dbeStyleInspectorState.filter.toLowerCase();
        const accessibleRules = dbeStyleAccessibleRules(el, id);
        const rules = dbeStyleMatchedRules(el, id, accessibleRules).filter((rule) => {
            return dbeStyleRuleMatchesFilter(rule, query);
        });
        const inheritedGroups = dbeStyleInheritedRuleGroups(el, accessibleRules, query).map((group) => {
            return {
                label: group.label,
                rules: group.rules.filter((rule) => {
                    return dbeStyleRuleMatchesFilter(rule, query, group.label);
                })
            };
        }).filter((group) => { return group.rules.length; });
        if (!rules.length && !inheritedGroups.length) {
            content.appendChild(dbeStyleEmpty(dbeT('styleNoMatchedRules', 'No accessible authored rules match this rendered element.')));
            return;
        }
        if (rules.length) { content.appendChild(dbeStyleRenderRuleList(rules, id)); }
        if (!inheritedGroups.length) { return; }
        const inheritedSection = document.createElement('section');
        inheritedSection.className = 'dbe-style-inspector__section dbe-style-inspector__inherited';
        const heading = document.createElement('h3');
        heading.className = 'dbe-style-inspector__section-title';
        heading.textContent = dbeT('styleInheritedStyles', 'Inherited styles');
        inheritedSection.appendChild(heading);
        const hint = document.createElement('p');
        hint.className = 'dbe-style-inspector__hint';
        hint.textContent = dbeT('styleInheritedHint', 'Rules on ancestors whose inheritable declarations resolve to the same value here. Computed shows the final cascade.');
        inheritedSection.appendChild(hint);
        inheritedGroups.forEach((group) => {
            const ancestor = document.createElement('section');
            ancestor.className = 'dbe-style-inspector__inherited-group';
            const ancestorHeading = document.createElement('h4');
            ancestorHeading.className = 'dbe-style-inspector__inherited-from';
            ancestorHeading.textContent = dbeFmt(dbeT('styleInheritedFrom', 'Inherited from %s'), group.label);
            ancestor.appendChild(ancestorHeading);
            ancestor.appendChild(dbeStyleRenderRuleList(group.rules, id));
            inheritedSection.appendChild(ancestor);
        });
        content.appendChild(inheritedSection);
    }

    function dbeStyleRenderPseudos(content, el, id) {
        const query = dbeStyleInspectorState.filter.toLowerCase();
        let rules = dbeStylePseudoRules(el, id);
        const hint = document.createElement('p');
        hint.className = 'dbe-style-inspector__hint';
        hint.textContent = dbeT('stylePseudoHint', 'Inactive states show authored declarations. Computed values are available for generated pseudo-elements and states currently active in the canvas.');
        content.appendChild(hint);

        const pseudoElements = [];
        rules.forEach((rule) => {
            rule.tokens.elements.forEach((pseudo) => {
                if (pseudoElements.indexOf(pseudo) === -1) { pseudoElements.push(pseudo); }
            });
        });

        const computedSection = document.createElement('section');
        computedSection.className = 'dbe-style-inspector__section';
        let computedShown = false;
        pseudoElements.forEach((pseudo) => {
            let computed;
            try { computed = el.ownerDocument.defaultView.getComputedStyle(el, pseudo); } catch (e) { return; }
            const names = DBE_STYLE_PSEUDO_PROPERTIES.filter((name) => {
                const value = computed.getPropertyValue(name).trim();
                return value && (!query || pseudo.toLowerCase().indexOf(query) !== -1 || name.toLowerCase().indexOf(query) !== -1 || value.toLowerCase().indexOf(query) !== -1);
            });
            if (!names.length) { return; }
            if (!computedShown) {
                const heading = document.createElement('h3');
                heading.className = 'dbe-style-inspector__section-title';
                heading.textContent = dbeT('stylePseudoComputed', 'Computed pseudo-elements');
                computedSection.appendChild(heading);
                computedShown = true;
            }
            const card = document.createElement('div');
            card.className = 'dbe-style-inspector__pseudo-computed';
            const label = document.createElement('h4');
            label.className = 'dbe-style-inspector__pseudo-label';
            label.textContent = pseudo;
            card.appendChild(label);
            const dl = document.createElement('dl');
            dl.className = 'dbe-style-inspector__properties';
            names.forEach((name) => {
                const row = document.createElement('div');
                row.className = 'dbe-style-inspector__property';
                const dt = document.createElement('dt');
                const dd = document.createElement('dd');
                dt.textContent = name;
                dd.textContent = computed.getPropertyValue(name).trim();
                row.appendChild(dt); row.appendChild(dd); dl.appendChild(row);
            });
            card.appendChild(dl); computedSection.appendChild(card);
        });
        rules = rules.filter((rule) => {
            if (!query) { return true; }
            let text = rule.selector + ' ' + rule.tokens.all.join(' ') + ' ';
            for (let i = 0; i < rule.style.length; i++) {
                const prop = rule.style[i];
                text += prop + ' ' + rule.style.getPropertyValue(prop) + ' ';
            }
            return text.toLowerCase().indexOf(query) !== -1;
        });
        if (!rules.length) {
            if (computedShown) { content.appendChild(computedSection); }
            else { content.appendChild(dbeStyleEmpty(dbeT('styleNoPseudos', 'No authored pseudo-state or pseudo-element rules are connected to this element.'))); }
            return;
        }

        const rulesSection = document.createElement('section');
        rulesSection.className = 'dbe-style-inspector__section';
        const rulesHeading = document.createElement('h3');
        rulesHeading.className = 'dbe-style-inspector__section-title';
        rulesHeading.textContent = dbeT('stylePseudoRules', 'Related authored rules');
        rulesSection.appendChild(rulesHeading);
        const list = document.createElement('ol');
        list.className = 'dbe-style-inspector__rules';
        rules.forEach((rule) => {
            const item = document.createElement('li');
            item.className = 'dbe-style-inspector__rule';
            item.setAttribute('data-source', rule.source);
            const head = document.createElement('div');
            head.className = 'dbe-style-inspector__rule-head';
            const copy = document.createElement('div');
            const selector = document.createElement('div');
            selector.className = 'dbe-style-inspector__selector';
            selector.textContent = rule.selector;
            copy.appendChild(selector);
            const meta = document.createElement('div');
            meta.className = 'dbe-style-inspector__rule-meta';
            let labels = [dbeStyleSourceLabel(rule.source)];
            if (rule.nested) { labels.push(dbeT('styleNestedRule', 'Nested')); }
            labels = labels.concat(rule.tokens.all).concat(rule.contexts);
            labels.push(rule.active ? dbeT('stylePseudoActive', 'Active now') : dbeT('stylePseudoInactive', 'Inactive state'));
            labels.forEach((label, index) => {
                const badge = document.createElement('span');
                badge.className = 'dbe-style-inspector__badge';
                if (index === labels.length - 1) { badge.setAttribute('data-state', rule.active ? 'active' : 'inactive'); }
                badge.textContent = label;
                meta.appendChild(badge);
            });
            copy.appendChild(meta); head.appendChild(copy);
            if (rule.editSelector && rule.source !== 'page') {
                const edit = document.createElement('button');
                edit.type = 'button';
                edit.className = 'dbe-style-inspector__edit';
                edit.textContent = dbeT('styleEditRule', 'Edit rule');
                edit.addEventListener('click', () => {
                    const editScope = rule.source === 'global' ? 'global' : (rule.source === 'entity' ? 'template' : null);
                    const inspector = document.querySelector('.dbe-style-inspector');
                    if (inspector) { inspector.remove(); dbeStyleInspectorState.id = null; }
                    if (rule.editMode === 'stylesheet') { dbeOpenStylesheetSelector(rule.editSelector, editScope); }
                    else { dbeOpenStyleEditor(rule.targetId || id, rule.editSelector, editScope); }
                });
                head.appendChild(edit);
            }
            item.appendChild(head);
            const declarations = document.createElement('dl');
            declarations.className = 'dbe-style-inspector__declarations';
            for (let i = 0; i < rule.style.length; i++) {
                const prop = rule.style[i];
                const decl = document.createElement('div');
                decl.className = 'dbe-style-inspector__declaration';
                const dt = document.createElement('dt');
                const dd = document.createElement('dd');
                dt.textContent = prop + ':';
                dd.textContent = rule.style.getPropertyValue(prop).trim() + (rule.style.getPropertyPriority(prop) ? ' !important' : '');
                decl.appendChild(dt); decl.appendChild(dd); declarations.appendChild(decl);
            }
            item.appendChild(declarations); list.appendChild(item);
        });
        rulesSection.appendChild(list); content.appendChild(rulesSection);
        if (computedShown) { content.appendChild(computedSection); }
    }

    function dbeRenderStyleInspector() {
        const panel = document.querySelector('.dbe-style-inspector');
        if (!panel || !dbeStyleInspectorState.id) { return; }
        const id = dbeStyleInspectorState.id;
        const targets = dbeStyleTargets(id);
        if (dbeStyleInspectorState.instance >= targets.length) { dbeStyleInspectorState.instance = 0; }
        panel.querySelector('.dbe-style-inspector__target').textContent = dbeStyleTargetName(id);
        const count = panel.querySelector('.dbe-style-inspector__instance-count');
        const prev = panel.querySelector('[data-instance="prev"]');
        const next = panel.querySelector('[data-instance="next"]');
        const multi = targets.length > 1;
        prev.hidden = !multi; next.hidden = !multi; count.hidden = !multi;
        count.textContent = multi ? dbeFmt(dbeT('styleInstanceCount', '%1$s of %2$s rendered instances'), dbeStyleInspectorState.instance + 1, targets.length) : '';
        [].slice.call(panel.querySelectorAll('.dbe-style-inspector__tab')).forEach((tab) => {
            const active = tab.getAttribute('data-tab') === dbeStyleInspectorState.tab;
            tab.setAttribute('aria-selected', active ? 'true' : 'false');
            tab.tabIndex = active ? 0 : -1;
            if (active) { panel.querySelector('.dbe-style-inspector__content').setAttribute('aria-labelledby', tab.id); }
        });
        const all = panel.querySelector('.dbe-style-inspector__all');
        all.hidden = dbeStyleInspectorState.tab !== 'computed';
        const check = all.querySelector('input');
        check.checked = dbeStyleInspectorState.allComputed;
        const content = panel.querySelector('.dbe-style-inspector__content');
        const scrollTop = content.scrollTop;
        const nextContent = document.createElement('div');
        if (!targets.length) {
            nextContent.appendChild(dbeStyleEmpty(dbeT('styleNoCanvasElement', 'This element is not currently rendered in the canvas.')));
        } else if (dbeStyleInspectorState.tab === 'computed') {
            dbeStyleRenderComputed(nextContent, targets[dbeStyleInspectorState.instance]);
        } else if (dbeStyleInspectorState.tab === 'pseudos') {
            dbeStyleRenderPseudos(nextContent, targets[dbeStyleInspectorState.instance], id);
        } else {
            dbeStyleRenderRules(nextContent, targets[dbeStyleInspectorState.instance], id);
        }
        const renderKey = [id, dbeStyleInspectorState.instance, dbeStyleInspectorState.tab, dbeStyleInspectorState.filter, dbeStyleInspectorState.allComputed ? 'all' : 'common'].join('|');
        // schedule() runs for unrelated Builderius mutations. Leave identical
        // inspector DOM intact so those ticks cannot reset scrolling or focus.
        if (content.getAttribute('data-dbe-render-key') === renderKey && content.innerHTML === nextContent.innerHTML) { return; }
        content.replaceChildren.apply(content, [].slice.call(nextContent.childNodes));
        content.setAttribute('data-dbe-render-key', renderKey);
        content.scrollTop = Math.min(scrollTop, Math.max(0, content.scrollHeight - content.clientHeight));
    }

    function dbeCloseStyleInspector(panel) {
        const id = dbeStyleInspectorState.id;
        const preferred = dbeStyleInspectorState.focusReturn;
        panel.remove();
        dbeStyleInspectorState.id = null;
        dbeStyleInspectorState.focusReturn = null;
        const target = preferred && preferred.isConnected
            ? preferred : (id && document.querySelector('.uniRightPanel .uni-tree-node-' + id));
        if (target) { try { target.focus(); } catch (e) {} }
    }

    function dbeBuildStyleInspector() {
        const panel = document.createElement('aside');
        panel.className = 'dbe-style-inspector';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'false');
        panel.setAttribute('aria-labelledby', 'dbe-style-inspector-title');
        const head = document.createElement('div');
        head.className = 'dbe-style-inspector__head';
        const identity = document.createElement('div');
        identity.className = 'dbe-style-inspector__identity';
        const title = document.createElement('h2');
        title.id = 'dbe-style-inspector-title';
        title.className = 'dbe-style-inspector__title';
        title.textContent = dbeT('styleInspector', 'Style inspector');
        const target = document.createElement('div');
        target.className = 'dbe-style-inspector__target';
        identity.appendChild(title); identity.appendChild(target); head.appendChild(identity);
        const actions = document.createElement('div');
        actions.className = 'dbe-style-inspector__head-actions';
        function iconButton(label, glyph) {
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'dbe-style-inspector__icon-button';
            button.setAttribute('aria-label', label); button.textContent = glyph;
            return button;
        }
        const prev = iconButton(dbeT('stylePreviousInstance', 'Previous rendered instance'), '‹'); prev.setAttribute('data-instance', 'prev');
        const count = document.createElement('span'); count.className = 'dbe-style-inspector__instance-count';
        const next = iconButton(dbeT('styleNextInstance', 'Next rendered instance'), '›'); next.setAttribute('data-instance', 'next');
        prev.addEventListener('click', () => {
            const n = dbeStyleTargets(dbeStyleInspectorState.id).length;
            if (n) { dbeStyleInspectorState.instance = (dbeStyleInspectorState.instance + n - 1) % n; dbeRenderStyleInspector(); }
        });
        next.addEventListener('click', () => {
            const n = dbeStyleTargets(dbeStyleInspectorState.id).length;
            if (n) { dbeStyleInspectorState.instance = (dbeStyleInspectorState.instance + 1) % n; dbeRenderStyleInspector(); }
        });
        const refresh = iconButton(dbeT('styleRefresh', 'Refresh styles'), '↻');
        refresh.addEventListener('click', dbeRenderStyleInspector);
        const close = iconButton(dbeT('close', 'Close'), '×');
        close.addEventListener('click', () => { dbeCloseStyleInspector(panel); });
        actions.appendChild(prev); actions.appendChild(count); actions.appendChild(next); actions.appendChild(refresh); actions.appendChild(close);
        head.appendChild(actions); panel.appendChild(head);
        const tabs = document.createElement('div');
        tabs.className = 'dbe-style-inspector__tabs'; tabs.setAttribute('role', 'tablist');
        [['rules', dbeT('styleMatchedRules', 'Matched rules')], ['computed', dbeT('styleComputed', 'Computed')], ['pseudos', dbeT('stylePseudos', 'Pseudos')]].forEach((pair) => {
            const tab = document.createElement('button');
            tab.type = 'button'; tab.className = 'dbe-style-inspector__tab'; tab.id = 'dbe-style-tab-' + pair[0]; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', 'dbe-style-inspector-panel'); tab.setAttribute('data-tab', pair[0]); tab.textContent = pair[1];
            tab.addEventListener('click', () => { dbeStyleInspectorState.tab = pair[0]; dbeRenderStyleInspector(); });
            tabs.appendChild(tab);
        });
        tabs.addEventListener('keydown', (e) => {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) === -1) { return; }
            e.preventDefault();
            const buttons = [].slice.call(tabs.querySelectorAll('[role="tab"]'));
            let at = buttons.indexOf(document.activeElement);
            if (e.key === 'Home') { at = 0; }
            else if (e.key === 'End') { at = buttons.length - 1; }
            else { at = (at + (e.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length; }
            buttons[at].click(); buttons[at].focus();
        });
        panel.appendChild(tabs);
        const body = document.createElement('div'); body.className = 'dbe-style-inspector__body';
        const toolbar = document.createElement('div'); toolbar.className = 'dbe-style-inspector__toolbar';
        const search = document.createElement('input');
        search.type = 'search'; search.className = 'dbe-style-inspector__search'; search.placeholder = dbeT('styleSearchProperties', 'Filter CSS properties'); search.setAttribute('aria-label', search.placeholder);
        search.addEventListener('input', () => { dbeStyleInspectorState.filter = search.value.trim(); dbeRenderStyleInspector(); });
        const all = document.createElement('label'); all.className = 'dbe-style-inspector__all';
        const check = document.createElement('input'); check.type = 'checkbox';
        check.addEventListener('change', () => { dbeStyleInspectorState.allComputed = check.checked; dbeRenderStyleInspector(); });
        all.appendChild(check); all.appendChild(document.createTextNode(dbeT('styleShowAll', 'Show all computed properties')));
        toolbar.appendChild(search); toolbar.appendChild(all); body.appendChild(toolbar);
        const content = document.createElement('div'); content.id = 'dbe-style-inspector-panel'; content.className = 'dbe-style-inspector__content'; content.setAttribute('role', 'tabpanel');
        body.appendChild(content); panel.appendChild(body);
        panel.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { e.preventDefault(); dbeCloseStyleInspector(panel); }
        });
        document.body.appendChild(panel);
        return panel;
    }

    function openStyleInspector(id) {
        const existing = document.querySelector('.dbe-style-inspector');
        if (!existing) { dbeStyleInspectorState.focusReturn = document.activeElement; }
        const row = id && document.querySelector('.uniRightPanel .uni-tree-node-' + id);
        if (row && activeId() !== id) { clickSeq(row); }
        dbeStyleInspectorState.id = id;
        dbeStyleInspectorState.instance = 0;
        const panel = existing || dbeBuildStyleInspector();
        dbeRenderStyleInspector();
        const search = panel.querySelector('.dbe-style-inspector__search');
        if (search) { try { search.focus(); } catch (e) {} }
    }

    function refreshOpenStyleInspector() {
        const panel = document.querySelector('.dbe-style-inspector');
        if (!panel) { return; }
        const id = activeId();
        if (id && id !== dbeStyleInspectorState.id) {
            dbeStyleInspectorState.id = id;
            dbeStyleInspectorState.instance = 0;
        }
        dbeRenderStyleInspector();
    }

    function dbeStyleActionItems(id) {
        const items = [
            makeCtxItem(dbeT('inspectStyles', 'Inspect styles…'), () => {
                dbeSetOwnedTimeout(DBE_STYLES_OWNER, () => { openStyleInspector(id); }, 120);
            }),
            makeCtxItem(dbeT('editElementStyles', 'Edit element styles (%local%)'), () => { dbeOpenStyleEditor(id, '%local%', null); })
        ];
        const mod = (modules() || {})[id];
        moduleClasses(mod).forEach((className) => {
            const selector = '.' + className;
            items.push(makeCtxItem(dbeFmt(dbeT('editClassStyles', 'Edit %1$s — %2$s'), selector, dbeT('scopeGlobal', 'Global')), () => {
                dbeOpenStyleEditor(id, selector, 'global');
            }, { className: 'dbe-ctx-item--class' }));
            items.push(makeCtxItem(dbeFmt(dbeT('editClassStyles', 'Edit %1$s — %2$s'), selector, entityScopeLabel()), () => {
                dbeOpenStyleEditor(id, selector, 'template');
            }, { className: 'dbe-ctx-item--class' }));
        });
        return items;
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
        if (on('style_inspector')) { try { refreshOpenStyleInspector(); } catch (e) {} }
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

        const inspector = document.querySelector('.dbe-style-inspector');
        if (inspector) { dbeCloseStyleInspector(inspector); }
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
        dbeStyleScopeSelectorMemo = {
            global: { css: null, selectors: {} },
            entity: { css: null, selectors: {} }
        };
        dbeStyleInspectorState = { id: null, instance: 0, tab: 'rules', filter: '', allComputed: false, focusReturn: null };
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

        host.setStylesApi(Object.freeze({
            actionItems: dbeStyleActionItems,
            openInspector: openStyleInspector,
            openEditor: dbeOpenStyleEditor,
            entityScopeLabel
        }));
    };

    window.dbeBuilderChunks = chunks;
}());

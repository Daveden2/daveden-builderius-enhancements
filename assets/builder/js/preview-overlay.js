/**
 * Canvas overlay label contrast fix — runs in the INNER PREVIEW document only.
 *
 * Stock overlay colours: hovered regular #5EA0ED / hovered component #07CC91
 * (both with white 12px text — 2.7:1 / 2.1:1, WCAG fails), selected regular
 * #415CEB (a hue that appears nowhere else in the chrome), selected component
 * #07CC91 — IDENTICAL to its hover, so selection is indistinguishable.
 * Scheme applied here: hue = kind, strength = state. Hovered keeps the stock
 * mid-tone with DARK text (blue 6.7:1, green 8.7:1); selected moves to a
 * stronger shade of the same hue with WHITE text (blue #2a6ecb 5.0:1, deep
 * green #067a57 5.3:1) and a 2px stroke. Unknown types are left stock.
 */
(function () {
	'use strict';
	var FIX_ID = 'dbe-overlay-label-fix';
	/* The hexes below duplicate token values from 00-tokens.css — #2a6ecb =
	   --dbe-accent-strong (dark), #067a57 = --dbe-component (light), #14161a =
	   --dbe-on-accent (dark). They CANNOT reference the custom properties:
	   this runs in the inner-preview iframe's shadow roots, a separate
	   document the chrome CSS never reaches. If the tokens change, update
	   both files (00-tokens.css carries the matching pointer). */
	var CSS = [
		'.label { font-weight: 600; }',
		':host([data-uni-overlay-type="hovered"][data-uni-overlay-mod-type="regular"]) .label,',
		':host([data-uni-overlay-type="hovered"][data-uni-overlay-mod-type="component"]) .label { color: #14161a !important; }',
		':host([data-uni-overlay-type="selected"][data-uni-overlay-mod-type="regular"]) .label { background-color: #2a6ecb !important; color: #ffffff !important; }',
		':host([data-uni-overlay-type="selected"][data-uni-overlay-mod-type="regular"]) svg rect { stroke: #2a6ecb !important; stroke-width: 2; }',
		':host([data-uni-overlay-type="selected"][data-uni-overlay-mod-type="component"]) .label { background-color: #067a57 !important; color: #ffffff !important; }',
		':host([data-uni-overlay-type="selected"][data-uni-overlay-mod-type="component"]) svg rect { stroke: #067a57 !important; stroke-width: 2; }'
	].join('\n');

	var observed = new WeakSet();

	function ensureStyle(sr) {
		if (sr.getElementById(FIX_ID)) { return; }
		var s = document.createElement('style');
		s.id = FIX_ID;
		s.textContent = CSS;
		sr.appendChild(s);
	}

	function patch(el) {
		if (!el || el.nodeName !== 'BUILDER-OVERLAY-HANDLES') { return; }
		var sr = el.shadowRoot;
		// The shadow root is built in connectedCallback; retry once if we ran first.
		if (!sr) { return void requestAnimationFrame(function () { patch(el); }); }
		ensureStyle(sr);
		// The builder REUSES the overlay element across state changes (hovered ->
		// selected) and rewrites its shadow content, wiping the injected style —
		// watch each shadow root and re-add. ensureStyle() no-ops when present,
		// so the observer cannot loop.
		if (!observed.has(sr)) {
			observed.add(sr);
			new MutationObserver(function () { ensureStyle(sr); }).observe(sr, { childList: true });
		}
	}

	function boot() {
		document.querySelectorAll('builder-overlay-handles').forEach(patch);
		new MutationObserver(function (muts) {
			muts.forEach(function (m) {
				if (m.type === 'attributes') { return void patch(m.target); }
				m.addedNodes.forEach(function (n) {
					patch(n);
					// An overlay inserted INSIDE an added wrapper is not itself in
					// addedNodes — sweep the subtree too (cheap: overlays are rare).
					if (n.nodeType === 1 && n.querySelectorAll) {
						n.querySelectorAll('builder-overlay-handles').forEach(patch);
					}
				});
			});
		}).observe(document.documentElement, {
			childList: true, subtree: true,
			attributes: true, attributeFilter: ['data-uni-overlay-type', 'data-uni-overlay-mod-type']
		});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', boot);
	} else {
		boot();
	}
})();

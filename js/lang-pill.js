// The TH/EN swap pill beside the wordmark (docs/claude-code-spec-i18n.md).
//
// Built here rather than in each page's markup, the same way js/beta-tag.js
// builds the Beta tooltip, and only while the ?i18n=1 flag is on: until the
// Thai content pass is reviewed the pill is absent from the DOM, not merely
// hidden. ?lang=th works with or without it.
//
// The pill shows the *other* language — "TH" while in English, "EN" while in
// Thai — with a Latin label always. The click fades the label out over 160ms,
// swaps the language, and fades it back in; under reduced motion the swap is
// immediate. The fade is a transition on opacity alone (css/base.css).

import { initI18n, getLang, setLang, hasFlag, translate } from '/js/i18n.js';

const FADE_MS = 160;

async function init() {
  // FLAG: remove this guard (and the one in resolveLang) to ship the pill.
  if (!hasFlag()) return;
  const wrap = document.querySelector('.bgs-wordmark');
  if (!wrap) return;

  const pill = document.createElement('button');
  pill.type = 'button';
  pill.className = 'bgs-pill bgs-lang';
  pill.dataset.i18nAttr = 'aria-label:pill.aria,title:pill.title';
  const lbl = document.createElement('span');
  lbl.className = 'lbl';
  lbl.dataset.i18n = 'pill.other';
  pill.appendChild(lbl);
  wrap.appendChild(pill);

  await initI18n();
  translate(pill);

  const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  let swapping = false;
  pill.addEventListener('click', () => {
    if (swapping) return;
    const next = getLang() === 'en' ? 'th' : 'en';
    if (motionMq.matches) { setLang(next); return; }
    swapping = true;
    pill.classList.add('is-swapping');
    setTimeout(() => {
      setLang(next);
      pill.classList.remove('is-swapping');
      swapping = false;
    }, FADE_MS);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

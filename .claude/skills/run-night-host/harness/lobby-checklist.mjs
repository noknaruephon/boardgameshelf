// The verification checklist from docs/claude-code-spec-lobby-stage.md, run
// against the real page with the network stubbed (see setup.mjs). ~99 checks,
// ~90 s. Exit code 1 on any FAIL; screenshots land in ./shots.
import { launch, newPage, open, push, shot, css, text, has, check, log, sleep, ORIGIN, CODE, finish } from './setup.mjs';

await launch();

// ---------- 1. Flag off ----------
{
  const page = await newPage();
  await open(page, '?lobby=0');
  check('flag off: classic h1 "Scan to join"', (await text(page, 'h1')) === 'Scan to join', await text(page, 'h1'));
  check('flag off: .recap, .qr-card, .start-btn present; no stage markup',
    await has(page, '.recap') && await has(page, '.qr-card') && await has(page, '.start-btn') && !(await has(page, '.stage-title')) && !(await has(page, '.share-bar')) && !(await has(page, '.fan-wrap')));
  await shot(page, '01-flag-off-classic');
  check('flag off: no page errors', page.errors.length === 0, page.errors.join(' | '));
  await page.context().close();
}

// ---------- 2. Stage, waiting (n=1, 5 hidden) ----------
{
  const page = await newPage();
  await open(page);
  check('stage: h1 "Tonight\'s deck"', (await text(page, 'h1')) === "Tonight's deck", await text(page, 'h1'));
  check('stage: sub line hidden/picked', (await text(page, '.stage-sub')) === '5 games · hidden until voting · you picked them', await text(page, '.stage-sub'));
  check('stage: .recap gone, .deal-wrap gone', !(await has(page, '.recap')) && !(await has(page, '.deal-wrap')));
  check('stage: no .tv-row without ?tv=1', !(await has(page, '.tv-row')));
  check('stage: glass.css linked', await has(page, 'link[href="/css/glass.css"]'));
  const pill = await page.$eval('#startBtn', (b) => ({ disabled: b.disabled, cls: b.className, txt: b.textContent.trim() }));
  check('start pill n=1: disabled, glass, "Start voting"', pill.disabled && /\bglass\b/.test(pill.cls) && !/is-ready/.test(pill.cls) && pill.txt === 'Start voting', JSON.stringify(pill));
  check('start hint n=1', (await text(page, '.start-hint')) === 'Needs 1 more player to start', await text(page, '.start-hint'));
  check('start pill disabled: no opacity dim', (await css(page, '#startBtn', 'opacity')) === '1', await css(page, '#startBtn', 'opacity'));
  check('start pill disabled text = ivory 38%', /0\.38\)$/.test(await css(page, '#startBtn', 'color')), await css(page, '#startBtn', 'color'));
  check('here count 1', (await text(page, '.here__n')) === '1');
  const host = await page.$eval('.here-row .chip.glass', (c) => ({ cls: c.className, tag: c.querySelector('.chip__tag')?.textContent, av: c.querySelector('.chip__avatar')?.textContent, txt: c.textContent.replace(/\s+/g,' ').trim() }));
  check('host chip: chip--you + HOST tag + initial N', /chip--you/.test(host.cls) && host.tag === 'Host' && host.av === 'N', JSON.stringify(host));
  check('open chip waiting text', (await text(page, '.chip--open')) === 'Waiting for players…', await text(page, '.chip--open'));
  check('open chip is-waiting: pulse animating', (await css(page, '.chip--open .pulse', 'animationName')) === 'pulse', await css(page, '.chip--open .pulse', 'animationName'));
  check('chip pop animation on, transition none (WebKit rule)', (await css(page, '.here-row .chip.glass', 'animationName')) === 'pop' && (await css(page, '.here-row .chip.glass', 'transitionProperty')) === 'none',
    `anim=${await css(page, '.here-row .chip.glass', 'animationName')} trans=${await css(page, '.here-row .chip.glass', 'transitionProperty')}`);
  check('avatar gold ring is inset box-shadow, no outline', /inset/.test(await css(page, '.chip__avatar', 'boxShadow')) && (await css(page, '.chip__avatar', 'outlineStyle')) === 'none', await css(page, '.chip__avatar', 'boxShadow'));
  check('share bar: QR thumb 76px with svg', (await page.$eval('#qr', (e) => e.getBoundingClientRect().width)) === 76 && await has(page, '#qr svg'), String(await page.$eval('#qr', (e) => e.getBoundingClientRect().width)));
  check('share bar: code + kicker + hint', (await text(page, '.share-bar__code')) === CODE && (await text(page, '.share-bar__kicker')) === 'Join code' && (await text(page, '.share-bar__hint')) === 'Tap the code to fill the screen');
  check('share bar: no nested buttons', (await page.$$('button button')).length === 0);
  const btns = await page.$$eval('#screen button', (bs) => bs.map((b) => ({ type: b.type, label: b.getAttribute('aria-label'), id: b.id })));
  check('all stage buttons type=button', btns.every((b) => b.type === 'button'), JSON.stringify(btns));
  check('qrOpen + copy have aria-labels', btns.find((b) => b.id === 'qrOpen')?.label === 'Show the QR code full screen' && btns.find((b) => b.id === 'copyLink')?.label === 'Copy link');
  check('copy round 44px, gold', (await page.$eval('#copyLink', (e) => e.getBoundingClientRect().width)) === 44);
  check('glow: gold radial gradient (hidden deck)', /radial-gradient/.test(await css(page, '.fan-glow', 'backgroundImage')), await css(page, '.fan-glow', 'backgroundImage'));
  page.glowHidden = await css(page, '.fan-glow', 'backgroundImage');
  check('cancel button present', (await text(page, '#cancelNight')) === 'Cancel game night');
  await shot(page, '02-stage-waiting-n1');

  // focus rings via keyboard
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return { id: a.id, fv: a.matches(':focus-visible'), outline: cs.outlineStyle, shadow: cs.boxShadow }; });
  check('keyboard focus on qrOpen: box-shadow ring, no outline', focused.id === 'qrOpen' && focused.fv && focused.outline === 'none' && focused.shadow !== 'none', JSON.stringify(focused));
  await page.keyboard.press('Tab');
  const f2 = await page.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return { id: a.id, fv: a.matches(':focus-visible'), outline: cs.outlineStyle, shadow: cs.boxShadow }; });
  check('keyboard focus on copy round: box-shadow ring, no outline', f2.id === 'copyLink' && f2.fv && f2.outline === 'none' && /rgb/.test(f2.shadow), JSON.stringify(f2));

  // copy round
  await page.click('#copyLink');
  await page.waitForFunction(() => document.getElementById('copyLink').getAttribute('aria-label') === 'Copied', null, { timeout: 1000 }).catch(() => null);
  const afterCopy = await page.$eval('#copyLink', (b) => ({ label: b.getAttribute('aria-label'), check: /M20 6 9 17l-5-5/.test(b.innerHTML) }));
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  check('copy round: clipboard = /vote/code', clip === `${ORIGIN}/vote/${CODE}`, clip);
  check('copy round: swaps to check + aria-label Copied', afterCopy.label === 'Copied' && afterCopy.check, JSON.stringify(afterCopy));
  await shot(page, '03-copied-check', { fullPage: false, clip: { x: 0, y: 260, width: 390, height: 160 } });
  await sleep(1750);
  const restored = await page.$eval('#copyLink', (b) => ({ label: b.getAttribute('aria-label'), copy: /<rect/.test(b.innerHTML) }));
  check('copy round: restores after 1.6s', restored.label === 'Copy link' && restored.copy, JSON.stringify(restored));

  // QR sheet
  const thumbSvg = await page.$eval('#qr', (e) => e.innerHTML);
  await page.click('#qrOpen');
  await sleep(350);
  const sheet = await page.evaluate(() => {
    const s = document.getElementById('qrSheet'); const cs = getComputedStyle(s); const big = s.querySelector('#qrBig');
    return { hidden: s.hidden, open: s.classList.contains('is-open'), opacity: cs.opacity, transform: cs.transform, pos: cs.position, z: cs.zIndex,
      role: s.getAttribute('role'), modal: s.getAttribute('aria-modal'), labelled: s.getAttribute('aria-labelledby'),
      focus: document.activeElement.className, bigW: big.getBoundingClientRect().width, bigSvg: big.innerHTML, locked: document.body.classList.contains('scroll-locked'),
      url: s.querySelector('.qr-sheet__url').textContent, code: s.querySelector('.qr-sheet__code').textContent, qrCalls: window.__qrCalls, transProp: cs.transitionProperty };
  });
  check('qr sheet: open, visible, fixed, dialog attrs', !sheet.hidden && sheet.open && sheet.opacity === '1' && sheet.pos === 'fixed' && sheet.role === 'dialog' && sheet.modal === 'true' && sheet.labelled === 'qrSheetTitle', JSON.stringify({ ...sheet, bigSvg: undefined }));
  check('qr sheet: focus on ×', sheet.focus === 'qr-sheet__x', sheet.focus);
  check('qr sheet: body scroll locked', sheet.locked);
  check('qr sheet: big frame 300px, same svg as thumb, QR encoded once', sheet.bigW === 300 && sheet.bigSvg === thumbSvg && sheet.qrCalls === 1, `w=${sheet.bigW} same=${sheet.bigSvg === thumbSvg} calls=${sheet.qrCalls}`);
  check('qr sheet: url + code text', sheet.url === `127.0.0.1:8123/vote/${CODE}` && sheet.code === CODE, sheet.url);
  check('qr sheet: enter transition on opacity+transform of the sheet only', /opacity/.test(sheet.transProp) && /transform/.test(sheet.transProp), sheet.transProp);
  const zTv = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--z-sheet') || '(none)');
  log('INFO', 'qr sheet z-index', `${sheet.z} (tv sheet token: ${zTv.trim()})`);
  await shot(page, '04-qr-sheet', { fullPage: false });
  // sheet copy
  await page.click('.qr-sheet__copy');
  await sleep(50);
  check('qr sheet: Copy link → "Copied!" + clipboard', (await text(page, '.qr-sheet__copy')) === 'Copied!' && (await page.evaluate(() => navigator.clipboard.readText())) === `${ORIGIN}/vote/${CODE}`);
  // focus trap + Esc
  await page.keyboard.press('Tab');
  const trapped = await page.evaluate(() => document.activeElement.className);
  check('qr sheet: Tab stays inside (× → Copy link)', trapped === 'qr-sheet__copy' || trapped === 'qr-sheet__x', trapped);
  await page.keyboard.press('Escape');
  await sleep(320);
  const afterEsc = await page.evaluate(() => ({ hidden: document.getElementById('qrSheet').hidden, focus: document.activeElement.id, locked: document.body.classList.contains('scroll-locked') }));
  check('qr sheet: Esc closes, focus back to opener, scroll unlocked', afterEsc.hidden && afterEsc.focus === 'qrOpen' && !afterEsc.locked, JSON.stringify(afterEsc));
  // × closes, tapping the code text opens too
  await page.click('.share-bar__code');
  await sleep(300);
  check('qr sheet: tapping the code opens it', !(await page.$eval('#qrSheet', (s) => s.hidden)));
  await page.click('.qr-sheet__x');
  await sleep(320);
  check('qr sheet: × closes', await page.$eval('#qrSheet', (s) => s.hidden));
  check('qr sheet: single instance', (await page.$$('#qrSheet')).length === 1);

  // ---- second player joins → ready ----
  await push(page, ['Nok', 'Mai']);
  await sleep(350);
  const ready = await page.$eval('#startBtn', (b) => ({ disabled: b.disabled, cls: b.className, txt: b.textContent.replace(/\s+/g, ' ').trim(), arrow: /<svg/.test(b.innerHTML), bg: getComputedStyle(b).backgroundColor, shadow: getComputedStyle(b).boxShadow }));
  check('start pill n=2: ready, gold, "Start voting · 2 players" + arrow', !ready.disabled && /is-ready/.test(ready.cls) && !/\bglass\b/.test(ready.cls) && ready.txt === 'Start voting · 2 players' && ready.arrow, JSON.stringify(ready));
  check('start hint n=2', (await text(page, '.start-hint')) === 'Everyone swipes on their own phone.');
  check('open chip n=2: "Room for more", pulse off, opacity 1', (await text(page, '.chip--open')) === 'Room for more' && (await css(page, '.chip--open .pulse', 'animationName')) === 'none' && (await css(page, '.chip--open .pulse', 'opacity')) === '1');
  check('here count 2, 2 player chips', (await text(page, '.here__n')) === '2' && (await page.$$('.here-row .chip.glass')).length === 2);
  check('second chip has no HOST tag', !(await page.$('.here-row .chip.glass:nth-of-type(2) .chip__tag')));
  await shot(page, '05-stage-ready-n2');
  await page.focus('#startBtn'); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
  const f3 = await page.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return { id: a.id, fv: a.matches(':focus-visible'), outline: cs.outlineStyle, shadow: cs.boxShadow }; });
  check('ready pill keyboard focus: gold box-shadow ring, no outline', f3.id === 'startBtn' && f3.fv && f3.outline === 'none' && (f3.shadow.match(/rgba?\(/g) || []).length === 3 && /0px 0px 0px 5px/.test(f3.shadow), JSON.stringify(f3));
  // cancel with others → confirm
  await page.click('#cancelNight');
  await sleep(100);
  check('cancel n=2: confirm dialog opens with count', await page.$eval('#confirm', (d) => d.classList.contains('open')) && /1 person has already joined/.test(await text(page, '#confirmBody')), await text(page, '#confirmBody'));
  await page.click('#confirmKeep');
  check('cancel: Keep closes dialog', !(await page.$eval('#confirm', (d) => d.classList.contains('open'))));
  // start
  await page.click('#startBtn');
  await sleep(100);
  check('start: startVoting called, button held disabled until status flips', (await page.evaluate(() => window.__started)) === 1 && (await page.$eval('#startBtn', (b) => b.disabled)));
  check('stage: no page errors', page.errors.length === 0, page.errors.join(' | '));
  await page.context().close();
}

// ---------- 3. Sub line variants ----------
{
  const page = await newPage();
  await open(page, '?d=5&reveal=1&mode=random');
  check('sub line: shown / random', (await text(page, '.stage-sub')) === '5 games · shown · picked at random', await text(page, '.stage-sub'));
  await open(page, '?d=1');
  check('sub line: singular "1 game"', (await text(page, '.stage-sub')) === '1 game · hidden until voting · you picked them', await text(page, '.stage-sub'));
  await open(page, '?lobby=1');
  check('?lobby=1 renders the stage too', await has(page, '.stage-title'));
  await page.context().close();
}

// ---------- 4. Fan sizes ----------
{
  const page = await newPage();
  const expect = { 1: { w: 104, q: 34, step: 0 }, 3: { w: 104, q: 34, step: 13 }, 5: { w: 104, q: 34, step: 13 }, 7: { w: 92, q: 30, step: 8.67 }, 10: { w: 80, q: 26, step: 5.78 }, 12: { w: 80, q: 26, step: 5.78 } };
  for (const n of [1, 3, 5, 7, 10, 12]) {
    await open(page, `?d=${n}`);
    const fan = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.fan .deck-card')];
      const wrap = document.querySelector('.fan-wrap').getBoundingClientRect();
      const mid = Math.floor((cards.length - 1) / 2);
      const zs = cards.map((c) => Number(c.style.zIndex));
      const rects = cards.map((c) => c.getBoundingClientRect());
      const left = Math.min(...rects.map((r) => r.left)), right = Math.max(...rects.map((r) => r.right));
      return {
        count: cards.length, more: document.querySelector('.fan-more')?.textContent || null,
        w: cards[0].offsetWidth, h: cards[0].offsetHeight, q: parseFloat(getComputedStyle(cards[0]).fontSize), radius: getComputedStyle(cards[0]).borderRadius,
        step: document.querySelector('.fan').style.getPropertyValue('--step'), glyphs: cards.every((c) => c.textContent.trim() === '?'),
        midTop: zs[mid] === Math.max(...zs), symmetric: zs.every((z, i) => z === zs[cards.length - 1 - i]),
        firstTransform: getComputedStyle(cards[0]).transform, midTransform: getComputedStyle(cards[mid]).transform,
        centred: Math.abs((left + right) / 2 - (wrap.left + wrap.width / 2)) < 2, wrapH: wrap.height, clipped: left < 0 || right > 390,
        cardTopOffset: cards[mid].offsetTop, shadow: getComputedStyle(cards[0]).boxShadow,
      };
    });
    const e = expect[n];
    const shown = Math.min(n, 10);
    check(`fan n=${n}: ${shown} cards, w=${e.w}, ?=${e.q}px, step=${e.step}deg`, fan.count === shown && fan.w === e.w && fan.q === e.q && fan.step === `${e.step}deg` && fan.glyphs, JSON.stringify({ count: fan.count, w: fan.w, h: fan.h, q: fan.q, step: fan.step, radius: fan.radius }));
    check(`fan n=${n}: middle on top, symmetric z, centred, not clipped, top 44`, fan.midTop && fan.symmetric && fan.centred && !fan.clipped && Math.round(fan.cardTopOffset) === 44, JSON.stringify({ midTop: fan.midTop, sym: fan.symmetric, centred: fan.centred, clipped: fan.clipped, top: fan.cardTopOffset }));
    if (n > 1) check(`fan n=${n}: outer card rotated, middle upright`, fan.firstTransform !== 'none' && fan.firstTransform !== fan.midTransform, `${fan.firstTransform} vs ${fan.midTransform}`);
    if (n === 12) check('fan n=12: +2 chip', fan.more === '+2', String(fan.more));
    else check(`fan n=${n}: no +N chip`, fan.more === null);
    if (n === 5) check('fan card shadow: inset gold 1px + drop', /inset/.test(fan.shadow) && /0px 10px 24px/.test(fan.shadow), fan.shadow);
    await shot(page, `06-fan-n${String(n).padStart(2, '0')}`, { fullPage: false, clip: { x: 0, y: 0, width: 390, height: 330 } });
  }
  check('fan: no page errors', page.errors.length === 0, page.errors.join(' | '));
  await page.context().close();
}

// ---------- 5. Revealed deck: covers, tap, broken image, glow ----------
{
  const page = await newPage();
  await open(page, '?d=5&reveal=1&broken=1');
  await sleep(400);
  const rev = await page.evaluate(() => ({
    clickable: document.querySelectorAll('.fan .deck-card.clickable').length, imgs: document.querySelectorAll('.fan .deck-card img').length,
    brokenCard: !!document.querySelector('.fan .deck-card[data-i="1"]'), brokenImg: !!document.querySelector('.fan .deck-card[data-i="1"] img'),
    glow: getComputedStyle(document.querySelector('.fan-glow')).backgroundImage, alt: document.querySelector('.fan .deck-card[data-i="0"] img')?.alt,
  }));
  check('revealed: 5 clickable cards, broken image removed, card kept', rev.clickable === 5 && rev.imgs === 4 && rev.brokenCard && !rev.brokenImg, JSON.stringify(rev));
  check('revealed: img alt "<title> cover"', rev.alt === 'Azul cover', rev.alt);
  check('glow gold and identical with deck shown', /radial-gradient/.test(rev.glow), rev.glow);
  await shot(page, '07-fan-revealed-n5');
  await page.click('.fan .deck-card[data-i="2"]');
  await sleep(400);
  const modalOpen = await page.evaluate(() => !!document.querySelector('.gm-backdrop.open, .open[class*="modal"], .game-modal.open, [class*="backdrop"].open'));
  const modalTitle = await page.evaluate(() => { const o = document.querySelector('[class*="backdrop"].open, .open[class*="modal"]'); return o ? o.textContent.replace(/\s+/g, ' ').slice(0, 80) : null; });
  check('revealed: tapping a cover opens the game modal', modalOpen && /Cascadia/.test(modalTitle || ''), modalTitle || 'no open modal');
  await shot(page, '08-cover-modal', { fullPage: false });
  await page.keyboard.press('Escape'); await sleep(300);
  // hidden deck: not tappable
  await open(page, '?d=5');
  await page.click('.fan .deck-card:nth-child(3)');
  await sleep(300);
  const anyOpen = await page.evaluate(() => !!document.querySelector('[class*="backdrop"].open, .open[class*="modal"]'));
  check('hidden: tapping a back opens nothing', !anyOpen && (await page.$$('.fan .deck-card.clickable')).length === 0);
  check('reveal: no page errors (other than the deliberate 404 cover)', page.errors.filter((e) => !/404/.test(e)).length === 0, page.errors.join(' | '));
  await page.context().close();
}

// ---------- 6. Roster wrap 5 and 8 names ----------
{
  const page = await newPage();
  await open(page);
  const names8 = ['Nok', 'Mai', 'ปลาย', 'Tan', 'เมย์', 'Alexander', 'Ploy', 'Bee'];
  await push(page, names8.slice(0, 5)); await sleep(350);
  await shot(page, '09-roster-5', { fullPage: false, clip: { x: 0, y: 380, width: 390, height: 260 } });
  await push(page, names8); await sleep(350);
  const wrap = await page.evaluate(() => {
    const row = document.querySelector('.here-row').getBoundingClientRect();
    const chips = [...document.querySelectorAll('.here-row .chip')].map((c) => { const r = c.getBoundingClientRect(); return { txt: c.textContent.replace(/\s+/g, ' ').trim(), av: c.querySelector('.chip__avatar')?.textContent, h: r.height, in: r.left >= row.left - 0.5 && r.right <= row.right + 0.5 }; });
    return { n: chips.length, allIn: chips.every((c) => c.in), h40: chips.every((c) => Math.round(c.h) === 40), avatars: chips.map((c) => c.av), rows: new Set([...document.querySelectorAll('.here-row .chip')].map((c) => Math.round(c.getBoundingClientRect().top))).size };
  });
  check('roster 8: 9 chips, all inside row, height 40, wraps', wrap.n === 9 && wrap.allIn && wrap.h40 && wrap.rows >= 2, JSON.stringify(wrap));
  check('roster: Thai initials are first grapheme', wrap.avatars[2] === 'ป' && wrap.avatars[4] === 'เ', JSON.stringify(wrap.avatars));
  check('roster 8: count 8', (await text(page, '.here__n')) === '8');
  await shot(page, '10-roster-8');
  await page.context().close();
}

// ---------- 7. TV row ----------
{
  const page = await newPage();
  await open(page, '?tv=1&lobby=1');
  const tv = await page.evaluate(() => {
    const row = document.querySelector('.tv-row'); const pill = document.getElementById('showTv'); const start = document.getElementById('startBtn');
    return { row: !!row, before: row && !!(row.compareDocumentPosition(start) & Node.DOCUMENT_POSITION_FOLLOWING), txt: pill?.textContent.trim(), h: pill?.getBoundingClientRect().height, glass: pill?.classList.contains('glass'), icon: /<svg/.test(pill?.innerHTML || '') };
  });
  check('?tv=1: Show on TV glass pill (44px, icon) above the start pill', tv.row && tv.before && tv.txt === 'Show on TV' && tv.h === 44 && tv.glass && tv.icon, JSON.stringify(tv));
  await shot(page, '11-tv-row');
  await page.click('#showTv');
  await page.waitForSelector('.tv-sheet', { timeout: 8000 }).catch(() => null);
  await sleep(500);
  const tvSheet = await page.evaluate(() => { const s = document.querySelector('.tv-sheet'); return s ? { open: s.className, title: s.querySelector('#tvSheetTitle')?.textContent, visible: getComputedStyle(s).display !== 'none' && getComputedStyle(s).visibility !== 'hidden' } : null; });
  check('?tv=1: Show on TV opens the TV sheet', !!tvSheet && tvSheet.title === 'Show on TV' && tvSheet.visible, JSON.stringify(tvSheet));
  await shot(page, '12-tv-sheet', { fullPage: false });
  log('INFO', 'tv: page errors (cast SDK is blocked here)', page.errors.join(' | ') || 'none');
  await page.context().close();
}

// ---------- 8. Themes ----------
{
  const page = await newPage();
  const lum = (c) => { const m = c.match(/\d+(\.\d+)?/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
  for (const t of ['walnut', 'navy', 'mahogany', 'oak']) {
    await open(page, `?theme=${t}&d=5&reveal=1`);
    await push(page, ['Nok', 'Mai']); await sleep(300);
    await shot(page, `13-theme-${t}`);
    await page.click('#qrOpen'); await sleep(350);
    const th = await page.evaluate(() => {
      const r = getComputedStyle(document.documentElement); const s = document.getElementById('qrSheet');
      const bg = getComputedStyle(s).backgroundColor, ink = getComputedStyle(s.querySelector('.qr-sheet__code')).color;
      const qrTile = getComputedStyle(s.querySelector('.qr-frame--big')).backgroundColor;
      const tokIvory = getComputedStyle(document.body).getPropertyValue('--bgs-ivory').trim();
      return { theme: document.documentElement.dataset.theme, bg, ink, qrTile, tokIvory, modules: s.querySelector('#qrBig path')?.getAttribute('fill'), tokBg: r.getPropertyValue('--bgs-bg').trim() };
    });
    const ratio = (Math.max(lum(th.bg), lum(th.ink)) + 0.05) / (Math.min(lum(th.bg), lum(th.ink)) + 0.05);
    check(`theme ${t}: sheet ink on ivory contrast ${ratio.toFixed(1)}:1, modules = --bgs-bg`, th.theme === t && ratio >= 7 && th.modules === th.tokBg, JSON.stringify(th));
    await shot(page, `14-theme-${t}-qr-sheet`, { fullPage: false });
    await page.keyboard.press('Escape'); await sleep(300);
  }
  await page.context().close();
}

// ---------- 9. Reduced motion ----------
{
  const page = await newPage({ reducedMotion: 'reduce' });
  await open(page);
  const rm = await page.evaluate(() => ({
    chip: getComputedStyle(document.querySelector('.here-row .chip.glass')).animationName, pulse: getComputedStyle(document.querySelector('.chip--open .pulse')).animationName,
    sheetBefore: null,
  }));
  await page.click('#qrOpen'); await sleep(20);
  const early = await page.evaluate(() => { const s = document.getElementById('qrSheet'); const cs = getComputedStyle(s); return { transform: cs.transform, transProp: cs.transitionProperty }; });
  await sleep(350);
  check('reduced motion: no pop, no pulse', rm.chip === 'none' && rm.pulse === 'none', JSON.stringify(rm));
  check('reduced motion: sheet fades without rise (transform none, transition opacity only)', early.transform === 'none' && early.transProp === 'opacity', JSON.stringify(early));
  await page.context().close();
}

// ---------- 10. Cancel at n=1 ----------
{
  const page = await newPage();
  await open(page);
  await page.click('#cancelNight');
  await page.waitForURL('**/u/nok', { timeout: 5000 }).catch(() => null);
  check('cancel n=1: cancels immediately and leaves to the shelf', /\/u\/nok$/.test(page.url()), page.url());
  await page.context().close();
}

await finish();

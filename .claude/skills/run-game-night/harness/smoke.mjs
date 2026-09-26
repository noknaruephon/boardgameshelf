// One representative run per page: boots it under the stubs, drives one
// interaction, leaves screenshots in ./shots. Usage:
//   node smoke.mjs [host|vote|swipe|results|all] ['?query']
import { launch, newPage, openPage, push, shot, text, has, check, sleep, finish } from './setup.mjs';

const kind = process.argv[2] || 'host';
const query = process.argv[3] || '';
const kinds = kind === 'all' ? ['host', 'vote', 'swipe', 'results'] : [kind];
await launch();

for (const k of kinds) {
  const page = await newPage();
  await openPage(page, k, query);
  await shot(page, `smoke-${k}-1`);
  if (k === 'host') {
    check('host: stage rendered', (await text(page, 'h1')) === "Tonight's deck", await text(page, 'h1'));
    await push(page, ['Nok', 'Mai']);
    await page.waitForSelector('#startBtn.is-ready', { timeout: 3000 });
    check('host: second player makes the table ready', (await text(page, '#startBtn')) === 'Start voting · 2 players');
  } else if (k === 'vote') {
    check('vote: joined screen', (await text(page, 'h1')) === "You're in", await text(page, 'h1'));
    await push(page, ['Nok', 'Mai', 'Ploy']);
    await sleep(200);
    check('vote: roster counts 3', /3 people here/.test(await text(page, '.roster-head')), await text(page, '.roster-head'));
  } else if (k === 'swipe') {
    check('swipe: card stack + vote buttons', await has(page, '#stack .card-body') && await has(page, '#btnPlay'));
    const before = await text(page, '#rollNum');
    await page.click('#btnPlay');
    await page.waitForFunction((b) => document.getElementById('rollNum')?.textContent !== b, before, { timeout: 3000 }).catch(() => null);
    await sleep(300);
    const votes = await page.evaluate(() => window.__votes || []);
    // The exiting card travels 620px off-screen for 340 ms, which widens the
    // document while it runs; it must be back to the viewport once it lands.
    // (Compare with the context viewport, not innerWidth: a full-page
    // screenshot just before can leave innerWidth reporting the stretched size.)
    const vw = page.viewportSize().width;
    await page.waitForFunction((w) => document.documentElement.scrollWidth <= w, vw, { timeout: 2000 }).catch(() => null);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    check('swipe: no horizontal overflow once the card has left', sw <= vw, `scrollWidth=${sw} viewport=${vw}`);
    check('swipe: Play casts one vote and advances', votes.length === 1 && votes[0].vote === 'play' && (await text(page, '#rollNum')) !== before, JSON.stringify({ votes, before, after: await text(page, '#rollNum') }));
  } else if (k === 'results') {
    // The reveal is a multi-second count; the headline lands last.
    const FINAL = /Tonight we play|It's a tie|Nobody's feeling it/;
    await page.waitForFunction((re) => new RegExp(re).test(document.getElementById('headline')?.textContent || ''), FINAL.source, { timeout: 25000 }).catch(() => null);
    await sleep(600);
    check('results: reveal landed on the final headline', FINAL.test(await text(page, '#headline')), await text(page, '#headline'));
    check('results: winner or rematch UI present', (await has(page, '#stage.done')) || (await has(page, '#rematchBtn')) || (await has(page, '#minis.decided')));
  }
  await shot(page, `smoke-${k}-2`);
  check(`${k}: no page errors`, page.errors.length === 0, page.errors.join(' | '));
  await page.context().close();
}
await finish();

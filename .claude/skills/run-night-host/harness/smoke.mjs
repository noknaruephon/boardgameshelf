// One representative run: the stage lobby waiting, then a second phone joins.
// Proves the page boots end to end and leaves two screenshots to look at.
import { launch, newPage, open, push, shot, text, check, finish } from './setup.mjs';

await launch();
const page = await newPage();
await open(page, process.argv[2] || '');
check('stage rendered', (await text(page, 'h1')) === "Tonight's deck", await text(page, 'h1'));
await shot(page, 'smoke-waiting');
await push(page, ['Nok', 'Mai']);
await page.waitForSelector('#startBtn.is-ready', { timeout: 3000 });
check('second player makes the table ready', (await text(page, '#startBtn')) === 'Start voting · 2 players');
await shot(page, 'smoke-ready');
check('no page errors', page.errors.length === 0, page.errors.join(' | '));
await finish();

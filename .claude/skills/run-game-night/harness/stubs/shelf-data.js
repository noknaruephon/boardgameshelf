// Stub of js/shelf-data.js: generated SVG covers; ?broken=1 gives game 2 a 404 image.
const q = new URLSearchParams(location.search);
const hues = [14, 42, 120, 200, 260, 330, 80, 180, 300, 30, 220, 0];
const TITLES = ['Azul', 'Wingspan', 'Cascadia', 'Splendor', 'Catan', 'Root', 'Everdell', 'Dune', 'Ark Nova', 'Brass', 'Scythe', 'Spirit Island'];
function cover(i, title) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='420'><rect width='300' height='420' fill='hsl(${hues[i % 12]} 45% 38%)'/><text x='150' y='220' font-family='sans-serif' font-size='34' fill='white' text-anchor='middle'>${title}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
export async function fetchGamesForSession(session) {
  return session.game_ids.map((id, i) => {
    const title = TITLES[i % 12];
    const image = (q.get('broken') === '1' && i === 1) ? `${location.origin}/nope-${i}.jpg` : cover(i, title);
    return { bggId: id, title, players: [2, 4], time: [30, 60], weight: 'medium', weightScore: 2.4,
      bggRating: 7.6, image, imageLarge: image, imageSmall: image, imageMid: image,
      blurb: 'A test blurb.', why: '', tag: 'Strategy', vibes: [] };
  });
}
export async function shelfHrefForSession() { return '/u/nok'; }
export function backLabelForSession() { return 'Back to the shelf'; }

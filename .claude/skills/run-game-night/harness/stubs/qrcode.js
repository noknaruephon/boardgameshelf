// Stub of esm.sh/qrcode: a deterministic 25x25 module grid so frames have something to scale.
function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
export default {
  async toString(text, opts = {}) {
    window.__qrCalls = (window.__qrCalls || 0) + 1;
    const dark = (opts.color && opts.color.dark) || '#000';
    const N = 25; let h = hash(text); const rects = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      h = (Math.imul(h, 1103515245) + 12345) >>> 0;
      const finder = (x < 7 && y < 7) || (x >= N - 7 && y < 7) || (x < 7 && y >= N - 7);
      const on = finder ? !((x % 6 === 1 || x % 6 === 5 || y % 6 === 1 || y % 6 === 5) && !(x % 6 >= 2 && x % 6 <= 4 && y % 6 >= 2 && y % 6 <= 4)) : (h & 0x8000) !== 0;
      if (on) rects.push(`M${x} ${y}h1v1h-1z`);
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges"><path fill="${dark}" d="${rects.join('')}"/></svg>`;
  },
};

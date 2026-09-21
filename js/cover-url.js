// The one definition of a sized cover URL.
//
// Its own module, and deliberately import-free. js/shelf-data.js creates a
// Supabase client at module scope, so importing it costs a cross-origin fetch
// of supabase-js from esm.sh before any of it runs. The landing hero only
// needs to build an image URL, and it needs to do it above the fold, so it
// imports this instead. js/shelf-data.js re-exports sizedCover, so every
// existing importer is unchanged.

// /_vercel/image resizes and re-encodes a BGG cover on the edge. Widths must
// be ones listed in vercel.json. Anything that is not a BGG URL (a local
// /covers/ file, an empty string) is returned as is.
export function sizedCover(url, width) {
  if (!/^https:\/\/cf\.geekdo-images\.com\//.test(url)) return url;
  return `/_vercel/image?url=${encodeURIComponent(url)}&w=${width}&q=75`;
}

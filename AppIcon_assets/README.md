# BoardgameShelf app icon

Direction 1c (monogram) with the shelf-spine motif, no frame. Palette is taken from `index.html` `:root`:

| Token | Hex |
| --- | --- |
| Ink background | `#160F0A` |
| Radial top | `#241708` |
| Plate | `#241A10` |
| Brass | `#E3B04B` |
| Ivory | `#F4EBDA` |

Type: Fraunces 600 (already loaded by the site) for the `B`.

## Files

- `icon.svg` — vector master, 1024×1024, rounded corners (radius 229 = 22.37%). Loads Fraunces from Google Fonts; convert the `B` to outlines before shipping to any surface that won't fetch webfonts.
- `icon-1024.png` … `icon-32.png` — rounded-corner rasters (1024, 512, 256, 192, 180, 120, 64, 32).
- `icon-1024-square.png` — full-bleed square, no corner rounding. Use for Android adaptive / maskable icons and anywhere the platform applies its own mask.

## Suggested wiring

```html
<link rel="icon" href="/assets/icon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/assets/icon-180.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#160F0A">
```

```json
{
  "name": "BoardgameShelf",
  "short_name": "Shelf",
  "icons": [
    { "src": "/assets/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/assets/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/assets/icon-1024-square.png", "sizes": "1024x1024", "type": "image/png", "purpose": "maskable" }
  ],
  "background_color": "#160F0A",
  "theme_color": "#160F0A",
  "display": "standalone"
}
```

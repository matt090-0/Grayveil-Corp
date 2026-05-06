# Hero ship images for the landing page

Files expected here (referenced by Landing.jsx → `HERO_SHIPS`):

| Filename         | Ship       |
| ---------------- | ---------- |
| javelin.webp     | Javelin    |
| idris.webp       | Idris-M    |
| polaris.webp     | Polaris    |
| kraken.webp      | Kraken     |
| carrack.webp     | Carrack    |
| hammerhead.webp  | Hammerhead |

If a file is missing, the corresponding card on /welcome falls back to a
tan/black gradient panel — no broken-image icon. Drop a replacement and
redeploy; cards pick up the new image immediately.

## Specs

- **Aspect ratio**: 16 : 9 (cropped via `object-fit: cover`)
- **Resolution**: ≥ 1200 px wide
- **Format**: WebP (50–70 % smaller than JPG at equivalent quality)
- **Target file size**: < 200 KB each

## Attribution

Images currently sourced from the [Star Citizen Wiki](https://starcitizen.tools)
(community wiki, image content © Cloud Imperium Games / Roberts Space
Industries — non-commercial fan use). Replace with original screenshots
or in-game captures if you'd rather avoid the gray area.

# YueDaily icon assets

How each file under `assets/` is used in Expo / EAS builds. Keep roles separate — do not reuse one PNG for every slot.

## Config mapping (`app.json`)

| Asset | Config field |
| --- | --- |
| `./assets/icon.png` | `expo.icon` |
| `./assets/android-icon-foreground.png` | `expo.android.adaptiveIcon.foregroundImage` |
| `./assets/splash-icon.png` | `expo-splash-screen` plugin `image` |
| `./assets/favicon.png` | `expo.web.favicon` |

Android adaptive background (solid color, not an image):

- `expo.android.adaptiveIcon.backgroundColor` → `#0B1F68` (moonlit navy; visibly blue on device, not near-black)
- Splash uses the same `#0B1F68` so launch and launcher feel consistent

## Asset roles

### `icon.png`

Complete **square** app icon **with** opaque background (navy or matching brand fill). Used as the general / iOS-style icon.

- Emblem visible area: about **58%–62%** of the canvas
- Include the full composed look (background + emblem)

### `android-icon-foreground.png`

**Transparent foreground only** for Android adaptive icons. No solid navy (or any) full-bleed square inside this file — the launcher paints `backgroundColor` behind it.

- Emblem visible area: about **47%–51%** of the canvas (smaller so it survives circle / squircle masks)
- Truly transparent pixels outside the emblem
- No pre-rounded corners (the OS masks the icon)

### `splash-icon.png`

Transparent, centered splash logo shown on the splash `backgroundColor`.

- Emblem visible area: about **38%–45%** of the canvas
- Keep padding generous; splash image is scaled with `resizeMode: "contain"`

### `favicon.png`

Simplified square web favicon (can be bolder / closer crop than the store icon).

- Emblem visible area: about **68%–74%** of the canvas
- Prefer a simplified mark if detail is lost at small sizes

## Why Android can look “off-center”

Even when a PNG looks geometrically centered in an editor, **Android adaptive icons** can still read as top-heavy, bottom-heavy, or slightly warped after install:

- Launchers **mask** the adaptive layer (circle, squircle, rounded rect). Cropping changes perceived balance.
- Users judge **optical balance**, not geometric center. Extra sparkles above, a sakura hanging below, or a thicker moon on one side shift the visual mass.
- Scaling + mask safe-zone (roughly the inner ~66% of the foreground) can make an emblem that filled the full canvas look crushed or uneven.

So: center for the eye after imagining a circular crop, not only for the bounding box.

## Practical rules (adaptive foreground)

1. Foreground must have a **truly transparent** background (real PNG alpha — not JPEG renamed to `.png`).
2. **No** full navy (or any solid) square baked into the foreground.
3. **No** pre-rounded corners.
4. Avoid hanging elements that pull visual weight **downward** (large flower / charm below the mark).
5. Avoid sparkles placed **too far above** the emblem.
6. Keep the emblem **compact and balanced as one unit** inside the safe zone (~47%–51% canvas).
7. After changing adaptive icon assets, **uninstall** the old app on device and rebuild with a clear cache:

```bash
eas build --platform android --profile apk --clear-cache
```

Launcher icon caches are sticky; a clean install after a fresh build is required to verify optics.

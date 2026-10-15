# Expense Tracker — Design Assets Starter Pack

This pack is a starter asset system for the React Native + TypeScript + Expo expense tracker. It intentionally uses vector icons from an open-source icon library instead of exporting every tiny icon as a PNG.

## Recommended approach

- Use `lucide-react-native` for interface icons. It provides consistent, scalable outline icons and avoids maintaining dozens of image files.
- Use native text + icon components for merchant rows where no official logo is needed.
- Add merchant/bank logos only when they materially improve recognition. Prefer user-provided or official brand assets and review each brand's usage terms. Do not rely on AI-generated logos for production.
- Keep illustrations and logos separate from UI icons in `assets/`.
- Use the included `iconMap.tsx` as the canonical mapping so the same icon names are reused across screens.

## Install

```bash
npx expo install lucide-react-native react-native-svg
```

Then copy `src/theme` and `assets/icons` into the app project or adapt the paths to your structure.

## Example

```tsx
import { AppIcon } from './src/theme/AppIcon';

<AppIcon name="search" size={22} color="#5B45E7" />
```

## Notes

- Icons are vector components rendered at runtime; they do not need individual PNG/SVG files.
- The screen mockups contain illustrative merchant logos and sample transactions. Replace those with real, licensed assets or generic icons before release.
- This pack contains an icon inventory and theme primitives, not copies of proprietary merchant logos or the full generated screen mockups.

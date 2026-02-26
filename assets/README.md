# Assets Directory

Place your app icons here for electron-builder.

## Required Icons

### macOS
- `icon.icns` - macOS app icon (512x512 or 1024x1024)

### Windows  
- `icon.ico` - Windows app icon (256x256)

### Linux
Place PNG icons in the `icons/` subdirectory:
- `icons/16x16.png`
- `icons/32x32.png`
- `icons/48x48.png`
- `icons/64x64.png`
- `icons/128x128.png`
- `icons/256x256.png`
- `icons/512x512.png`

## Generating Icons

You can use tools like:
- [electron-icon-maker](https://www.npmjs.com/package/electron-icon-maker)
- [icon-gen](https://www.npmjs.com/package/icon-gen)

Example with electron-icon-maker:
```bash
npx electron-icon-maker --input=./icon.png --output=./assets
```

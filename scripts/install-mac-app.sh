#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$HOME/Applications/OND.app"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"

chmod +x "$SCRIPT_DIR/launch-app.sh"

mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"

cat > "$CONTENTS_DIR/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>OND</string>
  <key>CFBundleDisplayName</key>
  <string>OND</string>
  <key>CFBundleIdentifier</key>
  <string>com.ond.workspace</string>
  <key>CFBundleVersion</key>
  <string>1.0.0</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
  <key>CFBundleExecutable</key>
  <string>OND</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>LSUIElement</key>
  <false/>
</dict>
</plist>
PLIST

cat > "$MACOS_DIR/OND" << LAUNCHER
#!/usr/bin/env bash
exec "$PROJECT_DIR/scripts/launch-app.sh"
LAUNCHER
chmod +x "$MACOS_DIR/OND"

# Build native .icns from public/app-icon.ico using macOS built-in sips + iconutil if available
if command -v sips >/dev/null 2>&1 && command -v iconutil >/dev/null 2>&1 && [ -f "$PROJECT_DIR/public/app-icon.ico" ]; then
  TMP_ICONSET="$(mktemp -d)/AppIcon.iconset"
  mkdir -p "$TMP_ICONSET"
  if sips -s format png "$PROJECT_DIR/public/app-icon.ico" --out "$TMP_ICONSET/icon_256x256.png" >/dev/null 2>&1; then
    sips -z 16 16     "$TMP_ICONSET/icon_256x256.png" --out "$TMP_ICONSET/icon_16x16.png"     >/dev/null 2>&1 || true
    sips -z 32 32     "$TMP_ICONSET/icon_256x256.png" --out "$TMP_ICONSET/icon_16x16@2x.png"  >/dev/null 2>&1 || true
    sips -z 32 32     "$TMP_ICONSET/icon_256x256.png" --out "$TMP_ICONSET/icon_32x32.png"     >/dev/null 2>&1 || true
    sips -z 64 64     "$TMP_ICONSET/icon_256x256.png" --out "$TMP_ICONSET/icon_32x32@2x.png"  >/dev/null 2>&1 || true
    sips -z 128 128   "$TMP_ICONSET/icon_256x256.png" --out "$TMP_ICONSET/icon_128x128.png"   >/dev/null 2>&1 || true
    sips -z 256 256   "$TMP_ICONSET/icon_256x256.png" --out "$TMP_ICONSET/icon_128x128@2x.png" >/dev/null 2>&1 || true
    iconutil -c icns "$TMP_ICONSET" -o "$RESOURCES_DIR/AppIcon.icns" >/dev/null 2>&1 || true
  fi
  rm -rf "$(dirname "$TMP_ICONSET")"
fi

echo "Installed macOS desktop app:"
echo "  $APP_DIR"
echo "Open via Spotlight ('OND'), ~/Applications/OND.app, or drag it onto your Dock."

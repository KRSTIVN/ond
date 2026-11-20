import type { WallpaperPreset } from './types';

export const CUSTOM_UPLOAD_WALLPAPER_ID = 'custom-upload';
export const CUSTOM_URL_WALLPAPER_ID = 'custom-url';

export const WALLPAPER_PRESETS: readonly WallpaperPreset[] = [
  {
    id: 'coastal-twilight',
    name: 'Coastal Twilight',
    tag: 'Scenic',
    kind: 'image',
    src: '/wallpapers/coastal-twilight.jpg',
  },
  {
    id: 'misty-rainforest',
    name: 'Misty Rainforest',
    tag: 'Nature',
    kind: 'image',
    src: '/wallpapers/misty-rainforest.jpg',
  },
  {
    id: 'obsidian-glass',
    name: 'Obsidian Smoked Glass',
    tag: 'Dark Glass',
    kind: 'image',
    src: '/wallpapers/obsidian-glass.jpg',
  },
  {
    id: 'midnight-ocean',
    name: 'Midnight Ocean',
    tag: 'Minimal',
    kind: 'gradient',
    css: 'radial-gradient(120% 90% at 15% 10%, #114b5f 0%, rgba(17, 75, 95, 0) 55%), radial-gradient(90% 80% at 88% 15%, #2b1e5a 0%, rgba(43, 30, 90, 0) 60%), radial-gradient(80% 70% at 50% 95%, #0c3547 0%, rgba(12, 53, 71, 0) 65%), linear-gradient(155deg, #060b14 0%, #0b1322 50%, #080e18 100%)',
  },
  {
    id: 'amber-dusk',
    name: 'Amber Dusk',
    tag: 'Minimal',
    kind: 'gradient',
    css: 'radial-gradient(100% 80% at 18% 18%, rgba(217, 119, 6, 0.34) 0%, rgba(217, 119, 6, 0) 55%), radial-gradient(95% 85% at 85% 22%, rgba(126, 34, 206, 0.36) 0%, rgba(126, 34, 206, 0) 60%), radial-gradient(85% 75% at 50% 90%, rgba(190, 24, 93, 0.25) 0%, rgba(190, 24, 93, 0) 60%), linear-gradient(160deg, #100c14 0%, #17111f 55%, #0b0910 100%)',
  },
  {
    id: 'studio-carbon',
    name: 'Studio Carbon',
    tag: 'Dark Glass',
    kind: 'gradient',
    css: 'radial-gradient(75% 65% at 50% 0%, rgba(99, 102, 241, 0.16) 0%, rgba(99, 102, 241, 0) 70%), linear-gradient(180deg, #0c0f16 0%, #090b10 55%, #07090d 100%)',
  },
];

const LEGACY_WALLPAPER_MAP: Record<string, string> = {
  'old-san-juan': 'coastal-twilight',
  'el-yunque': 'misty-rainforest',
  'caribbean-midnight': 'midnight-ocean',
  'condado-dusk': 'amber-dusk',
};

export function normalizeWallpaperId(id: string): string {
  return LEGACY_WALLPAPER_MAP[id] ?? id;
}

export function findWallpaperPreset(id: string): WallpaperPreset | undefined {
  const normalized = normalizeWallpaperId(id);
  return WALLPAPER_PRESETS.find((preset) => preset.id === normalized);
}

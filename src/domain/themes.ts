import type { UiThemeId, UiThemePreset } from './types';

export const UI_THEME_PRESETS: readonly UiThemePreset[] = [
  {
    id: 'liquid-glass',
    name: 'Liquid Glass',
    tag: 'Signature',
    description:
      'Glossy smoked obsidian capsule buttons with curved specular highlights and prismatic cyan/violet caustic glow.',
    previewGradient:
      'linear-gradient(135deg, rgba(14,18,32,0.95) 0%, rgba(56,189,248,0.45) 52%, rgba(168,85,247,0.52) 100%)',
    accentBorder: 'rgba(125, 211, 252, 0.72)',
  },
  {
    id: 'vision-spatial',
    name: 'VisionOS Spatial',
    tag: 'Floating Dock',
    description:
      'Detached floating glass window frame, left vertical spatial dock pill, platinum frost, and crisp white action pills.',
    previewGradient:
      'linear-gradient(135deg, rgba(168,176,192,0.55) 0%, rgba(92,98,112,0.48) 55%, rgba(255,255,255,0.42) 100%)',
    accentBorder: 'rgba(255, 255, 255, 0.65)',
  },
  {
    id: 'aurora-prism',
    name: 'Aurora Prism',
    tag: 'Chromatic',
    description:
      'Warm sunset-magenta, emerald, and electric-cyan refractive liquid glass pills with iridescent ambient caustics.',
    previewGradient:
      'linear-gradient(135deg, rgba(244,63,94,0.58) 0%, rgba(251,146,60,0.52) 48%, rgba(45,212,191,0.58) 100%)',
    accentBorder: 'rgba(251, 146, 60, 0.72)',
  },
  {
    id: 'obsidian-minimal',
    name: 'Obsidian Classic',
    tag: 'Minimal',
    description:
      'Ultra-clean matte dark glass with sharp indigo accents and minimal visual chrome.',
    previewGradient:
      'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,41,59,0.88) 60%, rgba(99,102,241,0.48) 100%)',
    accentBorder: 'rgba(129, 140, 248, 0.6)',
  },
];

export function findUiThemePreset(id: UiThemeId): UiThemePreset {
  return UI_THEME_PRESETS.find((t) => t.id === id) ?? UI_THEME_PRESETS[0]!;
}

/** Built-in cartoon faces for players who don't want to use a photo (and for the CPU). */
export const FACE_PACK = ['😺', '🤖', '💀', '😎', '🤡', '👽', '🐸', '🥸'] as const;

export const CPU_FACE = '🤖';

/**
 * Draws an emoji onto a transparent canvas. Emoji glyphs come from the
 * device's own font, so they look native on every platform.
 */
export function renderEmojiCanvas(emoji: string, size = 192): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(size * 0.82)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.fillText(emoji, size / 2, size / 2 + size * 0.04);
  }
  return canvas;
}

export function renderEmojiFace(emoji: string, size = 192): string {
  return renderEmojiCanvas(emoji, size).toDataURL('image/png');
}

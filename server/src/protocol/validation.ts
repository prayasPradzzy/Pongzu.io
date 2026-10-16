// Everything a client sends is untrusted. These helpers coerce payloads into
// safe values (or null) so handlers never throw on malformed input.

const MAX_NAME_LENGTH = 20;
const MAX_AVATAR_LENGTH = 200_000; // ~150 KB of image data once base64-decoded
const AVATAR_PATTERN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const ROOM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{4}$/;

export function asRecord(payload: unknown): Record<string, unknown> {
  return typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {};
}

export function sanitizeName(value: unknown): string {
  if (typeof value !== 'string') return 'Player';
  // Drop control characters, collapse whitespace.
  const cleaned = Array.from(value)
    .filter((ch) => ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) !== 127)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, MAX_NAME_LENGTH) || 'Player';
}

export function sanitizeAvatar(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (value.length > MAX_AVATAR_LENGTH) return null;
  return AVATAR_PATTERN.test(value) ? value : null;
}

export function sanitizeRoomCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return ROOM_CODE_PATTERN.test(code) ? code : null;
}

export function sanitizeDirection(value: unknown): -1 | 0 | 1 | null {
  return value === -1 || value === 0 || value === 1 ? value : null;
}

export function sanitizeTargetX(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(2000, value));
}

export function sanitizeSeq(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function sanitizeToken(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= 64 ? value : null;
}

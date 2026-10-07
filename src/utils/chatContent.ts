/**
 * Portable chat-content helpers.
 *
 * The current conversation API stores a single text field, so stickers travel
 * as a small, versioned text token.  That keeps them compatible with the
 * existing REST and WebSocket transports while letting native clients render a
 * proper sticker card instead of exposing an implementation detail.
 */

export type ChatSticker = {
  id: string;
  emoji: string;
  label: string;
  accent: string;
  surface: string;
};

export const CHAT_STICKERS: readonly ChatSticker[] = [
  {
    id: 'love',
    emoji: '💖',
    label: 'Love you',
    accent: '#BE123C',
    surface: '#FFE4EC',
  },
  {
    id: 'kiss',
    emoji: '😘',
    label: 'A kiss',
    accent: '#C2410C',
    surface: '#FFF0E8',
  },
  {
    id: 'hug',
    emoji: '🤗',
    label: 'Big hug',
    accent: '#7C3AED',
    surface: '#F3E8FF',
  },
  {
    id: 'miss-you',
    emoji: '🥺',
    label: 'Miss you',
    accent: '#0369A1',
    surface: '#E0F2FE',
  },
  {
    id: 'rose',
    emoji: '🌹',
    label: 'For you',
    accent: '#BE123C',
    surface: '#FFF1F2',
  },
  {
    id: 'celebrate',
    emoji: '🎉',
    label: 'Celebrate',
    accent: '#7E22CE',
    surface: '#FAE8FF',
  },
  {
    id: 'good-morning',
    emoji: '☀️',
    label: 'Good morning',
    accent: '#B45309',
    surface: '#FEF3C7',
  },
  {
    id: 'coffee',
    emoji: '☕',
    label: 'Coffee date?',
    accent: '#92400E',
    surface: '#FEF3C7',
  },
  {
    id: 'thinking',
    emoji: '🤔',
    label: 'Thinking of you',
    accent: '#1D4ED8',
    surface: '#DBEAFE',
  },
  {
    id: 'blush',
    emoji: '🥰',
    label: 'So sweet',
    accent: '#DB2777',
    surface: '#FCE7F3',
  },
  {
    id: 'apology',
    emoji: '🙏',
    label: 'Sorry',
    accent: '#047857',
    surface: '#D1FAE5',
  },
  {
    id: 'wow',
    emoji: '🤩',
    label: 'Amazing!',
    accent: '#B45309',
    surface: '#FEF3C7',
  },
  {
    id: 'dance',
    emoji: '💃',
    label: 'Let’s celebrate',
    accent: '#9D174D',
    surface: '#FCE7F3',
  },
  {
    id: 'lucky',
    emoji: '🍀',
    label: 'Good luck',
    accent: '#15803D',
    surface: '#DCFCE7',
  },
  {
    id: 'yes',
    emoji: '✅',
    label: 'Yes!',
    accent: '#047857',
    surface: '#D1FAE5',
  },
  {
    id: 'heart-eyes',
    emoji: '😍',
    label: 'Heart eyes',
    accent: '#DC2626',
    surface: '#FEE2E2',
  },
];

/** A deliberately distinctive and validated payload prefix, not shown in UI. */
const STICKER_PREFIX = '[[mdp-sticker:';
const STICKER_SUFFIX = ']]';

const stickersById = new Map(
  CHAT_STICKERS.map(sticker => [sticker.id, sticker]),
);

/** Serialize a known sticker for the existing text-only message transport. */
export function serializeStickerMessage(stickerId: string): string | undefined {
  return stickersById.has(stickerId)
    ? `${STICKER_PREFIX}${stickerId}${STICKER_SUFFIX}`
    : undefined;
}

/** Returns the sticker only for an exact, known sticker payload. */
export function parseStickerMessage(
  text?: string | null,
): ChatSticker | undefined {
  if (!text) return undefined;

  const normalized = text.trim();
  if (
    !normalized.startsWith(STICKER_PREFIX) ||
    !normalized.endsWith(STICKER_SUFFIX)
  ) {
    return undefined;
  }

  const id = normalized.slice(STICKER_PREFIX.length, -STICKER_SUFFIX.length);
  return stickersById.get(id);
}

/**
 * Human-friendly text for chat rows and notifications.  This must be used
 * outside the bubble renderer so a transport token never leaks into a preview.
 */
export function getChatContentPreview(text?: string | null): string {
  const sticker = parseStickerMessage(text);
  if (sticker) return `${sticker.emoji} ${sticker.label} sticker`;
  return text?.trim() ?? '';
}

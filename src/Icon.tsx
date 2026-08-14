// 汀's icons — the prototype's 24px stroke set (design-ui/ting/app/icons.js),
// same paths, same 1.8px round stroke, as a React component. Icons are part of
// the visual contract; text glyphs (···, ☺) read as placeholders next to them.
const PATHS: Record<string, string> = {
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M19.1 4.9l-1.6 1.6M6.5 17.5l-1.6 1.6"/>',
  moon: '<path d="M20.2 13.2A8.2 8.2 0 0 1 10.8 3.8 8.2 8.2 0 1 0 20.2 13.2Z"/>',
  chat: '<path d="M21 12.3c0 4.4-4 7.7-9 7.7-1 0-2-.1-2.9-.4L4 21l1.2-3.6C3.8 16 3 14.3 3 12.3 3 8 7 4.7 12 4.7s9 3.2 9 7.6Z"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14s1.2 1.8 3.5 1.8S15.5 14 15.5 14M9.2 9.6h.01M14.8 9.6h.01"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  minus: '<path d="M5 12h14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.4 2"/>',
  eye: '<path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>',
  undo: '<path d="M8.5 5.5 4 10l4.5 4.5"/><path d="M4 10h9.5a6 6 0 0 1 0 12H11"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7M12 14.7v2.3"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7M20 3.5v3.8h-3.8"/>',
  alert: '<path d="M12 3.5 2.5 19.5h19Z"/><path d="M12 9.5v4.5M12 17h.01"/>',
  key: '<circle cx="8" cy="15.5" r="4.5"/><path d="m11.3 12.3 8.2-8.2M17 6.5l2.5 2.5M14 9.5l2.5 2.5"/>',
  dots: '<circle cx="5.5" cy="12" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="18.5" cy="12" r="1.1"/>',
  zap: '<path d="M13 3 5 13.5h5.5L11 21l8-10.5h-5.5Z"/>',
  'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
  'chevron-up': '<path d="m6 14.5 6-6 6 6"/>',
  send: '<path d="M20.5 3.5 10 14M20.5 3.5 14 20.5l-4-6.5-7-3Z"/>',
  star: '<path d="m12 3.5 2.5 5.4 5.9.7-4.4 4 1.2 5.8L12 16.5l-5.2 2.9 1.2-5.8-4.4-4 5.9-.7Z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="16" rx="3"/><path d="M8 3v4M16 3v4M3.5 10.5h17"/>',
};

export type IconName = keyof typeof PATHS;

export function Icon({ n, size = 15 }: { n: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: PATHS[n] ?? '' }}
    />
  );
}

export interface PlatformInfo {
  platform: string; // e.g. ios, ios-pwa, android, mac, windows, web
  userAgent: string;
  localHour: number; // 0-23, for time-of-day analysis
  timezone: string; // IANA tz, e.g. America/New_York
}

/** Best-effort device/context snapshot, captured once per session. */
export function platformInfo(): PlatformInfo {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const nav = navigator as Navigator & { standalone?: boolean };
  const standalone =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true);

  let platform = 'web';
  if (/iPhone|iPad|iPod/i.test(ua)) platform = 'ios';
  else if (/Android/i.test(ua)) platform = 'android';
  else if (/Macintosh|Mac OS/i.test(ua)) platform = 'mac';
  else if (/Windows/i.test(ua)) platform = 'windows';
  if (standalone) platform += '-pwa';

  const now = new Date();
  let timezone = '';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    timezone = '';
  }

  return { platform, userAgent: ua.slice(0, 300), localHour: now.getHours(), timezone };
}

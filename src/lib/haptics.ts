import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * Thin haptics wrapper. On iOS these fire the Taptic Engine; on the web the
 * plugin falls back to the Vibration API (a no-op on desktop / iOS Safari).
 * Every call is guarded so a missing/again-unsupported API never throws into
 * the game loop.
 */

export function tapKey(): void {
  try {
    void Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    /* haptics unavailable — ignore */
  }
}

export function tapAction(): void {
  try {
    void Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    /* ignore */
  }
}

/** A satisfying confirm when a problem is solved and auto-advances. */
export function tapSolved(): void {
  try {
    void Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    /* ignore */
  }
}

/** Celebratory pattern when a new personal best lands. */
export function celebrate(): void {
  try {
    void Haptics.notification({ type: NotificationType.Success });
  } catch {
    /* ignore */
  }
}

import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

/**
 * Native-shell setup, run once at startup. No-ops on the web build so the same
 * bundle works as a PWA. Themes the status bar for our dark canvas and hides
 * the launch splash as soon as React has mounted.
 */
export async function initNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // Style.Dark = dark background → light status-bar text/icons.
    await StatusBar.setStyle({ style: Style.Dark });
    // Android-only; harmless on iOS.
    await StatusBar.setBackgroundColor({ color: '#080A09' });
  } catch {
    /* status bar plugin unavailable — ignore */
  }

  try {
    await SplashScreen.hide();
  } catch {
    /* splash plugin unavailable — ignore */
  }
}

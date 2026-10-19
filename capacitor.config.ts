import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.quickmaffs.app',
  appName: 'QuickMaffs',
  webDir: 'dist',
  server: {
    iosScheme: 'quickmaffs',
  },
  plugins: {
    SplashScreen: {
      // A brief branded splash; initNative() hides it as soon as React mounts,
      // with this as the auto-hide fallback if JS is slow to boot.
      launchShowDuration: 800,
      launchAutoHide: true,
      backgroundColor: '#080A09',
      showSpinner: false,
      iosSpinnerStyle: 'small',
    },
  },
};

export default config;

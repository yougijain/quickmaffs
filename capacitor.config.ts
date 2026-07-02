import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.quickmaffs.app',
  appName: 'QuickMaffs',
  webDir: 'dist',
  server: {
    iosScheme: 'quickmaffs',
  },
};

export default config;

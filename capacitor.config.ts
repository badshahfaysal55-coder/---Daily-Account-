import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zara.accounting',
  appName: 'ZF Accounting',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: [
      'ais-pre-otwyikgrhfjkomxcdz7g2q-73319294110.europe-west2.run.app',
      'ais-dev-otwyikgrhfjkomxcdz7g2q-73319294110.europe-west2.run.app',
      '*.firebaseapp.com',
      '*.googleapis.com',
    ],
  },
  android: {
    backgroundColor: '#101A2C',
    allowMixedContent: false,
  },
  ios: {
    backgroundColor: '#101A2C',
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
  },
};

export default config;

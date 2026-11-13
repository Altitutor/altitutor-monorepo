import type { ExpoConfig } from 'expo/config';

const projectId = process.env.EXPO_PUBLIC_TUTOR_EAS_PROJECT_ID;
const googleServicesFile = process.env.TUTOR_GOOGLE_SERVICES_FILE;

const config: ExpoConfig = {
  name: 'Altitutor Tutor',
  slug: 'tutor-app',
  owner: 'altitutor',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'altitutor-tutor',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'com.altitutor.tutor',
    supportsTablet: true,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: 'com.altitutor.tutor',
    googleServicesFile: googleServicesFile || undefined,
    adaptiveIcon: {
      backgroundColor: '#FFFFFF',
      foregroundImage: './assets/images/android-icon-foreground.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
  },
  web: { output: 'single' },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-web-browser',
    ['expo-notifications', { color: '#0A2941', defaultChannel: 'tutor-updates' }],
    ['expo-splash-screen', { backgroundColor: '#FFFFFF', image: './assets/images/icon.png', imageWidth: 128 }],
    'expo-video',
    'expo-image',
  ],
  experiments: { typedRoutes: true, autolinkingModuleResolution: true },
  extra: projectId ? { eas: { projectId } } : {},
};

export default config;

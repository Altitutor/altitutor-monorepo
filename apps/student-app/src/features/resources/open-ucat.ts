import { Linking } from 'react-native';

const UCAT_APP_URL = 'altitutor-ucat://';
const UCAT_WEB_URL = 'https://ucat.altitutor.com/login?redirect=%2Fsessions';

export function isUcatSubject(subject: { name?: string | null; short_name?: string | null; long_name?: string | null }) {
  return [subject.short_name, subject.name, subject.long_name].some((value) => value?.trim().toLowerCase() === 'ucat');
}

export async function openUcatResources() {
  const installed = await Linking.canOpenURL(UCAT_APP_URL).catch(() => false);
  if (installed) {
    await Linking.openURL(UCAT_APP_URL);
    return;
  }
  await Linking.openURL(UCAT_WEB_URL);
}

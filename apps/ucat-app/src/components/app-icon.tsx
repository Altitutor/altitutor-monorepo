import { Image } from "expo-image";
import { Platform } from "react-native";
const icons = {
  book: [
    "book",
    '<path d="M12 5v16M12 5C8 2 4 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-2-1-6-2-10 1Z"/>',
  ],
  brain: [
    "brain.head.profile",
    '<path d="M9 20v-4C1 13 4 3 12 3c7 0 8 5 8 8l2 3h-4v6Z M9 7l5 3-5 3"/>',
  ],
  pencil: ["pencil", '<path d="m3 17 12-12 4 4L7 21H3v-4ZM14 6l4 4"/>'],
  stack: [
    "square.stack",
    '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M5 4h14M7 1h10"/>',
  ],
  timer: [
    "timer",
    '<circle cx="12" cy="14" r="8"/><path d="M12 14V9M9 2h6M12 2v4"/>',
  ],
  settings: [
    "gearshape",
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
  ],
  person: [
    "person.crop.circle",
    '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="9" r="3"/><path d="M5 19c0-7 14-7 14 0"/>',
  ],
  calendar: [
    "calendar",
    '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M7 2v5M17 2v5M7 14h3M14 14h3M7 18h3"/>',
  ],
  plan: [
    "creditcard",
    '<rect x="2" y="4" width="20" height="16" rx="3"/><path d="M2 9h20M6 15h5"/>',
  ],
  numbers: ["number", '<path d="M9 2 7 22M17 2l-2 20M3 8h18M2 16h18"/>'],
  people: [
    "person.2",
    '<circle cx="9" cy="8" r="3"/><path d="M2 21v-4c0-6 14-6 14 0v4M16 5c5 0 5 6 0 6M19 14c3 1 3 4 3 7"/>',
  ],
  flag: ["flag", '<path d="M5 22V3c5-5 9 5 15 0v11c-6 5-10-5-15 0"/>'],
} as const;
export type IconName = keyof typeof icons;
export function AppIcon({
  name,
  color,
  size = 25,
}: {
  name: IconName;
  color: string;
  size?: number;
}) {
  const [symbol, path] = icons[name];
  return (
    <Image
      accessibilityIgnoresInvertColors
      source={
        Platform.OS === "ios"
          ? `sf:${symbol}`
          : {
              uri: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`)}`,
            }
      }
      tintColor={color}
      style={{ width: size, height: size }}
    />
  );
}

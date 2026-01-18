import { ImageData } from '../types';

// All images are stored locally in public/images/landing/
const BASE_PATH = '/images/landing';

export const images: Record<string, ImageData> = {
  heroBackground: {
    src: `${BASE_PATH}/background-alt-scaled.jpg`,
    alt: 'Hero background',
    width: 1920,
    height: 1080,
    priority: true,
  },
  heroLogo: {
    src: `${BASE_PATH}/Altitutor-banner_white_v2-copy-1024x139.png`,
    alt: 'Altitutor Logo',
    width: 640,
    height: 87,
    priority: true,
  },
  macIcon: {
    src: `${BASE_PATH}/256-mac.webp`,
    alt: 'Mac Icon',
    width: 256,
    height: 256,
  },
  featuresImage: {
    src: `${BASE_PATH}/MBA-1-smaller.png`,
    alt: 'Student learning resources',
    width: 640,
    height: 633,
  },
  studyNotesScreenshot: {
    src: `${BASE_PATH}/study-notes-screenshot.png`,
    alt: 'Study notes interface',
    width: 640,
    height: 468,
  },
  questionBoardPhone: {
    src: `${BASE_PATH}/iPhone-14-Pro-Max-in-deep-purple-color_Messages-515x1024.png`,
    alt: 'Question board on mobile',
    width: 515,
    height: 1024,
  },
  ankiApp: {
    src: `${BASE_PATH}/Anki-iphone-ipad-1024x763.png`,
    alt: 'Anki app interface',
    width: 640,
    height: 477,
  },
  cheatSheet: {
    src: `${BASE_PATH}/3S-Cheat-sheet-768x1089.png`,
    alt: 'Cheat sheet example',
    width: 640,
    height: 908,
  },
  practiceQuestions: {
    src: `${BASE_PATH}/PQ-768x1088.png`,
    alt: 'Practice questions interface',
    width: 640,
    height: 907,
  },
  testInterface: {
    src: `${BASE_PATH}/Test-768x1083.png`,
    alt: 'Test interface',
    width: 640,
    height: 903,
  },
  examInterface: {
    src: `${BASE_PATH}/Exam-768x1087.png`,
    alt: 'Exam interface',
    width: 640,
    height: 906,
  },
  ucatScreenshot: {
    src: `${BASE_PATH}/ucat-screenshot.png`,
    alt: 'UCAT learning modules',
    width: 640,
    height: 417,
  },
  ucatPhone: {
    src: `${BASE_PATH}/iPhone-14-pro-no-border-495x1024.png`,
    alt: 'UCAT app on iPhone',
    width: 495,
    height: 1024,
  },
  ucatQR: {
    src: `${BASE_PATH}/UCAT-QR-online-MBP-1024x600.png`,
    alt: 'UCAT QR code',
    width: 640,
    height: 375,
  },
};


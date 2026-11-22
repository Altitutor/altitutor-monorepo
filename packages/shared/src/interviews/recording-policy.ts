import limits from "./recording-limits.json";

/** Bound the browser-encoded station take; Storage and the upload API share this cap. */
export const interviewVideoRecordingMaxBytes = limits.videoMaximumBytes;

export const interviewVideoRecordingBitrates = {
  video: 1_000_000,
  audio: 64_000,
} as const;

/** Output target; the call's network-adaptive source tracks remain authoritative. */
export const interviewVideoRecordingQuality = {
  width: 1280,
  height: 720,
  frameRate: 24,
} as const;

export const interviewVideoRecordingStopBytes = 192 * 1024 * 1024;
export const interviewAudioRecordingMaxBytes = 50 * 1024 * 1024;
export const interviewAudioRecordingStopBytes = 48 * 1024 * 1024;

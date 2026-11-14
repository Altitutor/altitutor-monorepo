/** Speech processing used by the in-person recorder and its local device test. */
export const interviewMicrophoneConstraints: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: false,
};

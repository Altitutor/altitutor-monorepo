export interface InterviewVideoSources {
  localVideo: MediaStreamTrack | null;
  remoteVideo: MediaStreamTrack | null;
  localAudio: MediaStreamTrack | null;
  remoteAudio: MediaStreamTrack | null;
}

const frameRate = 12;
const frameWidth = 640;
const frameHeight = 360;
const insetWidth = 160;
const insetHeight = 90;
const insetMargin = 12;
const unsupportedMessage =
  "This browser does not support recording online interview video.";

type VideoInput = {
  track: MediaStreamTrack;
  element: HTMLVideoElement;
};

function syncVideo(
  previous: VideoInput | null,
  track: MediaStreamTrack | null,
): VideoInput | null {
  if (previous?.track === track) return previous;
  if (previous) {
    previous.element.pause();
    previous.element.srcObject = null;
  }
  if (track?.kind !== "video" || track.readyState !== "live") return null;
  const element = document.createElement("video");
  element.muted = true;
  element.playsInline = true;
  element.srcObject = new MediaStream([track]);
  void element.play().catch(() => undefined);
  return { track, element };
}

function drawVideo(
  drawing: CanvasRenderingContext2D,
  input: VideoInput | null,
  left: number,
  top: number,
  width: number,
  height: number,
) {
  if (!input) return;
  const { track, element } = input;
  if (
    track.muted ||
    !track.enabled ||
    track.readyState !== "live" ||
    element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
    !element.videoWidth ||
    !element.videoHeight
  )
    return;
  const scale = Math.max(width / element.videoWidth, height / element.videoHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  drawing.drawImage(
    element,
    (element.videoWidth - sourceWidth) / 2,
    (element.videoHeight - sourceHeight) / 2,
    sourceWidth,
    sourceHeight,
    left,
    top,
    width,
    height,
  );
}

/** Owns the output tracks; the call continues to own all participant tracks. */
export function createInterviewVideoCompositor() {
  const AudioContextCtor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  const canvas = document.createElement("canvas");
  canvas.width = frameWidth;
  canvas.height = frameHeight;
  const drawing = canvas.getContext("2d", { alpha: false });
  if (!drawing || !AudioContextCtor || !canvas.captureStream)
    throw new Error(unsupportedMessage);

  const audio = new AudioContextCtor();
  let destination: MediaStreamAudioDestinationNode | undefined;
  let stream: MediaStream | undefined;
  let videoOutput: CanvasCaptureMediaStreamTrack;
  let mix: GainNode;
  let silence: ConstantSourceNode;
  try {
    destination = audio.createMediaStreamDestination();
    mix = audio.createGain();
    mix.gain.value = 0.5;
    mix.connect(destination);
    // An active zero source keeps the encoder clock ticking with no participants.
    silence = audio.createConstantSource();
    silence.offset.value = 0;
    silence.connect(mix);
    silence.start();
    stream = canvas.captureStream(frameRate);
    const video = stream.getVideoTracks()[0];
    const audioTrack = destination.stream.getAudioTracks()[0];
    if (!video || !audioTrack) throw new Error(unsupportedMessage);
    videoOutput = video as CanvasCaptureMediaStreamTrack;
    stream.addTrack(audioTrack);
  } catch (error) {
    stream?.getTracks().forEach((track) => track.stop());
    destination?.stream.getTracks().forEach((track) => track.stop());
    void audio.close().catch(() => undefined);
    throw error;
  }

  const audioInputs = new Map<MediaStreamTrack, MediaStreamAudioSourceNode>();
  let local: VideoInput | null = null;
  let remote: VideoInput | null = null;
  let disposed = false;

  const paint = () => {
    drawing.fillStyle = "#000";
    drawing.fillRect(0, 0, canvas.width, canvas.height);
    drawVideo(drawing, remote, 0, 0, frameWidth, frameHeight);
    drawVideo(drawing, local, frameWidth - insetWidth - insetMargin, frameHeight - insetHeight - insetMargin, insetWidth, insetHeight);
  };
  paint();
  const timer = window.setInterval(paint, 1000 / frameRate);

  const sync = (sources: InterviewVideoSources | null) => {
    if (disposed) return;
    local = syncVideo(local, sources?.localVideo ?? null);
    remote = syncVideo(remote, sources?.remoteVideo ?? null);

    const liveAudio = new Set(
      [sources?.localAudio, sources?.remoteAudio].filter(
        (track): track is MediaStreamTrack =>
          track?.kind === "audio" && track.readyState === "live",
      ),
    );
    for (const [track, node] of audioInputs) {
      if (!liveAudio.has(track)) {
        node.disconnect();
        audioInputs.delete(track);
      }
    }
    for (const track of liveAudio) {
      if (audioInputs.has(track)) continue;
      const node = audio.createMediaStreamSource(new MediaStream([track]));
      node.connect(mix);
      audioInputs.set(track, node);
    }

    // Deliver a black frame promptly even if background timer ticks are throttled.
    paint();
    videoOutput.requestFrame?.();
  };

  return {
    stream,
    sync,
    dispose() {
      if (disposed) return;
      sync(null);
      disposed = true;
      window.clearInterval(timer);
      silence.stop();
      silence.disconnect();
      mix.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      void audio.close().catch(() => undefined);
    },
    async resumeAudio() {
      if (!disposed && audio.state !== "running") await audio.resume();
    },
    audioRunning: () => !disposed && audio.state === "running",
  };
}

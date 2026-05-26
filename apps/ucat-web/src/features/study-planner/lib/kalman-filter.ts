export type KalmanObservation = {
  score: number;
};

export type KalmanState = {
  sHat: number;
  p: number;
};

/**
 * Runs a 1D Kalman filter over ordered score observations.
 */
export function runKalmanFilter(
  observations: KalmanObservation[],
  p0: number,
  r: number,
  initialScore: number,
): KalmanState {
  if (!Number.isFinite(initialScore)) {
    throw new Error("initialScore must be a finite number");
  }
  if (!Number.isFinite(p0) || p0 <= 0) {
    throw new Error("p0 must be > 0");
  }
  if (!Number.isFinite(r) || r <= 0) {
    throw new Error("r must be > 0");
  }

  let sHat = initialScore;
  let p = p0;

  for (const observation of observations) {
    if (!Number.isFinite(observation.score)) continue;
    const innovation = observation.score - sHat;
    const gain = p / (p + r);
    sHat += gain * innovation;
    p = (1 - gain) * p;
  }

  return { sHat, p };
}

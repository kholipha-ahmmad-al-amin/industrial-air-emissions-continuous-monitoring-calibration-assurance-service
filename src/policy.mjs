export function deriveCalibrationPolicy({ observedValue, referenceValue, allowableDeviationPercent }) {
  const deviationPercent = Math.abs((observedValue - referenceValue) / referenceValue) * 100;
  const exceedsTolerance = deviationPercent > allowableDeviationPercent;
  const calibrationRisk = deviationPercent >= allowableDeviationPercent * 2
    ? 'critical'
    : exceedsTolerance
      ? 'high'
      : deviationPercent >= allowableDeviationPercent * 0.8
        ? 'watch'
        : 'controlled';
  return {
    calibrationRisk,
    deviationPercent: Number(deviationPercent.toFixed(4)),
    exceedsTolerance,
    correctionRequired: calibrationRisk === 'critical' || calibrationRisk === 'high',
    managerAuthorizationRequired: calibrationRisk === 'critical' || calibrationRisk === 'high',
    targetReviewMinutes: calibrationRisk === 'critical' ? 30 : calibrationRisk === 'high' ? 60 : 240
  };
}

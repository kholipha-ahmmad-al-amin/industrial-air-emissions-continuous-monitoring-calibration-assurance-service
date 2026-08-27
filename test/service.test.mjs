import { describe, expect, it } from 'vitest';
import { EmissionsCalibrationService } from '../src/domain.mjs';

class MemoryStore {
  constructor() { this.snapshot = { records: [], requestIds: [] }; }
  async load() { return structuredClone(this.snapshot); }
  async save(snapshot) { this.snapshot = structuredClone(snapshot); }
}
const actors = {
  monitoring: { id: 'monitoring-001', role: 'emissions_monitoring_technician' },
  instrument: { id: 'instrument-001', role: 'instrumentation_technician' },
  analyst: { id: 'analyst-001', role: 'environmental_data_analyst' },
  manager: { id: 'manager-001', role: 'air_quality_manager' },
  records: { id: 'records-001', role: 'compliance_records_officer' }
};
const reading = { monitoringPointReference: 'STACK-01-CEMS', analyzerSerial: 'CEMS-NOX-2026-042', pollutant: 'Nitrogen Oxides', units: 'ppm', observedValue: 115, referenceValue: 100, allowableDeviationPercent: 5, sourceEvidenceReference: 'EVID-READING-2026-0042' };
function serviceForTest() {
  let index = 0;
  return new EmissionsCalibrationService(new MemoryStore(), { idGenerator: () => `00000000-0000-4000-8000-${String(++index).padStart(12, '0')}`, now: () => '2026-08-27T11:00:00.000Z' });
}
async function createRecord(service, requestId = 'request-create-0001') { return service.create(reading, actors.monitoring, requestId); }

describe('EmissionsCalibrationService', () => {
  it('classifies a severe reference deviation and stores original evidence', async () => {
    const record = await createRecord(serviceForTest());
    expect(record.calibrationPolicy).toMatchObject({ calibrationRisk: 'critical', deviationPercent: 15, correctionRequired: true, managerAuthorizationRequired: true, targetReviewMinutes: 30 });
    expect(record.events[0]).toMatchObject({ evidenceReference: reading.sourceEvidenceReference, actorRole: 'emissions_monitoring_technician' });
  });
  it('enforces the complete forward-only calibration lifecycle', async () => {
    const service = serviceForTest(); const record = await createRecord(service);
    await service.action(record.id, 'recordCalibration', { summary: 'Completed calibration check against traceable reference standard.', calibrationEvidenceReference: 'EVID-CAL-2026-0042' }, actors.instrument, 'request-calibration-0001');
    await service.action(record.id, 'assessVariance', { summary: 'Reviewed variance and classified the required correction response.', assessmentEvidenceReference: 'EVID-ASSESS-2026-0042' }, actors.analyst, 'request-assessment-0001');
    await service.action(record.id, 'authorizeCorrection', { summary: 'Authorized corrective work and controlled return to monitoring.', authorizationEvidenceReference: 'EVID-AUTH-2026-0042' }, actors.manager, 'request-authorization-0001');
    const closed = await service.action(record.id, 'closeCalibration', { summary: 'Closed calibration record after corrective evidence review.', closureEvidenceReference: 'EVID-CLOSE-2026-0042' }, actors.records, 'request-close-0001');
    expect(closed.status).toBe('closed');
    expect(closed.events).toHaveLength(5);
    expect(closed.events.at(-1)).toMatchObject({ name: 'closeCalibration', evidenceReference: 'EVID-CLOSE-2026-0042' });
  });
  it('rejects unauthorized roles, replayed requests, duplicates, and invalid input', async () => {
    const service = serviceForTest(); const record = await createRecord(service, 'request-replay-0001');
    await expect(service.action(record.id, 'recordCalibration', { summary: 'Unauthorized person attempts to record a calibration result.', calibrationEvidenceReference: 'EVID-CAL-2026-0042' }, actors.analyst, 'request-wrong-role-0001')).rejects.toMatchObject({ code: 'forbidden', status: 403 });
    await expect(createRecord(service, 'request-replay-0001')).rejects.toMatchObject({ code: 'conflict', status: 409 });
    await expect(createRecord(service, 'request-duplicate-0001')).rejects.toMatchObject({ code: 'conflict', status: 409 });
    await expect(service.create({ ...reading, allowableDeviationPercent: 0 }, actors.monitoring, 'request-invalid-0001')).rejects.toMatchObject({ code: 'invalid_input', status: 422 });
  });
});

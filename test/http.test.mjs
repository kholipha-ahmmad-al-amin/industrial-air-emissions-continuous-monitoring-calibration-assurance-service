import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.mjs';
import { EmissionsCalibrationService } from '../src/domain.mjs';

class MemoryStore { constructor() { this.snapshot = { records: [], requestIds: [] }; } async load() { return structuredClone(this.snapshot); } async save(snapshot) { this.snapshot = structuredClone(snapshot); } }
const reading = { monitoringPointReference: 'STACK-02-CEMS', analyzerSerial: 'CEMS-SO2-2026-077', pollutant: 'Sulfur Dioxide', units: 'ppm', observedValue: 103, referenceValue: 100, allowableDeviationPercent: 5, sourceEvidenceReference: 'EVID-READING-2026-0077' };
function appForTest() { let index = 0; return createApp(new EmissionsCalibrationService(new MemoryStore(), { idGenerator: () => `00000000-0000-4000-8000-${String(++index).padStart(12, '0')}`, now: () => '2026-08-27T11:30:00.000Z' }), { requestIdGenerator: () => 'generated-request-0001' }); }
function actor(role) { return { 'x-actor-id': 'operator-001', 'x-actor-role': role }; }

describe('HTTP contract', () => {
  it('creates a record and propagates the caller correlation identifier', async () => {
    const response = await request(appForTest()).post('/records').set(actor('emissions_monitoring_technician')).set('x-request-id', 'request-http-create-0001').send(reading).expect(201);
    expect(response.headers['x-request-id']).toBe('request-http-create-0001');
    expect(response.body).toMatchObject({ requestId: 'request-http-create-0001', data: { status: 'reading_logged', monitoringPointReference: reading.monitoringPointReference } });
  });
  it('generates a request identifier for health checks', async () => {
    const response = await request(appForTest()).get('/health').expect(200);
    expect(response.body).toEqual({ status: 'ok', requestId: 'generated-request-0001' });
    expect(response.headers['x-request-id']).toBe('generated-request-0001');
  });
  it('returns invalid input and forbidden errors as structured JSON', async () => {
    const app = appForTest();
    const invalid = await request(app).post('/records').set(actor('emissions_monitoring_technician')).set('x-request-id', 'request-http-invalid-0001').send({ ...reading, referenceValue: 0 }).expect(422);
    expect(invalid.body).toMatchObject({ requestId: 'request-http-invalid-0001', error: { code: 'invalid_input' } });
    const denied = await request(app).post('/records').set(actor('instrumentation_technician')).set('x-request-id', 'request-http-forbidden-0001').send(reading).expect(403);
    expect(denied.body).toMatchObject({ requestId: 'request-http-forbidden-0001', error: { code: 'forbidden' } });
  });
  it('returns not-found, replay, and invalid-state errors with correlation identifiers', async () => {
    const app = appForTest();
    const missing = await request(app).get('/records/00000000-0000-4000-8000-000000000099').set('x-request-id', 'request-http-missing-0001').expect(404);
    expect(missing.body).toMatchObject({ requestId: 'request-http-missing-0001', error: { code: 'not_found' } });
    const created = await request(app).post('/records').set(actor('emissions_monitoring_technician')).set('x-request-id', 'request-http-replay-0001').send(reading).expect(201);
    const replay = await request(app).post(`/records/${created.body.data.id}/recordCalibration`).set(actor('instrumentation_technician')).set('x-request-id', 'request-http-replay-0001').send({ summary: 'Attempted calibration with a replayed request identifier.', calibrationEvidenceReference: 'EVID-CAL-2026-0077' }).expect(409);
    expect(replay.body).toMatchObject({ requestId: 'request-http-replay-0001', error: { code: 'conflict' } });
    const invalidState = await request(app).post(`/records/${created.body.data.id}/closeCalibration`).set(actor('compliance_records_officer')).set('x-request-id', 'request-http-state-0001').send({ summary: 'Attempted closure before required calibration workflow steps.', closureEvidenceReference: 'EVID-CLOSE-2026-0077' }).expect(409);
    expect(invalidState.body).toMatchObject({ requestId: 'request-http-state-0001', error: { code: 'invalid_state' } });
  });
});

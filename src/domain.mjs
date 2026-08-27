import { randomUUID } from 'node:crypto';
import { conflict, forbidden, invalidState, notFound } from './errors.mjs';
import { deriveCalibrationPolicy } from './policy.mjs';
import { ROLES, evidenceFieldForAction, validateActionInput, validateCreateInput, validateRecordId, validateRequestId } from './validation.mjs';

const transitions = Object.freeze({
  recordCalibration: { from: 'reading_logged', to: 'calibration_recorded', role: ROLES.instrumentation_technician },
  assessVariance: { from: 'calibration_recorded', to: 'variance_assessed', role: ROLES.environmental_data_analyst },
  authorizeCorrection: { from: 'variance_assessed', to: 'correction_authorized', role: ROLES.air_quality_manager },
  closeCalibration: { from: 'correction_authorized', to: 'closed', role: ROLES.compliance_records_officer }
});

function assertActor(actor) {
  if (!actor || typeof actor.id !== 'string' || typeof actor.role !== 'string') throw forbidden('A valid actor identity is required.');
}

export class EmissionsCalibrationService {
  constructor(store, { idGenerator = randomUUID, now = () => new Date().toISOString() } = {}) {
    this.store = store;
    this.idGenerator = idGenerator;
    this.now = now;
  }
  async create(input, actor, requestId) {
    const reading = validateCreateInput(input);
    validateRequestId(requestId);
    assertActor(actor);
    if (actor.role !== ROLES.emissions_monitoring_technician) throw forbidden('Only an emissions_monitoring_technician can log a reading.');
    const snapshot = await this.store.load();
    if (snapshot.requestIds.includes(requestId)) throw conflict('x-request-id has already been processed.', { requestId });
    const duplicate = snapshot.records.find((record) => record.monitoringPointReference === reading.monitoringPointReference && record.analyzerSerial === reading.analyzerSerial);
    if (duplicate) throw conflict('A record already exists for this monitoring point and analyzer.', { monitoringPointReference: reading.monitoringPointReference, analyzerSerial: reading.analyzerSerial, recordId: duplicate.id });
    const at = this.now();
    const record = {
      id: this.idGenerator(),
      ...reading,
      calibrationPolicy: deriveCalibrationPolicy(reading),
      status: 'reading_logged',
      createdAt: at,
      updatedAt: at,
      events: [{ name: 'reading_logged', actorId: actor.id, actorRole: actor.role, requestId, at, summary: 'Continuous emissions reference reading logged for calibration review.', evidenceReference: reading.sourceEvidenceReference, details: reading }]
    };
    snapshot.records.push(record);
    snapshot.requestIds.push(requestId);
    await this.store.save(snapshot);
    return record;
  }
  async get(id) {
    validateRecordId(id);
    const record = (await this.store.load()).records.find((item) => item.id === id);
    if (!record) throw notFound('Calibration record was not found.', { id });
    return record;
  }
  async action(id, action, input, actor, requestId) {
    validateRecordId(id);
    const transition = transitions[action];
    if (!transition) throw notFound('Action endpoint was not found.', { action });
    const actionInput = validateActionInput(action, input);
    validateRequestId(requestId);
    assertActor(actor);
    if (actor.role !== transition.role) throw forbidden(`Only an ${transition.role} can execute ${action}.`);
    const snapshot = await this.store.load();
    if (snapshot.requestIds.includes(requestId)) throw conflict('x-request-id has already been processed.', { requestId });
    const record = snapshot.records.find((item) => item.id === id);
    if (!record) throw notFound('Calibration record was not found.', { id });
    if (record.status !== transition.from) throw invalidState(`Action ${action} requires status ${transition.from}.`, { action, currentStatus: record.status, requiredStatus: transition.from });
    const at = this.now();
    const evidenceField = evidenceFieldForAction(action);
    record.status = transition.to;
    record.updatedAt = at;
    record.events.push({ name: action, actorId: actor.id, actorRole: actor.role, requestId, at, summary: actionInput.summary, evidenceReference: actionInput[evidenceField], details: actionInput });
    snapshot.requestIds.push(requestId);
    await this.store.save(snapshot);
    return record;
  }
}

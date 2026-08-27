import { invalidInput } from './errors.mjs';

export const ROLES = Object.freeze({
  emissions_monitoring_technician: 'emissions_monitoring_technician',
  instrumentation_technician: 'instrumentation_technician',
  environmental_data_analyst: 'environmental_data_analyst',
  air_quality_manager: 'air_quality_manager',
  compliance_records_officer: 'compliance_records_officer'
});

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:@-]*$/;
const referencePattern = /^[A-Za-z0-9][A-Za-z0-9._:/@-]*$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const actionEvidenceFields = Object.freeze({
  recordCalibration: 'calibrationEvidenceReference',
  assessVariance: 'assessmentEvidenceReference',
  authorizeCorrection: 'authorizationEvidenceReference',
  closeCalibration: 'closureEvidenceReference'
});

function plainObject(value) { return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function string(value, field, { min = 1, max = 256, pattern } = {}) {
  if (typeof value !== 'string') throw invalidInput(`${field} must be a string.`, { field });
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) throw invalidInput(`${field} must contain between ${min} and ${max} characters.`, { field, min, max });
  if (pattern && !pattern.test(normalized)) throw invalidInput(`${field} has an invalid format.`, { field });
  return normalized;
}
function number(value, field, { min = -1_000_000, max = 1_000_000, exclusiveMin } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (exclusiveMin !== undefined && value <= exclusiveMin)) {
    throw invalidInput(`${field} must be a finite number in the permitted range.`, { field, min, max, exclusiveMin });
  }
  return value;
}
function onlyFields(input, fields) {
  const unknownFields = Object.keys(input).filter((field) => !fields.includes(field));
  if (unknownFields.length) throw invalidInput('The payload includes unsupported fields.', { fields: unknownFields });
}

export function requiredHeader(value, field) { return string(value, field, { min: 3, max: 128, pattern: identifierPattern }); }
export function actorFromHeaders(headers) {
  const id = requiredHeader(headers['x-actor-id'], 'x-actor-id');
  const role = requiredHeader(headers['x-actor-role'], 'x-actor-role');
  if (!Object.hasOwn(ROLES, role)) throw invalidInput('x-actor-role is not recognized.', { field: 'x-actor-role', role });
  return { id, role };
}
export function validateRequestId(value) { return string(value, 'x-request-id', { min: 8, max: 128, pattern: identifierPattern }); }
export function validateRecordId(value) {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw invalidInput('record id must be a valid UUID.', { field: 'id' });
  return value;
}
export function validateCreateInput(input) {
  if (!plainObject(input)) throw invalidInput('Request body must be a JSON object.', { field: 'body' });
  const fields = ['monitoringPointReference', 'analyzerSerial', 'pollutant', 'units', 'observedValue', 'referenceValue', 'allowableDeviationPercent', 'sourceEvidenceReference'];
  onlyFields(input, fields);
  return {
    monitoringPointReference: string(input.monitoringPointReference, 'monitoringPointReference', { min: 5, max: 80, pattern: referencePattern }),
    analyzerSerial: string(input.analyzerSerial, 'analyzerSerial', { min: 5, max: 80, pattern: referencePattern }),
    pollutant: string(input.pollutant, 'pollutant', { min: 2, max: 80 }),
    units: string(input.units, 'units', { min: 1, max: 32 }),
    observedValue: number(input.observedValue, 'observedValue'),
    referenceValue: number(input.referenceValue, 'referenceValue', { exclusiveMin: 0 }),
    allowableDeviationPercent: number(input.allowableDeviationPercent, 'allowableDeviationPercent', { min: 0.01, max: 100 }),
    sourceEvidenceReference: string(input.sourceEvidenceReference, 'sourceEvidenceReference', { min: 8, max: 160, pattern: referencePattern })
  };
}
export function evidenceFieldForAction(action) { return actionEvidenceFields[action]; }
export function validateActionInput(action, input) {
  const evidenceField = evidenceFieldForAction(action);
  if (!evidenceField) throw invalidInput('Action is not recognized.', { field: 'action', action });
  if (!plainObject(input)) throw invalidInput('Request body must be a JSON object.', { field: 'body' });
  onlyFields(input, ['summary', evidenceField]);
  return {
    summary: string(input.summary, 'summary', { min: 10, max: 1000 }),
    [evidenceField]: string(input[evidenceField], evidenceField, { min: 8, max: 160, pattern: referencePattern })
  };
}

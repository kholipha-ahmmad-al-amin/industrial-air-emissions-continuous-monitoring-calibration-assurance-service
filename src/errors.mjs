export class DomainError extends Error {
  constructor(code, message, status, details) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const invalidInput = (message, details) => new DomainError('invalid_input', message, 422, details);
export const forbidden = (message, details) => new DomainError('forbidden', message, 403, details);
export const notFound = (message, details) => new DomainError('not_found', message, 404, details);
export const invalidState = (message, details) => new DomainError('invalid_state', message, 409, details);
export const conflict = (message, details) => new DomainError('conflict', message, 409, details);

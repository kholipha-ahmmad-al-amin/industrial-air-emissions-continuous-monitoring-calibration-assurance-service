import { randomUUID } from 'node:crypto';
import express from 'express';
import { DomainError, invalidInput, notFound } from './errors.mjs';
import { actorFromHeaders, validateRequestId } from './validation.mjs';

function errorPayload(error, requestId) {
  return { requestId, error: { code: error.code, message: error.message, ...(error.details === undefined ? {} : { details: error.details }) } };
}
export function createApp(service, { requestIdGenerator = randomUUID } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((request, response, next) => {
    try {
      request.requestId = request.header('x-request-id') === undefined ? requestIdGenerator() : validateRequestId(request.header('x-request-id'));
      response.set('x-request-id', request.requestId);
      next();
    } catch (error) {
      request.requestId = requestIdGenerator();
      response.set('x-request-id', request.requestId);
      next(error);
    }
  });
  app.use(express.json({ limit: '64kb', strict: true }));
  app.get('/health', (request, response) => response.status(200).json({ status: 'ok', requestId: request.requestId }));
  app.post('/records', async (request, response, next) => {
    try { response.status(201).json({ data: await service.create(request.body, actorFromHeaders(request.headers), request.requestId), requestId: request.requestId }); } catch (error) { next(error); }
  });
  app.get('/records/:id', async (request, response, next) => {
    try { response.status(200).json({ data: await service.get(request.params.id), requestId: request.requestId }); } catch (error) { next(error); }
  });
  app.post('/records/:id/:action', async (request, response, next) => {
    try { response.status(200).json({ data: await service.action(request.params.id, request.params.action, request.body, actorFromHeaders(request.headers), request.requestId), requestId: request.requestId }); } catch (error) { next(error); }
  });
  app.use((_request, _response, next) => next(notFound('Route was not found.')));
  app.use((error, request, response, _next) => {
    const requestId = request.requestId ?? requestIdGenerator();
    response.set('x-request-id', requestId);
    if (error instanceof DomainError) return response.status(error.status).json(errorPayload(error, requestId));
    if (error?.type === 'entity.parse.failed') {
      const bodyError = invalidInput('Request body contains invalid JSON.', { field: 'body' });
      return response.status(bodyError.status).json(errorPayload(bodyError, requestId));
    }
    return response.status(500).json({ requestId, error: { code: 'internal_error', message: 'An unexpected error occurred.' } });
  });
  return app;
}

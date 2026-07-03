import { ArgumentsHost } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiExceptionFilter } from './api-exception.filter';

describe('ApiExceptionFilter', () => {
  it('does not expose raw Prisma errors to clients', () => {
    const prisma = { auditEvent: { create: jest.fn() } };
    const filter = new ApiExceptionFilter(prisma as any);
    const response = mockResponse();
    const host = mockHost(response);

    filter.catch(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed on table users', {
        code: 'P2002',
        clientVersion: '5.22.0',
      }),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        message: 'La operación entra en conflicto con el estado actual del recurso.',
      }),
    );
    expect(JSON.stringify(response.json.mock.calls[0][0])).not.toContain('users');
  });

  function mockResponse() {
    return {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  }

  function mockHost(response: any): ArgumentsHost {
    return {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({
          method: 'POST',
          originalUrl: '/api/evaluations/invitations',
          headers: {},
        }),
      }),
    } as any;
  }
});

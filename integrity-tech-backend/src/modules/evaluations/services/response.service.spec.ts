import { BadRequestException } from '@nestjs/common';
import { ResponseService } from './response.service';

describe('ResponseService psychometric governance integration', () => {
  const user = {
    userId: '00000000-0000-7000-8000-000000000003',
    organizationId: '00000000-0000-7000-8000-000000000002',
    email: 'candidate@integrity.demo',
    roles: ['candidate'],
  };

  let service: ResponseService;
  let queueProducer: any;
  let auditService: any;
  let governanceResolver: any;
  let prisma: any;
  let storage: any;

  beforeEach(() => {
    queueProducer = {
      enqueueAnswer: jest.fn().mockResolvedValue({ jobId: 'ans-job-1' }),
    };
    auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    prisma = {
      attemptLog: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
      },
    };
    storage = {
      storeSnapshot: jest.fn().mockResolvedValue({
        id: 'file-1',
        mimeType: 'image/jpeg',
        sizeBytes: '12',
        checksumSha256: 'a'.repeat(64),
        classification: 'HIGHLY_SENSITIVE',
      }),
    };
    governanceResolver = {
      resolveItemVersionForAnswer: jest.fn().mockResolvedValue({
        itemVersionId: '00000000-0000-7000-8000-000000000902',
        legacy: false,
      }),
    };
    service = new ResponseService(prisma, queueProducer, {} as any, auditService, governanceResolver, storage);
  });

  it('passes resolved itemVersionId to answer queue', async () => {
    await service.submitAnswer(
      '00000000-0000-7000-8000-000000000501',
      {
        questionId: '00000000-0000-7000-8000-000000000201',
        itemVersionId: '00000000-0000-7000-8000-000000000902',
        response: { selectedOptionId: 'a' },
      },
      user,
    );

    expect(queueProducer.enqueueAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        questionId: '00000000-0000-7000-8000-000000000201',
        itemVersionId: '00000000-0000-7000-8000-000000000902',
      }),
    );
  });

  it('rejects answers when provided itemVersionId does not match attempt version', async () => {
    await expect(
      service.submitAnswer(
        '00000000-0000-7000-8000-000000000501',
        {
          questionId: '00000000-0000-7000-8000-000000000201',
          itemVersionId: '00000000-0000-7000-8000-000000000999',
          response: { selectedOptionId: 'a' },
        },
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(queueProducer.enqueueAnswer).not.toHaveBeenCalled();
  });

  it('stores snapshots as private files and records only metadata in attempt log', async () => {
    const result = await service.uploadSnapshot(
      '00000000-0000-7000-8000-000000000501',
      { image: `data:image/jpeg;base64,${Buffer.from('snapshot').toString('base64')}` },
      user,
    );

    expect(storage.storeSnapshot).toHaveBeenCalledWith({
      organizationId: user.organizationId,
      ownerUserId: user.userId,
      attemptId: '00000000-0000-7000-8000-000000000501',
      dataUrl: expect.stringContaining('data:image/jpeg;base64,'),
    });
    expect(prisma.attemptLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            snapshotStored: true,
            privateFileId: 'file-1',
          }),
        }),
      }),
    );
    expect(result).toMatchObject({ imageStored: true, fileId: 'file-1' });
  });
});

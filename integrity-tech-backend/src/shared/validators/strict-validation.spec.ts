import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from '../../modules/iam/dto/login.dto';
import { SubmitAnswerBodyDto } from '../../modules/evaluations/dto/submit-answer.dto';

describe('Strict DTO validation', () => {
  it('rejects extra fields when global validation is strict', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    await expect(
      pipe.transform(
        {
          email: 'admin@integrity.demo',
          password: 'IntegrityDemo123!',
          role: 'admin',
        },
        { type: 'body', metatype: LoginDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid login payloads', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'not-an-email',
      password: 'short',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects oversized answer payloads', async () => {
    const dto = plainToInstance(SubmitAnswerBodyDto, {
      questionId: '00000000-0000-7000-8000-000000000201',
      response: { text: 'x'.repeat(5000) },
      tiempoMs: 1000,
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'response')).toBe(true);
  });
});

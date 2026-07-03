import { BadRequestException, Injectable } from '@nestjs/common';
import { EDITORIAL_TRANSITIONS, EditorialStatus, PUBLISHED_STATUSES } from '../psychometric-governance.types';

@Injectable()
export class PsychometricWorkflowService {
  assertCanTransition(from: string, to: string): void {
    const allowed = EDITORIAL_TRANSITIONS[from as EditorialStatus] || [];
    if (!allowed.includes(to as EditorialStatus)) {
      throw new BadRequestException(`Transición editorial inválida: ${from} -> ${to}`);
    }
  }

  assertMutable(status: string): void {
    if (PUBLISHED_STATUSES.has(status)) {
      throw new BadRequestException('Los artefactos publicados son inmutables; crea una nueva versión.');
    }
  }

  publishTimestamp(status: string): Date | undefined {
    return status === 'PUBLISHED' || status === 'ACTIVE' ? new Date() : undefined;
  }

  assertRetireReason(reason?: string): void {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('Retirar una versión requiere registrar una razón.');
    }
  }
}

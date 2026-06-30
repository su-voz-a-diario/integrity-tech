export interface Invitation {
  accessCode: string;
  candidateName: string;
  email: string;
  examId: string;
  examTitle: string;
  claimed: boolean;
  attemptId: string | null;
}

if (!(global as any).invitationsStore) {
  (global as any).invitationsStore = new Map<string, Invitation>();
  
  // Seed de invitación demo por defecto
  (global as any).invitationsStore.set('DEMO-KEY', {
    accessCode: 'DEMO-KEY',
    candidateName: 'Candidato Prueba',
    email: 'candidato.prueba@example.com',
    examId: 'mock-exam-id-1111',
    examTitle: 'Batería de Evaluación Psicométrica Integrada (IT²)',
    claimed: false,
    attemptId: null,
  });
}

export const invitations = (global as any).invitationsStore as Map<string, Invitation>;

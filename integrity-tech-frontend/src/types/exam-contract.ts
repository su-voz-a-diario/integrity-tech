// Contratos de datos compartidos entre Next.js (Frontend) y NestJS (Backend)

export type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'LIKERT';

export interface QuestionOption {
  id: string;
  text: string;
}

export interface QuestionContent {
  text: string;
  options?: QuestionOption[];
  scale?: {
    min: number;
    max: number;
    labels: Record<string, string>;
  };
}

export interface QuestionDto {
  id: string;
  type: QuestionType;
  content: QuestionContent;
  defaultPoints: number;
}

export interface ExamDto {
  id: string;
  title: string;
  description?: string;
  durationMinutes?: number;
  startTime?: string;
  endTime?: string;
}

export interface ExamAttemptDto {
  id: string;
  examId: string;
  userId: string;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'GRADING' | 'COMPLETED' | 'ABANDONED';
  startedAt: string;
  submittedAt?: string;
  score?: number;
  ipAddress?: string;
  userAgent?: string;
}

export interface SubmitAnswerRequest {
  questionId: string;
  response: Record<string, any>;
}

export interface SubmitAnswerResponse {
  status: 'accepted' | 'success';
  message: string;
  jobId: string;
}

export interface SubmitProctoringLogRequest {
  eventType: 'tab_focus_lost' | 'tab_focus_gained' | 'ip_change' | 'connection_lost' | 'connection_restored' | 'clock_tampering';
  metadata: Record<string, any>;
  timestamp: string;
}

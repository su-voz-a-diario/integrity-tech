export type DataLifecycleState = 'ACTIVE' | 'ARCHIVED' | 'DELETED' | 'PURGED';

export type DataSubjectType =
  | 'CANDIDATE'
  | 'ORGANIZATION'
  | 'ATTEMPT'
  | 'REPORT'
  | 'AUDIT'
  | 'SNAPSHOT'
  | 'PROCTORING_EVENT'
  | 'SESSION'
  | 'CONSENT';

export type DataClassification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'HIGHLY_SENSITIVE';

export type CriticalAssetType =
  | 'CONSENT'
  | 'REPORT_TEMPLATE'
  | 'INTERPRETATION_RULE'
  | 'NORM';

export interface RetentionPolicyConfig {
  dataType: DataSubjectType;
  classification: DataClassification;
  activeDays: number;
  archiveAfterDays: number;
  deleteAfterDays: number;
  purgeAfterDays: number;
  legalHoldAllowed: boolean;
  description: string;
}

export interface DataExportRequest {
  organizationId: string;
  subjectType: Extract<DataSubjectType, 'CANDIDATE' | 'ATTEMPT' | 'REPORT' | 'AUDIT'>;
  subjectId: string;
  requestedByUserId: string;
  reason: string;
}

export interface DataDeletionRequestInput {
  organizationId: string;
  subjectType: DataSubjectType;
  subjectId: string;
  requestedByUserId: string;
  reason: string;
  dryRun?: boolean;
}

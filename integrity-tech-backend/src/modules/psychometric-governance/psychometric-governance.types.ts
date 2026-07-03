export type EditorialStatus =
  | 'DRAFT'
  | 'INTERNAL_REVIEW'
  | 'PSYCHOLOGIST_REVIEW'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'RETIRED';

export type ItemOperationalStatus = 'DRAFT' | 'REVIEW' | 'PILOT' | 'ACTIVE' | 'RETIRED';

export const EDITORIAL_TRANSITIONS: Record<EditorialStatus, EditorialStatus[]> = {
  DRAFT: ['INTERNAL_REVIEW', 'RETIRED'],
  INTERNAL_REVIEW: ['PSYCHOLOGIST_REVIEW', 'DRAFT', 'RETIRED'],
  PSYCHOLOGIST_REVIEW: ['APPROVED', 'DRAFT', 'RETIRED'],
  APPROVED: ['PUBLISHED', 'RETIRED'],
  PUBLISHED: ['RETIRED'],
  RETIRED: [],
};

export const PUBLISHED_STATUSES = new Set<string>(['PUBLISHED', 'ACTIVE']);

export interface GovernanceTrace {
  mode: 'VERSIONED' | 'PARTIAL' | 'LEGACY_UNVERSIONED';
  assessmentVersionId?: string | null;
  itemVersionIds: string[];
  normGroupVersionId?: string | null;
  scoringModelVersionId?: string | null;
  reportTemplateVersionId?: string | null;
  generatedAt: string;
}

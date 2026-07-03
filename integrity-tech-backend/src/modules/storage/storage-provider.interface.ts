import { Readable } from 'stream';

export type StorageProviderName = 'local-private' | 's3';

export type PutPrivateObjectInput = {
  objectKey: string;
  body: Buffer;
  mimeType: string;
  classification: 'CONFIDENTIAL' | 'HIGHLY_SENSITIVE';
};

export type PutPrivateObjectResult = {
  storageProvider: StorageProviderName;
  bucket?: string | null;
  objectKey: string;
};

export interface StorageProvider {
  readonly name: StorageProviderName;
  putObject(input: PutPrivateObjectInput): Promise<PutPrivateObjectResult>;
  getObjectStream(objectKey: string): Promise<Readable>;
  getSignedUrl(objectKey: string, ttlSeconds: number): Promise<string | null>;
  healthCheck(): Promise<{ status: 'up' | 'down'; message?: string }>;
  softDelete?(objectKey: string): Promise<void>;
}

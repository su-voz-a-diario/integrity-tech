import { Readable } from 'stream';
import { Injectable } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { PutPrivateObjectInput, PutPrivateObjectResult, StorageProvider } from '../storage-provider.interface';

@Injectable()
export class GcsStorageProvider implements StorageProvider {
  readonly name = 'gcs' as const;
  private readonly bucketName = process.env.STORAGE_GCS_BUCKET || '';
  private readonly storage = new Storage({
    projectId: process.env.STORAGE_GCS_PROJECT_ID || undefined,
    keyFilename: process.env.STORAGE_GCS_KEY_FILE || undefined,
  });

  async putObject(input: PutPrivateObjectInput): Promise<PutPrivateObjectResult> {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(input.objectKey);
    await file.save(input.body, {
      contentType: input.mimeType,
      metadata: {
        metadata: {
          classification: input.classification,
        },
      },
    });
    return {
      storageProvider: this.name,
      bucket: this.bucketName,
      objectKey: input.objectKey,
    };
  }

  async getObjectStream(objectKey: string): Promise<Readable> {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(objectKey);
    return file.createReadStream();
  }

  async getSignedUrl(objectKey: string, ttlSeconds: number): Promise<string> {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(objectKey);
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + ttlSeconds * 1000,
    });
    return url;
  }

  async healthCheck() {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const [exists] = await bucket.exists();
      if (!exists) {
        return { status: 'down' as const, message: `Bucket ${this.bucketName} no existe.` };
      }
      return { status: 'up' as const };
    } catch (error: any) {
      return { status: 'down' as const, message: error.message };
    }
  }
}

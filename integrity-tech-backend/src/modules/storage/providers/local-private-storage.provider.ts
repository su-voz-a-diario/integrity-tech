import { createReadStream } from 'fs';
import { access, mkdir, writeFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { Injectable } from '@nestjs/common';
import { getLocalPrivateStoragePath } from '../storage.config';
import { PutPrivateObjectInput, PutPrivateObjectResult, StorageProvider } from '../storage-provider.interface';

@Injectable()
export class LocalPrivateStorageProvider implements StorageProvider {
  readonly name = 'local-private' as const;
  private readonly rootPath = getLocalPrivateStoragePath();

  async putObject(input: PutPrivateObjectInput): Promise<PutPrivateObjectResult> {
    const target = this.resolveObjectPath(input.objectKey);
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    await writeFile(target, input.body, { mode: 0o600 });
    return {
      storageProvider: this.name,
      bucket: null,
      objectKey: input.objectKey,
    };
  }

  async getObjectStream(objectKey: string) {
    return createReadStream(this.resolveObjectPath(objectKey));
  }

  async getSignedUrl() {
    return null;
  }

  async healthCheck() {
    try {
      await mkdir(this.rootPath, { recursive: true, mode: 0o700 });
      await access(this.rootPath);
      return { status: 'up' as const };
    } catch (error) {
      return { status: 'down' as const, message: error.message };
    }
  }

  private resolveObjectPath(objectKey: string) {
    const target = resolve(join(this.rootPath, objectKey));
    if (!target.startsWith(this.rootPath)) {
      throw new Error('Object key fuera del storage privado.');
    }
    return target;
  }
}

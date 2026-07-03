import { join, resolve } from 'path';

export const ALLOWED_PRIVATE_FILE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function getStorageProviderName(env: NodeJS.ProcessEnv = process.env) {
  return env.STORAGE_PROVIDER || (env.NODE_ENV === 'production' ? '' : 'local-private');
}

export function getLocalPrivateStoragePath(env: NodeJS.ProcessEnv = process.env) {
  return resolve(env.STORAGE_LOCAL_PRIVATE_PATH || join(process.cwd(), '.private-storage'));
}

export function getSignedUrlTtlSeconds(env: NodeJS.ProcessEnv = process.env) {
  return Number(env.STORAGE_SIGNED_URL_TTL_SECONDS || 300);
}

export function getMaxPrivateFileBytes(env: NodeJS.ProcessEnv = process.env) {
  return Number(env.STORAGE_MAX_FILE_BYTES || 2 * 1024 * 1024);
}

export function assertStorageConfig(env: NodeJS.ProcessEnv = process.env) {
  const provider = getStorageProviderName(env);
  if (!provider) {
    throw new Error('STORAGE_PROVIDER es obligatorio en producción.');
  }
  if (!['local-private', 's3'].includes(provider)) {
    throw new Error('STORAGE_PROVIDER debe ser local-private o s3.');
  }

  if (env.NODE_ENV === 'production' && provider === 'local-private') {
    throw new Error('STORAGE_PROVIDER=local-private no está permitido en producción.');
  }

  if (provider === 'local-private') {
    const path = getLocalPrivateStoragePath(env);
    if (path.includes('/public') || path.includes('\\public')) {
      throw new Error('STORAGE_LOCAL_PRIVATE_PATH no puede apuntar a una carpeta pública.');
    }
  }

  if (provider === 's3') {
    const required = ['STORAGE_S3_BUCKET', 'STORAGE_S3_REGION', 'STORAGE_S3_ACCESS_KEY_ID', 'STORAGE_S3_SECRET_ACCESS_KEY'];
    const missing = required.filter((key) => !env[key]);
    if (missing.length > 0) {
      throw new Error(`Faltan variables de storage S3: ${missing.join(', ')}`);
    }
  }
}

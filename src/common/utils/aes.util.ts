import { createCipheriv, createDecipheriv } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import configuration from '../config/configuration';

type AesAlgorithm = 'aes-128-ecb' | 'aes-192-ecb' | 'aes-256-ecb';

function getAesConfig() {
  const AES_KEY = configuration().aes.secretKey;

  if (!AES_KEY) {
    throw new Error('AES secret key is not configured');
  }

  const keyBuffer = Buffer.from(AES_KEY, 'utf8');
  const keyLength = keyBuffer.length;

  let algorithm: AesAlgorithm;
  if (keyLength === 16) {
    algorithm = 'aes-128-ecb';
  } else if (keyLength === 24) {
    algorithm = 'aes-192-ecb';
  } else if (keyLength === 32) {
    algorithm = 'aes-256-ecb';
  } else {
    throw new Error('AES key length must be 16/24/32 bytes');
  }

  return { keyBuffer, algorithm };
}

export function encryptAES(data: string): string {
  const { keyBuffer, algorithm } = getAesConfig();
  const cipher = createCipheriv(algorithm, keyBuffer, null);
  cipher.setAutoPadding(true);

  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(data, 'utf8')),
    cipher.final(),
  ]);

  return encrypted.toString('base64');
}

export function decryptAES(cipherText: string): string {
  const { keyBuffer, algorithm } = getAesConfig();
  const decipher = createDecipheriv(algorithm, keyBuffer, null);
  decipher.setAutoPadding(true);

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherText, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

export function strictDecryptAES(key: string, value: unknown): unknown {
  if (typeof value !== 'string' || value.length === 0) {
    return value;
  }

  try {
    const decrypted = decryptAES(value);
    const reEncrypted = encryptAES(decrypted);

    if (reEncrypted !== value) {
      throw new Error('Invalid AES payload');
    }

    return decrypted;
  } catch {
    throw new BadRequestException(`参数${key}必须为加密字符串`);
  }
}

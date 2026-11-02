/**
 * Хранилище файлов (фото груза, сканы документов). Файлы приватные: API отдаёт их только
 * по подписанной ссылке с ограниченным сроком действия (core/security.ts → signFileUrl).
 * Реализация — локальная папка FILES_DIR; интерфейс позволяет заменить её на S3-хранилище.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

import { ValidationError } from '../core/errors.js';

export interface StoredFile {
  data: Buffer;
  contentType: string;
}

export interface FileStorage {
  save(key: string, data: Buffer): Promise<void>;
  read(key: string): Promise<StoredFile | null>;
  remove(key: string): Promise<void>;
}

const KEY_PATTERN = /^[a-z0-9-]+(\/[a-zA-Z0-9-]+)*\.(jpg|png)$/;

export function isValidFileKey(key: string): boolean {
  return KEY_PATTERN.test(key) && !key.includes('..');
}

export class LocalFileStorage implements FileStorage {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  private pathFor(key: string): string {
    if (!isValidFileKey(key)) throw new ValidationError('Некорректный ключ файла');
    const path = resolve(join(this.root, key));
    if (!path.startsWith(this.root + sep)) throw new ValidationError('Некорректный ключ файла');
    return path;
  }

  async save(key: string, data: Buffer): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  async read(key: string): Promise<StoredFile | null> {
    try {
      const data = await readFile(this.pathFor(key));
      return { data, contentType: key.endsWith('.png') ? 'image/png' : 'image/jpeg' };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
  }

  async remove(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Проверяет, что в base64 действительно JPEG или PNG (по сигнатуре файла), и размер ≤ 5 МБ. */
export function decodeImage(base64: string): { data: Buffer; ext: 'jpg' | 'png' } {
  const clean = base64.replace(/^data:image\/[a-z]+;base64,/, '').replace(/\s/g, '');
  if (!/^[A-Za-z0-9+/]+=*$/.test(clean)) throw new ValidationError('Файл повреждён: ожидается base64');
  const data = Buffer.from(clean, 'base64');
  if (data.length > MAX_IMAGE_BYTES) throw new ValidationError('Файл больше 5 МБ');
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return { data, ext: 'jpg' };
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { data, ext: 'png' };
  }
  throw new ValidationError('Поддерживаются только изображения JPEG и PNG');
}

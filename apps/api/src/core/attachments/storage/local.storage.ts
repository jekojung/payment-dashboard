import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type {
  StorageAdapter,
  UploadFileInput,
  UploadFileResult,
} from './storage-adapter';

/**
 * LocalStorage — fallback สำหรับ dev เมื่อยังไม่ตั้งค่า Google Drive
 * เก็บไฟล์ลงโฟลเดอร์ ./storage-dev และคืน path เป็น driveLink
 */
export class LocalStorage implements StorageAdapter {
  private readonly logger = new Logger(LocalStorage.name);
  private readonly baseDir = resolve(process.cwd(), 'storage-dev');

  async upload(input: UploadFileInput): Promise<UploadFileResult> {
    await mkdir(this.baseDir, { recursive: true });
    const id = randomUUID();
    const safeName = `${id}-${input.filename.replace(/[^\w.\-ก-๙]/g, '_')}`;
    const filePath = join(this.baseDir, safeName);
    await writeFile(filePath, input.buffer);

    this.logger.warn(`[local-storage] saved to ${filePath} (Google Drive not configured)`);
    return {
      driveFileId: `local:${id}`,
      driveLink: `file://${filePath}`,
      mime: input.mime,
    };
  }
}

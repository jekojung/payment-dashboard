import { Logger } from '@nestjs/common';
import { Readable } from 'node:stream';
import { google } from 'googleapis';
import type {
  StorageAdapter,
  UploadFileInput,
  UploadFileResult,
} from './storage-adapter';

export interface GoogleDriveConfig {
  /** service account JSON ทั้งก้อน หรือ path ไปยังไฟล์ */
  serviceAccountJson?: string;
  serviceAccountJsonPath?: string;
  folderId: string;
}

/**
 * GoogleDriveStorage — เก็บรูปทั้งหมดบน Google Drive ด้วย Service Account
 * อัปโหลดเข้าโฟลเดอร์ที่กำหนด, ตั้งสิทธิ์ reader (anyone-with-link) ให้ผู้บริหารเปิดดูได้
 */
export class GoogleDriveStorage implements StorageAdapter {
  private readonly logger = new Logger(GoogleDriveStorage.name);
  private driveClient?: ReturnType<typeof google.drive>;

  constructor(private readonly config: GoogleDriveConfig) {}

  private async drive() {
    if (this.driveClient) return this.driveClient;

    const credentials = this.config.serviceAccountJson
      ? JSON.parse(this.config.serviceAccountJson)
      : undefined;

    const auth = new google.auth.GoogleAuth({
      ...(credentials
        ? { credentials }
        : { keyFile: this.config.serviceAccountJsonPath }),
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    this.driveClient = google.drive({ version: 'v3', auth });
    return this.driveClient;
  }

  async upload(input: UploadFileInput): Promise<UploadFileResult> {
    const drive = await this.drive();

    const file = await drive.files.create({
      requestBody: {
        name: input.filename,
        parents: [this.config.folderId],
      },
      media: {
        mimeType: input.mime,
        body: Readable.from(input.buffer),
      },
      fields: 'id, webViewLink',
    });

    const fileId = file.data.id!;

    // ตั้งสิทธิ์ให้เปิดดูได้ด้วยลิงก์ (ผู้บริหารเปิดจาก Dashboard)
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    });

    const link =
      file.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`;

    this.logger.log(`uploaded ${input.filename} -> ${fileId}`);
    return { driveFileId: fileId, driveLink: link, mime: input.mime };
  }
}

/**
 * StorageAdapter — สัญญาเก็บไฟล์ (ล็อกเป็น Google Drive; มี Local fallback สำหรับ dev)
 */
export const STORAGE_ADAPTER = Symbol('STORAGE_ADAPTER');

export interface UploadFileInput {
  buffer: Buffer;
  filename: string;
  mime: string;
}

export interface UploadFileResult {
  driveFileId: string;
  driveLink: string;
  mime: string;
}

export interface StorageAdapter {
  upload(input: UploadFileInput): Promise<UploadFileResult>;
}

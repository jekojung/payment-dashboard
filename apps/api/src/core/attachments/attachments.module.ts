import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { GoogleDriveStorage } from './storage/google-drive.storage';
import { LocalStorage } from './storage/local.storage';
import { STORAGE_ADAPTER, type StorageAdapter } from './storage/storage-adapter';

/**
 * AttachmentsModule — global
 * เลือก storage adapter จาก env: ถ้าตั้งค่า Google Drive ครบ ใช้ GoogleDriveStorage,
 * ไม่งั้น fallback LocalStorage (dev)
 */
@Global()
@Module({
  controllers: [AttachmentsController],
  providers: [
    AttachmentsService,
    {
      provide: STORAGE_ADAPTER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): StorageAdapter => {
        const logger = new Logger('StorageAdapter');
        const folderId = config.get<string>('GDRIVE_FOLDER_ID');
        const json = config.get<string>('GOOGLE_SERVICE_ACCOUNT_JSON');
        const jsonPath = config.get<string>('GOOGLE_SERVICE_ACCOUNT_JSON_PATH');

        const hasCreds = Boolean(folderId) && (Boolean(json) || Boolean(jsonPath));
        if (hasCreds) {
          logger.log('using GoogleDriveStorage');
          return new GoogleDriveStorage({
            serviceAccountJson: json || undefined,
            serviceAccountJsonPath: jsonPath || undefined,
            folderId: folderId!,
          });
        }
        logger.warn('Google Drive not configured — using LocalStorage (dev only)');
        return new LocalStorage();
      },
    },
  ],
  exports: [AttachmentsService, STORAGE_ADAPTER],
})
export class AttachmentsModule {}

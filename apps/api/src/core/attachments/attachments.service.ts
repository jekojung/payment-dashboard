import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  STORAGE_ADAPTER,
  type StorageAdapter,
  type UploadFileInput,
} from './storage/storage-adapter';

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
  ) {}

  /** อัปโหลดไฟล์ขึ้น storage แล้วผูกกับ owner (polymorphic) */
  async createForOwner(params: {
    ownerType: string;
    ownerId: string;
    file: UploadFileInput;
    uploadedById?: string | null;
  }) {
    const uploaded = await this.storage.upload(params.file);
    return this.prisma.attachment.create({
      data: {
        ownerType: params.ownerType,
        ownerId: params.ownerId,
        driveFileId: uploaded.driveFileId,
        driveLink: uploaded.driveLink,
        mime: uploaded.mime,
        uploadedById: params.uploadedById ?? null,
      },
    });
  }

  listForOwner(ownerType: string, ownerId: string) {
    return this.prisma.attachment.findMany({
      where: { ownerType, ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { JwtAuthGuard } from './core/auth/jwt-auth.guard';
import { AuthModule } from './core/auth/auth.module';
import { RbacModule } from './core/rbac/rbac.module';
import { PermissionsGuard } from './core/rbac/permissions.guard';
import { UsersModule } from './core/users/users.module';
import { AuditModule } from './core/audit/audit.module';
import { LineModule } from './core/line/line.module';
import { NotificationsModule } from './core/notifications/notifications.module';
import { AttachmentsModule } from './core/attachments/attachments.module';
import { MasterdataModule } from './core/masterdata/masterdata.module';
import { RegistryModule } from './core/modules/registry.module';
import { RegistryService } from './core/modules/registry.service';
import { ReturnsDiscountModule } from './modules/returns-discount/returns-discount.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    PrismaModule,
    RbacModule,
    AuditModule,
    // LineModule ก่อน NotificationsModule เพื่อให้ LINE_PUSH_PORT พร้อมใช้
    LineModule,
    NotificationsModule,
    AttachmentsModule,
    RegistryModule,
    AuthModule,
    UsersModule,
    MasterdataModule,
    // โมดูลธุรกิจ (ลงทะเบียนผ่าน Registry)
    ReturnsDiscountModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly registry: RegistryService) {}

  async onModuleInit(): Promise<void> {
    await this.registry.syncToDatabase();
  }
}

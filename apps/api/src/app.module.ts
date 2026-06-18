import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

/**
 * AppModule — core platform root.
 * โมดูล core (auth, rbac, users, modules registry, audit, attachments,
 * notifications, masterdata, line) และโมดูลธุรกิจ (returns-discount)
 * จะถูกเสียบเข้ามาในขั้นที่ 3 เป็นต้นไป
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
})
export class AppModule {}

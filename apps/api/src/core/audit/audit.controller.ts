import { Controller, Get, Query } from '@nestjs/common';
import { Permissions } from '@tpg/shared';
import { RequirePermissions } from '../../common/decorators';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions(Permissions.CORE.VIEW_AUDIT)
  list(
    @Query('moduleKey') moduleKey?: string,
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
    @Query('userId') userId?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.audit.list({
      moduleKey,
      entity,
      entityId,
      userId,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }
}

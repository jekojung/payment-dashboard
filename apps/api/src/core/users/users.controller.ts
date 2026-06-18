import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import {
  createUserSchema,
  updateUserSchema,
  Permissions,
  type CreateUserInput,
  type UpdateUserInput,
} from '@tpg/shared';
import { RequirePermissions } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { AuditService } from '../audit/audit.service';
import { UsersService } from './users.service';

@Controller('users')
@RequirePermissions(Permissions.CORE.MANAGE_USERS)
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.users.get(id);
  }

  @Post()
  async create(@Body(new ZodValidationPipe(createUserSchema)) body: CreateUserInput) {
    const user = await this.users.create(body);
    await this.audit.log({ action: 'user.create', entity: 'user', entityId: user.id });
    return user;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateUserSchema)) body: UpdateUserInput,
  ) {
    const user = await this.users.update(id, body);
    await this.audit.log({ action: 'user.update', entity: 'user', entityId: id });
    return user;
  }

  @Delete(':id/line-binding')
  async unbindLine(@Param('id') id: string) {
    const user = await this.users.unbindLine(id);
    await this.audit.log({ action: 'user.line_unbind', entity: 'user', entityId: id });
    return user;
  }
}

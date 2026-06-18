import { RbacService } from './rbac.service';

describe('RbacService.hasPermissions', () => {
  const service = new RbacService(null as never);

  it('อนุญาตทุก permission เมื่อเป็น system_admin', () => {
    const access = { roles: ['system_admin'], permissions: [], isSystemAdmin: true };
    expect(service.hasPermissions(access, ['returns_discount:disposal'])).toBe(true);
  });

  it('ผ่านเมื่อมี permission ครบ', () => {
    const access = {
      roles: ['warehouse_staff'],
      permissions: ['returns_discount:receive', 'returns_discount:disposal'],
      isSystemAdmin: false,
    };
    expect(service.hasPermissions(access, ['returns_discount:receive'])).toBe(true);
  });

  it('ไม่ผ่านเมื่อขาด permission', () => {
    const access = {
      roles: ['sales_staff'],
      permissions: ['returns_discount:create'],
      isSystemAdmin: false,
    };
    expect(service.hasPermissions(access, ['returns_discount:approve_special'])).toBe(false);
  });

  it('ผ่านเมื่อไม่ต้องการ permission ใด ๆ', () => {
    const access = { roles: [], permissions: [], isSystemAdmin: false };
    expect(service.hasPermissions(access, [])).toBe(true);
  });
});

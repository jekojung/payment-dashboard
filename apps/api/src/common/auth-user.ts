/** ข้อมูลผู้ใช้ที่แนบกับ request หลังผ่าน JWT */
export interface AuthUser {
  id: string;
  employeeCode: string;
  name: string;
  roles: string[];
  permissions: string[];
  isSystemAdmin: boolean;
}

/** payload ภายใน JWT */
export interface JwtPayload {
  sub: string;
  employeeCode: string;
  name: string;
}

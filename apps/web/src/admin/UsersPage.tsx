import { useState } from 'react';
import { RoleKey } from '@tpg/shared';
import { api, apiError } from '../core/api/client';
import { useApi } from '../core/hooks/useApi';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  PageHeader,
  Spinner,
  Table,
  Td,
  Th,
} from '../core/ui';

interface User {
  id: string;
  employeeCode: string;
  name: string;
  department: string | null;
  lineUserId: string | null;
  isActive: boolean;
  createdAt: string;
  roles: { key: string; name: string }[];
}

const roleLabels: Record<string, string> = {
  system_admin: 'ผู้ดูแลระบบ',
  executive: 'ผู้บริหาร',
  sales_lead: 'หัวหน้าขาย',
  warehouse_lead: 'หัวหน้าคลัง',
  sales_staff: 'พนักงานขาย',
  warehouse_staff: 'พนักงานคลัง',
  transport_lead: 'หัวหน้าขนส่ง',
  transport_staff: 'พนักงานขนส่ง',
};

const roleLabel = (key: string) => roleLabels[key] ?? key;

function RoleCheckboxes({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const toggle = (key: string) => {
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      {Object.values(RoleKey).map((key) => (
        <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={value.includes(key)} onChange={() => toggle(key)} />
          {roleLabel(key)}
        </label>
      ))}
    </div>
  );
}

function CreateModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [employeeCode, setEmployeeCode] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [department, setDepartment] = useState('');
  const [roleKeys, setRoleKeys] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api.post('/users', {
        employeeCode,
        name,
        ...(password ? { password } : {}),
        ...(department ? { department } : {}),
        roleKeys,
      });
      onSaved();
      onClose();
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="เพิ่มผู้ใช้">
      <div className="space-y-4">
        {err && <ErrorState message={err} />}
        <Field label="รหัสพนักงาน">
          <Input value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} />
        </Field>
        <Field label="ชื่อ">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="รหัสผ่าน" hint="เว้นว่างได้">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="แผนก" hint="ไม่บังคับ">
          <Input value={department} onChange={(e) => setDepartment(e.target.value)} />
        </Field>
        <Field label="บทบาท">
          <RoleCheckboxes value={roleKeys} onChange={setRoleKeys} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button onClick={save} disabled={busy || !employeeCode || !name}>
            {busy ? 'กำลังบันทึก…' : 'บันทึก'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function EditModal({ row, onClose, onSaved }: { row: User; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(row.name);
  const [department, setDepartment] = useState(row.department ?? '');
  const [isActive, setIsActive] = useState(row.isActive);
  const [lineUserId, setLineUserId] = useState(row.lineUserId ?? '');
  const [password, setPassword] = useState('');
  const [roleKeys, setRoleKeys] = useState<string[]>(row.roles.map((r) => r.key));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api.patch(`/users/${row.id}`, {
        name,
        department: department || null,
        isActive,
        roleKeys,
        ...(lineUserId ? { lineUserId } : {}),
        ...(password ? { password } : {}),
      });
      onSaved();
      onClose();
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="แก้ไขผู้ใช้">
      <div className="space-y-4">
        {err && <ErrorState message={err} />}
        <div className="text-sm text-slate-500">รหัสพนักงาน: {row.employeeCode}</div>
        <Field label="ชื่อ">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="แผนก" hint="ไม่บังคับ">
          <Input value={department} onChange={(e) => setDepartment(e.target.value)} />
        </Field>
        <Field label="LINE User ID" hint="ไม่บังคับ">
          <Input value={lineUserId} onChange={(e) => setLineUserId(e.target.value)} />
        </Field>
        <Field label="รหัสผ่านใหม่" hint="กรอกเฉพาะเมื่อต้องการเปลี่ยน">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="บทบาท">
          <RoleCheckboxes value={roleKeys} onChange={setRoleKeys} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          ใช้งาน/ปิดใช้งาน
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button onClick={save} disabled={busy || !name}>
            {busy ? 'กำลังบันทึก…' : 'บันทึก'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function UsersPage() {
  const { data, loading, error, reload } = useApi<User[]>('/users');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  const unbindLine = async (id: string) => {
    try {
      await api.delete(`/users/${id}/line-binding`);
      reload();
    } catch {
      reload();
    }
  };

  return (
    <div>
      <PageHeader
        title="ผู้ใช้งาน"
        subtitle="จัดการบัญชีผู้ใช้และบทบาท"
        actions={<Button onClick={() => setCreating(true)}>เพิ่มผู้ใช้</Button>}
      />

      <Card>
        {loading ? (
          <Spinner />
        ) : error ? (
          <div className="p-4">
            <ErrorState message={error} />
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState message="ไม่มีผู้ใช้งาน" />
        ) : (
          <Table>
            <thead>
              <tr className="border-b border-slate-100">
                <Th>รหัสพนักงาน</Th>
                <Th>ชื่อ</Th>
                <Th>แผนก</Th>
                <Th>บทบาท</Th>
                <Th>LINE</Th>
                <Th>สถานะ</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-slate-800">{u.employeeCode}</Td>
                  <Td>{u.name}</Td>
                  <Td>{u.department ?? '-'}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <Badge key={r.key} tone="indigo">
                          {roleLabel(r.key)}
                        </Badge>
                      ))}
                    </div>
                  </Td>
                  <Td>{u.lineUserId ? <Badge tone="green">ผูกแล้ว</Badge> : '-'}</Td>
                  <Td>
                    {u.isActive ? <Badge tone="green">ใช้งาน</Badge> : <Badge tone="slate">ปิด</Badge>}
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" onClick={() => setEditing(u)}>
                        แก้ไข
                      </Button>
                      {u.lineUserId && (
                        <Button variant="ghost" onClick={() => unbindLine(u.id)}>
                          ลบการผูก LINE
                        </Button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {creating && <CreateModal onClose={() => setCreating(false)} onSaved={reload} />}
      {editing && <EditModal row={editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </div>
  );
}

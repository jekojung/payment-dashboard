import { useState } from 'react';
import { CounterpartyKind } from '@tpg/shared';
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
  Select,
  Spinner,
  Table,
  Td,
  Th,
} from '../core/ui';

interface Reason {
  id: string;
  code: string;
  name: string;
  counterpartyKind: string;
  isActive: boolean;
}

const kindLabels: Record<string, string> = {
  supplier: 'ผู้ขายเดิม',
  buyer: 'ผู้รับซื้อ',
  none: 'ไม่มี',
};

const kindLabel = (k: string) => kindLabels[k] ?? k;

function ReasonModal({ row, onClose, onSaved }: { row: Reason | null; onClose: () => void; onSaved: () => void }) {
  const [code, setCode] = useState(row?.code ?? '');
  const [name, setName] = useState(row?.name ?? '');
  const [counterpartyKind, setCounterpartyKind] = useState(row?.counterpartyKind ?? CounterpartyKind.NONE);
  const [isActive, setIsActive] = useState(row?.isActive ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const payload = { code, name, counterpartyKind, isActive };
      if (row) await api.patch(`/masterdata/disposal-reasons/${row.id}`, payload);
      else await api.post('/masterdata/disposal-reasons', payload);
      onSaved();
      onClose();
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={row ? 'แก้ไขเหตุผลการตัดจำหน่าย' : 'เพิ่มเหตุผลการตัดจำหน่าย'}>
      <div className="space-y-4">
        {err && <ErrorState message={err} />}
        <Field label="รหัส">
          <Input value={code} onChange={(e) => setCode(e.target.value)} />
        </Field>
        <Field label="ชื่อ">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="ชนิดคู่ค้า">
          <Select value={counterpartyKind} onChange={(e) => setCounterpartyKind(e.target.value)}>
            {Object.values(CounterpartyKind).map((k) => (
              <option key={k} value={k}>
                {kindLabel(k)}
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          ใช้งาน
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button onClick={save} disabled={busy || !code || !name}>
            {busy ? 'กำลังบันทึก…' : 'บันทึก'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function DisposalReasonsPage() {
  const { data, loading, error, reload } = useApi<Reason[]>('/masterdata/disposal-reasons');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Reason | null>(null);

  return (
    <div>
      <PageHeader
        title="เหตุผลการตัดจำหน่าย"
        subtitle="จัดการเหตุผลการตัดสต็อก"
        actions={<Button onClick={() => setCreating(true)}>เพิ่มเหตุผล</Button>}
      />

      <Card>
        {loading ? (
          <Spinner />
        ) : error ? (
          <div className="p-4">
            <ErrorState message={error} />
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState message="ไม่มีเหตุผลการตัดจำหน่าย" />
        ) : (
          <Table>
            <thead>
              <tr className="border-b border-slate-100">
                <Th>รหัส</Th>
                <Th>ชื่อ</Th>
                <Th>ชนิดคู่ค้า</Th>
                <Th>สถานะ</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-slate-800">{r.code}</Td>
                  <Td>{r.name}</Td>
                  <Td>{kindLabel(r.counterpartyKind)}</Td>
                  <Td>
                    {r.isActive ? <Badge tone="green">ใช้งาน</Badge> : <Badge tone="slate">ปิด</Badge>}
                  </Td>
                  <Td className="text-right">
                    <Button variant="ghost" onClick={() => setEditing(r)}>
                      แก้ไข
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {creating && <ReasonModal row={null} onClose={() => setCreating(false)} onSaved={reload} />}
      {editing && <ReasonModal row={editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Permissions, SaleValueStatus } from '@tpg/shared';
import { api, apiError } from '../../core/api/client';
import { useApi } from '../../core/hooks/useApi';
import { useAuth } from '../../core/auth/AuthContext';
import {
  Badge,
  Button,
  Card,
  CardBody,
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
} from '../../core/ui';
import { baht, counterpartyTypeLabel, formatDate, num, saleValueLabel } from '../../core/lib/format';

interface Disposal {
  id: string;
  quantityChange: number;
  createdAt: string;
  counterpartyType: string | null;
  counterpartyName: string | null;
  saleValue: string | null;
  saleValueStatus: string | null;
  product: { name: string };
  productModel: { name: string } | null;
  disposalReason: { name: string } | null;
  createdBy: { name: string };
  saleValueBy: { name: string } | null;
}
interface Reason {
  id: string;
  name: string;
}

function SaleValueModal({ row, onClose, onSaved }: { row: Disposal; onClose: () => void; onSaved: () => void }) {
  const [value, setValue] = useState(row.saleValue ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/returns-discount/disposals/${row.id}/sale-value`, { saleValue: Number(value) });
      onSaved();
      onClose();
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="บันทึกมูลค่าขาย">
      <div className="space-y-4">
        {err && <ErrorState message={err} />}
        <div className="text-sm text-slate-600">
          {row.product.name}
          {row.productModel ? ` (${row.productModel.name})` : ''} · จำนวน {num(Math.abs(row.quantityChange))} หน่วย
          <br />
          เหตุผล: {row.disposalReason?.name} · คู่ค้า: {row.counterpartyName ?? '-'}
        </div>
        <Field label="มูลค่าขาย (บาท)">
          <Input
            type="number"
            min={0}
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0.00"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button onClick={save} disabled={busy || value === ''}>
            {busy ? 'กำลังบันทึก…' : 'บันทึก'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function DisposalPage() {
  const { can } = useAuth();
  const canSetValue = can(Permissions.RETURNS_DISCOUNT.SET_SALE_VALUE);
  const [reasonId, setReasonId] = useState('');
  const [svStatus, setSvStatus] = useState('');
  const [editing, setEditing] = useState<Disposal | null>(null);

  const reasons = useApi<Reason[]>('/masterdata/disposal-reasons');
  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (reasonId) p.set('reasonId', reasonId);
    if (svStatus) p.set('saleValueStatus', svStatus);
    const s = p.toString();
    return `/returns-discount/disposals${s ? `?${s}` : ''}`;
  }, [reasonId, svStatus]);
  const { data, loading, error, reload } = useApi<Disposal[]>(query, [query]);

  return (
    <div>
      <PageHeader title="การตัดจำหน่าย" subtitle="รายการตัดสต็อกสินค้ารับเทิร์น" />

      <Card className="mb-4">
        <CardBody>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="เหตุผล">
              <Select value={reasonId} onChange={(e) => setReasonId(e.target.value)}>
                <option value="">ทั้งหมด</option>
                {reasons.data?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="สถานะมูลค่าขาย">
              <Select value={svStatus} onChange={(e) => setSvStatus(e.target.value)}>
                <option value="">ทั้งหมด</option>
                <option value={SaleValueStatus.PENDING}>รอบันทึกมูลค่า</option>
                <option value={SaleValueStatus.RECORDED}>บันทึกแล้ว</option>
              </Select>
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        {loading ? (
          <Spinner />
        ) : error ? (
          <div className="p-4">
            <ErrorState message={error} />
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState message="ไม่มีรายการตัดจำหน่าย" />
        ) : (
          <Table>
            <thead>
              <tr className="border-b border-slate-100">
                <Th>วันที่</Th>
                <Th>สินค้า</Th>
                <Th className="text-right">จำนวน</Th>
                <Th>เหตุผล</Th>
                <Th>คู่ค้าปลายทาง</Th>
                <Th className="text-right">มูลค่าขาย</Th>
                <Th>สถานะ</Th>
                {canSetValue && <Th></Th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.map((d) => {
                const sv = d.saleValueStatus ? saleValueLabel[d.saleValueStatus] : null;
                return (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <Td className="text-slate-500">{formatDate(d.createdAt)}</Td>
                    <Td className="font-medium text-slate-800">
                      {d.product.name}
                      {d.productModel ? ` (${d.productModel.name})` : ''}
                    </Td>
                    <Td className="text-right text-red-600">{num(Math.abs(d.quantityChange))}</Td>
                    <Td>{d.disposalReason?.name ?? '-'}</Td>
                    <Td>
                      {d.counterpartyName ?? '-'}
                      {d.counterpartyType && (
                        <span className="ml-1 text-xs text-slate-400">
                          ({counterpartyTypeLabel[d.counterpartyType]})
                        </span>
                      )}
                    </Td>
                    <Td className="text-right">{d.saleValue != null ? `${baht(d.saleValue)} ฿` : '-'}</Td>
                    <Td>{sv && <Badge tone={sv.tone}>{sv.text}</Badge>}</Td>
                    {canSetValue && (
                      <Td className="text-right">
                        <Button variant="ghost" onClick={() => setEditing(d)}>
                          {d.saleValueStatus === SaleValueStatus.RECORDED ? 'แก้ไข' : 'บันทึกมูลค่า'}
                        </Button>
                      </Td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {editing && <SaleValueModal row={editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </div>
  );
}

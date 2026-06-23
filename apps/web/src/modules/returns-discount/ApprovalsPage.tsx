import { useState } from 'react';
import { api, apiError } from '../../core/api/client';
import { useApi } from '../../core/hooks/useApi';
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
} from '../../core/ui';
import { baht, formatDate, num } from '../../core/lib/format';

interface PendingItem {
  id: string;
  declaredQuantity: number;
  discountPerUnit: string;
  totalDiscount: string;
  standardDiscountSnapshot: string;
  createdAt: string;
  product: { name: string };
  productModel: { name: string } | null;
  returnDocument: { gdNumber: string; customerName: string | null; customerCode: string };
}

export function ApprovalsPage() {
  const { data, loading, error, reload } = useApi<PendingItem[]>('/returns-discount/items/pending-approvals');
  const [rejecting, setRejecting] = useState<PendingItem | null>(null);
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const approve = async (id: string) => {
    setBusyId(id);
    setActionError(null);
    try {
      await api.post(`/returns-discount/items/${id}/approve`);
      reload();
    } catch (e) {
      setActionError(apiError(e));
    } finally {
      setBusyId(null);
    }
  };

  const submitReject = async () => {
    if (!rejecting) return;
    setBusyId(rejecting.id);
    setActionError(null);
    try {
      await api.post(`/returns-discount/items/${rejecting.id}/reject`, { reason: reason.trim() });
      setRejecting(null);
      setReason('');
      reload();
    } catch (e) {
      setActionError(apiError(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <PageHeader title="รออนุมัติพิเศษ" subtitle="ส่วนลดเกินมาตรฐานที่รอการอนุมัติ" />

      {actionError && (
        <div className="mb-4">
          <ErrorState message={actionError} />
        </div>
      )}

      <Card>
        {loading ? (
          <Spinner />
        ) : error ? (
          <div className="p-4">
            <ErrorState message={error} />
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState message="ไม่มีรายการรออนุมัติ" />
        ) : (
          <Table>
            <thead>
              <tr className="border-b border-slate-100">
                <Th>ใบ GD</Th>
                <Th>สินค้า</Th>
                <Th className="text-right">จำนวน</Th>
                <Th className="text-right">ส่วนลด/หน่วย</Th>
                <Th className="text-right">มาตรฐาน</Th>
                <Th className="text-right">รวม</Th>
                <Th>วันที่</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.map((it) => (
                <tr key={it.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-slate-800">{it.returnDocument.gdNumber}</Td>
                  <Td>
                    {it.product.name}
                    {it.productModel ? ` (${it.productModel.name})` : ''}
                  </Td>
                  <Td className="text-right">{num(it.declaredQuantity)}</Td>
                  <Td className="text-right text-red-600">{baht(it.discountPerUnit)}</Td>
                  <Td className="text-right text-slate-500">{baht(it.standardDiscountSnapshot)}</Td>
                  <Td className="text-right font-medium">{baht(it.totalDiscount)}</Td>
                  <Td className="text-slate-500">{formatDate(it.createdAt)}</Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      <Button onClick={() => approve(it.id)} disabled={busyId === it.id}>
                        อนุมัติ
                      </Button>
                      <Button variant="danger" onClick={() => setRejecting(it)} disabled={busyId === it.id}>
                        ปฏิเสธ
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title="ปฏิเสธส่วนลดพิเศษ">
        <div className="space-y-4">
          <div className="text-sm text-slate-600">
            ใบ GD {rejecting?.returnDocument.gdNumber} — {rejecting?.product.name}
          </div>
          <Field label="เหตุผลการปฏิเสธ">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ระบุเหตุผล" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRejecting(null)}>
              ยกเลิก
            </Button>
            <Button variant="danger" onClick={submitReject} disabled={!reason.trim() || busyId === rejecting?.id}>
              ยืนยันปฏิเสธ
            </Button>
          </div>
        </div>
      </Modal>

      <div className="mt-3 text-xs text-slate-400">
        <Badge tone="amber">หมายเหตุ</Badge> เมื่ออนุมัติแล้ว รายการจะพร้อมให้คลังรับเข้า
      </div>
    </div>
  );
}

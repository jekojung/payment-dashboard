import { useEffect, useState } from 'react';
import { api } from '../../core/api/client';
import { useApi } from '../../core/hooks/useApi';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Modal,
  PageHeader,
  Spinner,
  Table,
  Td,
  Th,
} from '../../core/ui';
import { formatDateTime, num } from '../../core/lib/format';

interface Balance {
  productId: string;
  productName: string;
  productModelId: string | null;
  modelName: string | null;
  balance: number;
}
interface Movement {
  id: string;
  movementType: string;
  quantityChange: number;
  createdAt: string;
  counterpartyName: string | null;
  disposalReason: { name: string } | null;
  createdBy: { name: string };
}

function LedgerModal({ row, onClose }: { row: Balance; onClose: () => void }) {
  const [moves, setMoves] = useState<Movement[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams({ productId: row.productId });
    if (row.productModelId) p.set('productModelId', row.productModelId);
    api
      .get<Movement[]>(`/returns-discount/stock/ledger?${p.toString()}`)
      .then((r) => setMoves(r.data))
      .catch(() => setErr('โหลดประวัติไม่สำเร็จ'));
  }, [row.productId, row.productModelId]);

  return (
    <Modal open onClose={onClose} title={`ประวัติสต็อก: ${row.productName}${row.modelName ? ` (${row.modelName})` : ''}`}>
      {err ? (
        <ErrorState message={err} />
      ) : !moves ? (
        <Spinner />
      ) : moves.length === 0 ? (
        <EmptyState message="ไม่มีประวัติ" />
      ) : (
        <Table>
          <thead>
            <tr className="border-b border-slate-100">
              <Th>วันที่</Th>
              <Th>ประเภท</Th>
              <Th className="text-right">จำนวน</Th>
              <Th>หมายเหตุ</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {moves.map((m) => (
              <tr key={m.id}>
                <Td className="text-slate-500">{formatDateTime(m.createdAt)}</Td>
                <Td>
                  {m.movementType === 'receipt' ? (
                    <Badge tone="green">รับเข้า</Badge>
                  ) : (
                    <Badge tone="red">ตัดจำหน่าย</Badge>
                  )}
                </Td>
                <Td className={`text-right font-medium ${m.quantityChange < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {m.quantityChange > 0 ? '+' : ''}
                  {num(m.quantityChange)}
                </Td>
                <Td className="text-slate-500">
                  {m.disposalReason?.name}
                  {m.counterpartyName ? ` · ${m.counterpartyName}` : ''}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Modal>
  );
}

export function StockPage() {
  const { data, loading, error } = useApi<Balance[]>('/returns-discount/stock');
  const [selected, setSelected] = useState<Balance | null>(null);

  return (
    <div>
      <PageHeader title="สต็อกสินค้ารับเทิร์น" subtitle="ยอดคงเหลือต่อสินค้า/รุ่น" />

      <Card>
        {loading ? (
          <Spinner />
        ) : error ? (
          <div className="p-4">
            <ErrorState message={error} />
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState message="ไม่มีสินค้าคงเหลือ" />
        ) : (
          <Table>
            <thead>
              <tr className="border-b border-slate-100">
                <Th>สินค้า</Th>
                <Th>รุ่น</Th>
                <Th className="text-right">คงเหลือ (หน่วย)</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.map((b) => (
                <tr key={`${b.productId}-${b.productModelId ?? 'none'}`} className="hover:bg-slate-50">
                  <Td className="font-medium text-slate-800">{b.productName}</Td>
                  <Td className="text-slate-500">{b.modelName ?? '-'}</Td>
                  <Td className="text-right font-semibold text-slate-900">{num(b.balance)}</Td>
                  <Td className="text-right">
                    <Button variant="ghost" onClick={() => setSelected(b)}>
                      ดูประวัติ
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {selected && <LedgerModal row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

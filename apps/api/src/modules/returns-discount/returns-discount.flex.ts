/**
 * Flex Message builders สำหรับโมดูล 1 (ภาษาไทย)
 * คืน object Flex bubble แบบ plain JSON — LineService จะห่อเป็นข้อความ flex ให้
 */

const BAHT = (n: number) =>
  n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface ItemSummary {
  gdNumber: string;
  customerName: string;
  productName: string;
  modelName?: string | null;
  quantity: number;
  discountPerUnit: number;
  totalDiscount: number;
  standardDiscount: number;
}

function row(label: string, value: string, valueColor = '#111111') {
  return {
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: label, size: 'sm', color: '#888888', flex: 4 },
      { type: 'text', text: value, size: 'sm', color: valueColor, flex: 6, wrap: true, align: 'end' },
    ],
  };
}

function detailRows(s: ItemSummary) {
  const product = s.modelName ? `${s.productName} (${s.modelName})` : s.productName;
  return [
    row('เลขที่ใบ GD', s.gdNumber),
    row('ลูกค้า', s.customerName),
    row('สินค้า', product),
    row('จำนวน', `${s.quantity.toLocaleString('th-TH')} หน่วย`),
    row('ส่วนลด/หน่วย', `${BAHT(s.discountPerUnit)} บาท`),
    row('มาตรฐาน/หน่วย', `${BAHT(s.standardDiscount)} บาท`),
    { type: 'separator', margin: 'md' },
    row('ส่วนลดรวม', `${BAHT(s.totalDiscount)} บาท`, '#111111'),
  ];
}

/** ผลลัพธ์: อยู่ในเกณฑ์ → บันทึกสำเร็จ (ส่งให้ฝ่ายขาย) */
export function buildWithinStandardFlex(s: ItemSummary) {
  return {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#16A34A',
      contents: [
        { type: 'text', text: '✅ บันทึกส่วนลดสำเร็จ', color: '#FFFFFF', weight: 'bold', size: 'lg' },
        { type: 'text', text: 'อยู่ในเกณฑ์มาตรฐาน', color: '#DCFCE7', size: 'sm' },
      ],
    },
    body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: detailRows(s) },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: 'แจ้งคลังให้เตรียมรับสินค้าแล้ว', size: 'xs', color: '#888888', align: 'center' },
      ],
    },
  };
}

/** ผลลัพธ์: เกินมาตรฐาน → ส่งคำขออนุมัติพิเศษแล้ว (ส่งให้ฝ่ายขาย) */
export function buildPendingApprovalFlex(s: ItemSummary) {
  return {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#F59E0B',
      contents: [
        { type: 'text', text: '⏳ ส่งคำขออนุมัติพิเศษแล้ว', color: '#FFFFFF', weight: 'bold', size: 'lg' },
        { type: 'text', text: 'ส่วนลดเกินมาตรฐาน รอหัวหน้าอนุมัติ', color: '#FEF3C7', size: 'sm', wrap: true },
      ],
    },
    body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: detailRows(s) },
  };
}

/** การ์ดอนุมัติ (ส่งให้หัวหน้าผู้มีสิทธิ์ approve_special) — มีปุ่ม postback */
export function buildApprovalRequestFlex(s: ItemSummary & { itemId: string; salesName: string }) {
  return {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#DC2626',
      contents: [
        { type: 'text', text: '🔔 ขออนุมัติส่วนลดพิเศษ', color: '#FFFFFF', weight: 'bold', size: 'lg' },
        { type: 'text', text: `แจ้งโดย ${s.salesName}`, color: '#FECACA', size: 'sm' },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        ...detailRows(s),
        {
          type: 'box',
          layout: 'vertical',
          margin: 'md',
          backgroundColor: '#FEF2F2',
          paddingAll: 'sm',
          cornerRadius: 'md',
          contents: [
            {
              type: 'text',
              text: `เกินมาตรฐาน ${BAHT(s.discountPerUnit - s.standardDiscount)} บาท/หน่วย`,
              size: 'sm',
              color: '#DC2626',
              weight: 'bold',
              wrap: true,
            },
          ],
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'horizontal',
      spacing: 'sm',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: '#16A34A',
          action: {
            type: 'postback',
            label: '✓ อนุมัติ',
            data: `action=rd_approve&itemId=${s.itemId}`,
            displayText: 'อนุมัติส่วนลดพิเศษ',
          },
        },
        {
          type: 'button',
          style: 'primary',
          color: '#DC2626',
          action: {
            type: 'postback',
            label: '✕ ปฏิเสธ',
            data: `action=rd_reject&itemId=${s.itemId}`,
            displayText: 'ปฏิเสธส่วนลดพิเศษ',
          },
        },
      ],
    },
  };
}

/** ผลลัพธ์: ตัดจำหน่ายสำเร็จ (Flow C) */
export function buildDisposalSuccessFlex(d: {
  productName: string;
  modelName?: string | null;
  quantity: number;
  reasonName: string;
  counterpartyName?: string | null;
  balanceAfter: number;
}) {
  const product = d.modelName ? `${d.productName} (${d.modelName})` : d.productName;
  const rows = [
    row('สินค้า', product),
    row('จำนวนที่ตัด', `${d.quantity.toLocaleString('th-TH')} หน่วย`),
    row('เหตุผล', d.reasonName),
  ];
  if (d.counterpartyName) rows.push(row('คู่ค้าปลายทาง', d.counterpartyName));
  rows.push({ type: 'separator', margin: 'md' } as never);
  rows.push(row('คงเหลือใหม่', `${d.balanceAfter.toLocaleString('th-TH')} หน่วย`, '#111111'));

  return {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#0EA5E9',
      contents: [
        { type: 'text', text: '✅ ตัดจำหน่ายสำเร็จ', color: '#FFFFFF', weight: 'bold', size: 'lg' },
      ],
    },
    body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: rows },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: 'ผู้บริหารจะบันทึกมูลค่าขายภายหลัง',
          size: 'xs',
          color: '#888888',
          align: 'center',
        },
      ],
    },
  };
}

/** สรุปยอดคงเหลือสต็อกรับเทิร์น (Flow D) */
export function buildStockSummaryFlex(
  balances: { productName: string; modelName?: string | null; balance: number }[],
) {
  const lines =
    balances.length === 0
      ? [{ type: 'text', text: 'ไม่มีสินค้าคงเหลือ', size: 'sm', color: '#888888' }]
      : balances.slice(0, 20).map((b) =>
          row(
            b.modelName ? `${b.productName} (${b.modelName})` : b.productName,
            `${b.balance.toLocaleString('th-TH')} หน่วย`,
          ),
        );
  return {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#334155',
      contents: [
        { type: 'text', text: '📊 สต็อกสินค้ารับเทิร์น', color: '#FFFFFF', weight: 'bold', size: 'lg' },
      ],
    },
    body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: lines },
  };
}

/** แจ้งผลอนุมัติ/ปฏิเสธกลับฝ่ายขาย */
export function buildApprovalResultFlex(opts: {
  approved: boolean;
  gdNumber: string;
  productName: string;
  approverName: string;
  reason?: string;
}) {
  const color = opts.approved ? '#16A34A' : '#DC2626';
  const title = opts.approved ? '✅ อนุมัติส่วนลดพิเศษแล้ว' : '🚫 ไม่อนุมัติส่วนลดพิเศษ';
  const body = [
    row('เลขที่ใบ GD', opts.gdNumber),
    row('สินค้า', opts.productName),
    row(opts.approved ? 'อนุมัติโดย' : 'ปฏิเสธโดย', opts.approverName),
  ];
  if (!opts.approved && opts.reason) {
    body.push(row('เหตุผล', opts.reason, '#DC2626'));
  }
  return {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: color,
      contents: [{ type: 'text', text: title, color: '#FFFFFF', weight: 'bold', size: 'md', wrap: true }],
    },
    body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: body },
  };
}

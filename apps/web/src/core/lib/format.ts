import {
  ApprovalStatus,
  DiscountStatus,
  ReceiptStatus,
  ReturnDocumentStatus,
  SaleValueStatus,
} from '@tpg/shared';

export const baht = (n: number | string) =>
  Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const num = (n: number | string) => Number(n).toLocaleString('th-TH');

export const formatDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Bangkok',
  });

export const formatDateTime = (d: string | Date) =>
  new Date(d).toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  });

type BadgeTone = 'green' | 'amber' | 'red' | 'blue' | 'slate' | 'indigo';

export const docStatusLabel: Record<string, { text: string; tone: BadgeTone }> = {
  [ReturnDocumentStatus.RECORDED]: { text: 'บันทึกแล้ว', tone: 'slate' },
  [ReturnDocumentStatus.PARTIALLY_RECEIVED]: { text: 'รับบางส่วน', tone: 'amber' },
  [ReturnDocumentStatus.FULLY_RECEIVED]: { text: 'รับครบแล้ว', tone: 'green' },
};

export const approvalLabel: Record<string, { text: string; tone: BadgeTone }> = {
  [ApprovalStatus.NOT_REQUIRED]: { text: 'ไม่ต้องอนุมัติ', tone: 'slate' },
  [ApprovalStatus.PENDING]: { text: 'รออนุมัติ', tone: 'amber' },
  [ApprovalStatus.APPROVED]: { text: 'อนุมัติแล้ว', tone: 'green' },
  [ApprovalStatus.REJECTED]: { text: 'ปฏิเสธ', tone: 'red' },
};

export const receiptLabel: Record<string, { text: string; tone: BadgeTone }> = {
  [ReceiptStatus.PENDING_RECEIPT]: { text: 'รอรับ', tone: 'amber' },
  [ReceiptStatus.RECEIVED]: { text: 'รับแล้ว', tone: 'green' },
};

export const discountLabel: Record<string, { text: string; tone: BadgeTone }> = {
  [DiscountStatus.WITHIN_STANDARD]: { text: 'ในเกณฑ์', tone: 'green' },
  [DiscountStatus.OVER_STANDARD]: { text: 'เกินมาตรฐาน', tone: 'red' },
};

export const saleValueLabel: Record<string, { text: string; tone: BadgeTone }> = {
  [SaleValueStatus.PENDING]: { text: 'รอบันทึกมูลค่า', tone: 'amber' },
  [SaleValueStatus.RECORDED]: { text: 'บันทึกแล้ว', tone: 'green' },
};

export const counterpartyTypeLabel: Record<string, string> = {
  supplier: 'ผู้ขายเดิม',
  buyer: 'ผู้รับซื้อ',
};

import { PaymentInvoice, PaymentMethod, PaymentStatus } from '@/types';

/**
 * Mock Database lưu trữ dữ liệu Hóa đơn & Thanh toán viện phí / xe cấp cứu
 */
const INITIAL_INVOICES: Record<string, PaymentInvoice> = {
  '102': {
    id: 'inv-102',
    invoiceCode: 'HDCC-2026-00102',
    callId: 102,
    requestId: 20,
    missionId: 11,
    patientName: 'Phan Văn Nam',
    patientPhone: '0904000002',
    pickupAddress: 'Trường Đại học Thủy Lợi, 175 Tây Sơn, Đống Đa, Hà Nội',
    hospitalAddress: 'Bệnh viện Đại học Y Hà Nội, Số 1 Tôn Thất Tùng, Đống Đa, Hà Nội',
    distanceKm: 4.8,
    vehicleType: 'Xe Cấp Cứu Hồi Sức Tích Cực (ALS ICU)',
    licensePlate: '29A-11111',
    items: [
      { name: 'Phí khởi động & điều phối xe cấp cứu 115', quantity: 1, unitPrice: 250000, totalPrice: 250000 },
      { name: 'Cước di chuyển thực tế (4.8 km x 25.000đ/km)', quantity: 4.8, unitPrice: 25000, totalPrice: 120000 },
      { name: 'Kíp cấp cứu & trang thiết bị thở Oxy áp lực cao', quantity: 1, unitPrice: 180000, totalPrice: 180000 },
      { name: 'Chiết khấu BHYT / Trợ cấp khẩn cấp Nhà nước (30%)', quantity: 1, unitPrice: -165000, totalPrice: -165000, isDiscount: true },
    ],
    subtotal: 550000,
    discountAmount: 165000,
    totalAmount: 385000,
    paymentStatus: 'PAID',
    paymentMethod: 'VIETQR',
    transactionRef: 'VQR20260824161502',
    createdAt: '2026-08-23T13:56:23.000Z',
    paidAt: '2026-08-24T16:15:00.000Z',
    notes: 'Đã thanh toán thành công qua chuyển khoản quét mã VietQR ngân hàng.',
  },
  '101': {
    id: 'inv-101',
    invoiceCode: 'HDCC-2026-00101',
    callId: 101,
    requestId: 19,
    missionId: 10,
    patientName: 'Phan Văn Nam',
    patientPhone: '0904000002',
    pickupAddress: '88 Láng Hạ, Đống Đa, Hà Nội',
    hospitalAddress: 'Bệnh viện Bạch Mai, 78 Giải Phóng, Đống Đa, Hà Nội',
    distanceKm: 3.2,
    vehicleType: 'Xe Cấp Cứu Tiêu Chuẩn (BLS)',
    licensePlate: '29A-22222',
    items: [
      { name: 'Phí khởi động & điều phối xe cấp cứu 115', quantity: 1, unitPrice: 200000, totalPrice: 200000 },
      { name: 'Cước di chuyển thực tế (3.2 km x 22.000đ/km)', quantity: 3.2, unitPrice: 22000, totalPrice: 70400 },
      { name: 'Chiết khấu BHYT (30%)', quantity: 1, unitPrice: -81120, totalPrice: -81120, isDiscount: true },
    ],
    subtotal: 270400,
    discountAmount: 81120,
    totalAmount: 189280,
    paymentStatus: 'PAID',
    paymentMethod: 'VNPAY',
    transactionRef: 'VNPAY987216',
    createdAt: '2026-08-22T14:28:41.000Z',
    paidAt: '2026-08-22T15:10:00.000Z',
    notes: 'Thanh toán qua cổng VNPay-QR.',
  },
};

// In-memory Database Store
let invoicesDatabase: Record<string, PaymentInvoice> = { ...INITIAL_INVOICES };

export const paymentMockService = {
  /**
   * Lấy hóa đơn theo mã cuộc gọi (callId). Nếu chưa có thì tự động tạo hóa đơn mock hợp lý
   */
  getInvoiceByCallId(callId: string | number, extra?: Partial<PaymentInvoice>): PaymentInvoice {
    const key = String(callId);
    if (invoicesDatabase[key]) {
      return invoicesDatabase[key];
    }

    // Tự sinh hóa đơn giả lập chuẩn xác cho các ca chưa có
    const numId = Number(callId) || 100;
    const distanceKm = Number((3.5 + (numId % 5) * 1.2).toFixed(1));
    const baseFee = 250000;
    const kmFee = Math.round(distanceKm * 25000);
    const medicalFee = 150000;
    const subtotal = baseFee + kmFee + medicalFee;
    const discountAmount = Math.round(subtotal * 0.3); // Giảm 30% BHYT
    const totalAmount = subtotal - discountAmount;

    const newInvoice: PaymentInvoice = {
      id: `inv-${callId}`,
      invoiceCode: `HDCC-2026-${String(callId).padStart(5, '0')}`,
      callId,
      requestId: extra?.requestId ?? (numId > 50 ? numId - 82 : numId),
      missionId: extra?.missionId ?? (numId > 50 ? numId - 91 : numId),
      patientName: extra?.patientName || 'Phan Văn Nam',
      patientPhone: extra?.patientPhone || '0904000002',
      pickupAddress: extra?.pickupAddress || 'Hiện trường sơ cấp cứu 115',
      hospitalAddress: extra?.hospitalAddress || 'Bệnh viện Cấp Cứu 115',
      distanceKm,
      vehicleType: extra?.vehicleType || 'Xe Cấp Cứu Hồi Sức Tích Cực (ICU)',
      licensePlate: extra?.licensePlate || '29A-11111',
      items: [
        { name: 'Phí khởi động & điều phối xe cấp cứu 115', quantity: 1, unitPrice: baseFee, totalPrice: baseFee },
        { name: `Cước di chuyển (${distanceKm} km x 25.000đ/km)`, quantity: distanceKm, unitPrice: 25000, totalPrice: kmFee },
        { name: 'Trang bị sơ cứu y tế & hỗ trợ hồi sức', quantity: 1, unitPrice: medicalFee, totalPrice: medicalFee },
        { name: 'Hỗ trợ khấu trừ Bảo hiểm Y tế (30%)', quantity: 1, unitPrice: -discountAmount, totalPrice: -discountAmount, isDiscount: true },
      ],
      subtotal,
      discountAmount,
      totalAmount,
      paymentStatus: (extra?.paymentStatus as PaymentStatus) || 'UNPAID',
      paymentMethod: extra?.paymentMethod || null,
      transactionRef: extra?.transactionRef || null,
      createdAt: new Date().toISOString(),
      paidAt: null,
      notes: 'Thanh toán chi phí vận chuyển & kíp sơ cấp cứu khẩn cấp 115.',
      ...extra,
    };

    invoicesDatabase[key] = newInvoice;
    return newInvoice;
  },

  /**
   * Xử lý thanh toán hóa đơn (Mô phỏng thanh toán thành công)
   */
  async processPayment(callId: string | number, method: PaymentMethod): Promise<PaymentInvoice> {
    const key = String(callId);
    const invoice = this.getInvoiceByCallId(callId);

    const updated: PaymentInvoice = {
      ...invoice,
      paymentStatus: 'PAID',
      paymentMethod: method,
      transactionRef: `TXN${Date.now()}`,
      paidAt: new Date().toISOString(),
      notes: `Đã thanh toán thành công qua ${method} vào lúc ${new Date().toLocaleTimeString('vi-VN')}`,
    };

    invoicesDatabase[key] = updated;
    return updated;
  },

  /**
   * Định dạng tiền tệ VNĐ chuẩn
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
      .format(amount)
      .replace('₫', 'đ');
  },

  /**
   * Sinh mã QR VietQR mẫu chuẩn
   */
  getVietQRUrl(amount: number, content: string): string {
    const encodedContent = encodeURIComponent(content);
    return `https://img.vietqr.io/image/MB-0904000002-compact2.png?amount=${amount}&addInfo=${encodedContent}&accountName=TRUNG%20TAM%20CAP%20CUU%20115`;
  },
};

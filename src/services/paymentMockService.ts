import { DriverTripEarning, PaymentInvoice, PaymentMethod, PaymentStatus } from '@/types';

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
    vehicleType: 'Xe Cấp Cứu Hồi Sức Nâng Cao (ALS)',
    licensePlate: '29A-11111',
    items: [
      { name: 'Phí khởi động xe cấp cứu ALS (Hồi sức nâng cao)', quantity: 1, unitPrice: 300000, totalPrice: 300000 },
      { name: 'Cước di chuyển thực tế (4.8 km × 45.000đ/km)', quantity: 4.8, unitPrice: 45000, totalPrice: 216000 },
    ],
    subtotal: 516000,
    discountAmount: 0,
    totalAmount: 516000,
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
      { name: 'Phí khởi động xe cấp cứu BLS (Cơ bản)', quantity: 1, unitPrice: 200000, totalPrice: 200000 },
      { name: 'Cước di chuyển thực tế (3.2 km × 40.000đ/km)', quantity: 3.2, unitPrice: 40000, totalPrice: 128000 },
    ],
    subtotal: 328000,
    discountAmount: 0,
    totalAmount: 328000,
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
   * Phí dịch vụ:
   * - ALS: Phí khởi động 300k, 45k/km
   * - BLS: Phí khởi động 200k, 40k/km
   * - BE không trừ BHYT
   */
  getInvoiceByCallId(callId: string | number, extra?: Partial<PaymentInvoice>): PaymentInvoice {
    const key = String(callId);
    if (invoicesDatabase[key]) {
      return invoicesDatabase[key];
    }

    const numId = Number(callId) || 100;
    const isBLS = extra?.vehicleType?.includes('BLS') || numId % 2 === 1; // đan xen mẫu
    const serviceType = isBLS ? 'BLS' : 'ALS';
    const vehicleType = isBLS
      ? 'Xe Cấp Cứu Tiêu Chuẩn (BLS)'
      : 'Xe Cấp Cứu Hồi Sức Nâng Cao (ALS)';

    const baseFare = isBLS ? 200000 : 300000;
    const pricePerKm = isBLS ? 40000 : 45000;
    const distanceKm = Number((3.5 + (numId % 5) * 1.2).toFixed(1));
    const distanceFare = Math.round(distanceKm * pricePerKm);
    const totalAmount = baseFare + distanceFare;

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
      vehicleType: extra?.vehicleType || vehicleType,
      licensePlate: extra?.licensePlate || (isBLS ? '29A-22222' : '29A-11111'),
      items: [
        {
          name: `Phí khởi động xe cấp cứu ${serviceType} (${isBLS ? 'Cơ bản' : 'Hồi sức nâng cao'})`,
          quantity: 1,
          unitPrice: baseFare,
          totalPrice: baseFare,
        },
        {
          name: `Cước di chuyển (${distanceKm} km × ${new Intl.NumberFormat('vi-VN').format(pricePerKm)}đ/km)`,
          quantity: distanceKm,
          unitPrice: pricePerKm,
          totalPrice: distanceFare,
        },
      ],
      subtotal: totalAmount,
      discountAmount: 0, // BE hiện không có trừ BHYT
      totalAmount,
      paymentStatus: (extra?.paymentStatus as PaymentStatus) || 'UNPAID',
      paymentMethod: extra?.paymentMethod || null,
      transactionRef: extra?.transactionRef || null,
      createdAt: new Date().toISOString(),
      paidAt: null,
      notes: `Chi phí vận chuyển cấp cứu ${serviceType}.`,
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
   * Lấy chi tiết thu nhập & trạng thái thu cước theo cuốc cho Tài xế (Driver Trip Earning)
   */
  getDriverTripEarning(missionId: string | number, extra?: Partial<DriverTripEarning>): DriverTripEarning {
    const numId = Number(missionId) || 1;
    const distanceKm = Number((3.5 + (numId % 5) * 1.2).toFixed(1));
    const baseEarning = 120000; // Thù lao mở cuốc cố định
    const distanceEarning = Math.round(distanceKm * 15000); // 15.000đ/km
    const emergencyAllowance = 50000; // Phụ cấp kíp trực / khẩn cấp
    const driverTotalEarned = baseEarning + distanceEarning + emergencyAllowance;
    const totalTripFare = 250000 + Math.round(distanceKm * 25000) + 180000 - 165000;

    return {
      missionId,
      requestId: extra?.requestId ?? (numId > 5 ? numId + 9 : numId),
      callId: extra?.callId ?? (numId > 5 ? numId + 91 : numId),
      distanceKm,
      totalTripFare,
      baseEarning,
      distanceEarning,
      emergencyAllowance,
      driverTotalEarned,
      collectionStatus: extra?.collectionStatus || 'PAID_DIGITAL',
      collectedAmount: totalTripFare,
      collectedAt: new Date().toISOString(),
      settledToWallet: true,
      ...extra,
    };
  },

  /**
   * Tài xế xác nhận đã thu tiền mặt trực tiếp từ người nhà bệnh nhân
   */
  async confirmDriverCashCollection(missionId: string | number, amount: number): Promise<DriverTripEarning> {
    const earning = this.getDriverTripEarning(missionId, {
      collectionStatus: 'COLLECTED_CASH',
      collectedAmount: amount,
      collectedAt: new Date().toISOString(),
      settledToWallet: true,
    });
    return earning;
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

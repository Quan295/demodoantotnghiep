/**
 * Unified Emergency Status Resolver
 * Standardized across Mobile (Citizen & Driver) to eliminate status mismatch.
 * Priority: Mission Status > Dispatch Request Status > Emergency Call Status
 */

export function resolveEmergencyStatus(data: any): string {
  if (!data) return 'RECEIVED';

  // Extract extended_attributes if present
  let ext: any = {};
  if (typeof data.extended_attributes === 'string') {
    try {
      ext = JSON.parse(data.extended_attributes);
    } catch {}
  } else if (data.extended_attributes) {
    ext = data.extended_attributes;
  } else if (data.extendedAttributes) {
    ext = data.extendedAttributes;
  }

  // 1. Mission Status (Cao nhất trong lifecycle điều xe)
  const missionStatus = (
    data.missionStatus ||
    data.mission_status ||
    data.mission?.status ||
    ext.missionStatus ||
    ext.mission_status ||
    ''
  )?.toUpperCase();

  // 2. Dispatch Request Status (Lệnh điều phối từ điều phối viên / hệ thống)
  const requestStatus = (
    data.dispatchRequestStatus ||
    data.dispatch_request_status ||
    data.requestStatus ||
    data.request_status ||
    data.dispatchStatus ||
    data.dispatch_status ||
    data.request?.status ||
    ext.dispatchRequestStatus ||
    ext.requestStatus ||
    ext.request_status ||
    ''
  )?.toUpperCase();

  // 3. Call Status (Trạng thái cuộc gọi / yêu cầu khởi tạo ban đầu)
  const callStatus = (
    data.callStatus ||
    data.call_status ||
    data.status ||
    ext.callStatus ||
    ext.call_status ||
    ext.status ||
    ''
  )?.toUpperCase();

  // --- Rule 1: COMPLETED (Đã hoàn tất ca cấp cứu & đã phát sinh hóa đơn) ---
  if (
    missionStatus === 'COMPLETED' ||
    missionStatus === 'FINISHED' ||
    requestStatus === 'COMPLETED' ||
    requestStatus === 'FINISHED' ||
    requestStatus === 'CLOSED' ||
    callStatus === 'CLOSED' ||
    callStatus === 'COMPLETED' ||
    callStatus === 'FINISHED' ||
    callStatus === 'RESOLVED' ||
    data.paymentStatus === 'SUCCESS' ||
    data.paymentStatus === 'PAID'
  ) {
    return 'COMPLETED';
  }

  // --- Rule 2: Đã tới bệnh viện tiếp nhận ---
  if (missionStatus === 'ARRIVED_HOSPITAL' || requestStatus === 'ARRIVED_HOSPITAL') {
    return 'ARRIVED_HOSPITAL';
  }

  // --- Rule 3: Đang chuyển viện (trên đường đưa bệnh nhân tới viện) ---
  if (missionStatus === 'TRANSPORTING' || requestStatus === 'TRANSPORTING') {
    return 'TRANSPORTING';
  }

  // --- Rule 4: Đã tiếp cận hiện trường ---
  if (
    ['ARRIVED_SCENE', 'AT_SCENE', 'ARRIVED'].includes(missionStatus) ||
    ['ARRIVED_SCENE', 'AT_SCENE'].includes(requestStatus)
  ) {
    return 'ARRIVED_SCENE';
  }

  // --- Rule 5: Xe đang di chuyển đến hiện trường ---
  if (
    ['EN_ROUTE', 'START', 'RUNNING'].includes(missionStatus) ||
    ['EN_ROUTE', 'IN_PROGRESS'].includes(requestStatus)
  ) {
    return 'EN_ROUTE';
  }

  // --- Rule 6: Đã điều phối xe / Chỉ định kíp cấp cứu ---
  if (
    ['ACCEPTED', 'ASSIGNED', 'DISPATCHED'].includes(missionStatus) ||
    ['ASSIGNED', 'DISPATCHED', 'RECOMMENDING'].includes(requestStatus) ||
    ['ASSIGNED', 'DISPATCHED'].includes(callStatus)
  ) {
    return 'DISPATCHED';
  }

  // --- Rule 7: Đã tiếp nhận yêu cầu (chờ điều phối) ---
  if (
    ['PENDING', 'RECEIVED', 'CREATED', 'NEW', 'CONFIRMED'].includes(callStatus) ||
    ['PENDING', 'RECEIVED', 'CREATED', 'NEW'].includes(requestStatus)
  ) {
    return 'RECEIVED';
  }

  return requestStatus || missionStatus || callStatus || 'RECEIVED';
}

/**
 * Kiểm tra xem một ca cấp cứu đã có thể xem/thanh toán hóa đơn cước hay chưa
 */
export function isPaymentEligible(data: any): boolean {
  const st = resolveEmergencyStatus(data);
  return st === 'COMPLETED';
}

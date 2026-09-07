import { Client } from '@stomp/stompjs';
import { globalConfig } from './config';

export type PaymentReadyEvent = {
  event: 'PAYMENT_READY';
  callId: number;
  missionId: number;
  paymentId: number;
  status: 'PENDING';
  totalAmount: number;
  message: string;
};

type PaymentReadyListener = (event: PaymentReadyEvent) => void;

let client: Client | null = null;
const listeners = new Set<PaymentReadyListener>();
let currentSubscribedUserId: number | null = null;

/**
 * Lấy URL WebSocket chuẩn từ apiBaseUrl hiện tại:
 * Ví dụ: http://192.168.10.111:8080/api/v1 -> ws://192.168.10.111:8080/ws
 */
export function getReporterWebSocketUrl(): string {
  const apiBase = globalConfig.getApiBaseUrl();
  const wsBase = apiBase
    .replace(/\/api\/v1\/?$/, '')
    .replace(/^http:/, 'ws:')
    .replace(/^https:/, 'wss:');
  return `${wsBase}/ws`;
}

function resolveCurrentUserId(): number | null {
  const user = globalConfig.getCurrentUser();
  if (!user) return null;
  const rawId = user.userId ?? user.id;
  const num = Number(rawId);
  return !isNaN(num) && num > 0 ? num : null;
}

function startStompClient() {
  const userId = resolveCurrentUserId();
  if (!userId) {
    console.warn('[WS-Reporter] Chưa có reporter userId hợp lệ, tạm hoãn kết nối STOMP');
    return;
  }

  // Nếu client đã kết nối cho đúng user này rồi thì không tạo lại
  if (client && client.active && currentSubscribedUserId === userId) {
    return;
  }

  // Nếu đổi user hoặc client cũ bị stale, hủy trước
  if (client) {
    try {
      client.deactivate();
    } catch {}
    client = null;
  }

  const brokerURL = getReporterWebSocketUrl();
  currentSubscribedUserId = userId;
  console.log(`[WS-Reporter] Khởi tạo kết nối STOMP tới: ${brokerURL} cho Reporter #${userId}`);

  client = new Client({
    brokerURL,
    reconnectDelay: 5000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,

    onConnect: () => {
      console.log(`[WS-Reporter] STOMP Đã kết nối thành công! Đang subscribe: /topic/reporter/${userId}`);

      client?.subscribe(`/topic/reporter/${userId}`, message => {
        try {
          console.log('[WS-Reporter] Nhận STOMP message:', message.body);
          const payload: PaymentReadyEvent = JSON.parse(message.body);

          if (payload.event === 'PAYMENT_READY' || (payload as any).status === 'PENDING') {
            console.log('[WS-Reporter] >>> SỰ KIỆN PAYMENT_READY:', payload);
            listeners.forEach(listener => {
              try {
                listener(payload);
              } catch (err) {
                console.error('[WS-Reporter] Lỗi khi thực thi callback listener:', err);
              }
            });
          }
        } catch (parseError) {
          console.error('[WS-Reporter] Lỗi parse JSON STOMP message:', parseError);
        }
      });
    },

    onStompError: frame => {
      console.error('[WS-Reporter] STOMP Error frame:', frame.headers['message'], frame.body);
    },

    onWebSocketError: error => {
      console.error('[WS-Reporter] WebSocket Error:', error);
    },

    onDisconnect: () => {
      console.log('[WS-Reporter] STOMP Disconnected');
    },
  });

  client.activate();
}

/**
 * Đăng ký lắng nghe sự kiện PAYMENT_READY từ backend qua STOMP WebSocket topic /topic/reporter/{userId}.
 * Tự động kết nối và duy trì kết nối khi có ít nhất 1 listener đang active.
 * Trả về hàm hủy đăng ký (unsubscribe/disconnect).
 */
export function connectReporterPaymentSocket(
  onPaymentReady: PaymentReadyListener
): () => void {
  listeners.add(onPaymentReady);
  startStompClient();

  // Đăng ký listener cập nhật khi user đăng nhập/thay đổi tài khoản
  const unsubscribeConfig = globalConfig.subscribe(() => {
    const newUserId = resolveCurrentUserId();
    if (newUserId && newUserId !== currentSubscribedUserId && listeners.size > 0) {
      console.log(`[WS-Reporter] Phát hiện đổi user (UserId=${newUserId}), kết nối lại socket...`);
      startStompClient();
    }
  });

  return () => {
    listeners.delete(onPaymentReady);
    unsubscribeConfig();

    if (listeners.size === 0 && client) {
      console.log('[WS-Reporter] Không còn listener nào, ngắt kết nối STOMP client');
      try {
        client.deactivate();
      } catch {}
      client = null;
      currentSubscribedUserId = null;
    }
  };
}

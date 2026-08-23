# HỆ THỐNG ĐIỀU PHỐI CẤP CỨU THÔNG MINH (115 SMART DISPATCH)

Ứng dụng di động hỗ trợ người dân gọi cấp cứu khẩn cấp (Voice SOS, 1-Tap SOS) và tài xế xe cứu thương nhận nhiệm vụ điều phối thời gian thực.

---

## 1. Node/Expo version
- **Node.js**: `v20.x` hoặc `v22.x` (Khuyến nghị LTS >= 18.0.0)
- **npm**: `>= 9.x`
- **Expo SDK**: `~54.0.36`
- **React Native**: `0.81.5`
- **React**: `19.1.0`

---

## 2. npm install
Cài đặt toàn bộ dependencies của dự án:
```bash
npm install
```

---

## 3. Tạo .env
Tạo file `.env` tại thư mục gốc của dự án (copy từ `.env.example`):
```bash
cp .env.example .env
```

---

## 4. API_BASE_URL
Cấu hình địa chỉ IP máy chủ Backend vào file `.env`:
```env
# Thay thế 192.168.1.159 bằng địa chỉ IP máy tính/server đang chạy Backend của bạn
EXPO_PUBLIC_API_URL=http://192.168.1.159:8080/api/v1
```

> **Lưu ý quan trọng**:
> - Nếu chạy trên điện thoại thật, điện thoại và máy tính chạy server Backend phải **kết nối chung một mạng Wi-Fi**.
> - Đảm bảo Windows Defender Firewall đã mở cổng `8080` (hoặc tạm thời cho phép Inbound connection).

---

## 5. npm start
Khởi chạy Metro Bundler của Expo:
```bash
npm start
```
Hoặc:
```bash
npx expo start -c
```
*(Tham số `-c` để xóa cache, đảm bảo nạp đúng biến môi trường `.env` mới nhất).*

---

## 6. Android emulator / physical device
- **Thiết bị thật (Physical Device - Khuyến nghị)**:
  - Cài ứng dụng **Expo Go** từ Google Play Store (Android) hoặc App Store (iOS).
  - Quét mã QR hiển thị trên Terminal sau khi chạy `npm start`.
- **Máy ảo (Android Emulator)**:
  - Nhấn phím `a` trên Terminal sau khi khởi chạy Expo để tự động mở máy ảo Android.
  - Cấu hình IP Backend trong `.env` thành `http://10.0.2.2:8080/api/v1` nếu máy ảo chạy trực tiếp trên máy chủ.
- **Web Browser**:
  - Nhấn phím `w` trên Terminal để chạy thử trên trình duyệt web.

---

## 7. Quyền GPS và Microphone
Ứng dụng sử dụng 2 quyền thiết yếu:
- **Quyền Vị trí (GPS - `expo-location`)**:
  - Dùng để xác định tọa độ hiện trường khẩn cấp của nạn nhân và theo dõi vị trí xe cứu thương PostGIS thời gian thực.
  - Khi mở app, chọn **"Trong khi dùng ứng dụng" (While using the app)** và chọn **"Chính xác" (Precise)**.
- **Quyền Ghi âm (Microphone - `expo-audio`)**:
  - Dùng cho tính năng **Voice SOS** (thu âm lời kêu cứu và phân tích AI).
  - Khi nhấn nút ghi âm lần đầu, chọn **"Cho phép" (Allow)**.

---

## 8. Tài khoản demo Reporter
Dùng để đăng nhập luồng Người dân gọi cấp cứu:
- **Tên đăng nhập (Username)**: `reporter` (hoặc `user_test01`)
- **Mật khẩu (Password)**: `123456`
- **Vai trò**: `REPORTER`
- **Màn hình chính**: Màn hình Gửi SOS 1-chạm & Ghi âm Cấp cứu (`/(citizen)/sos`)

---

## 9. Tài khoản demo Driver
Dùng để đăng nhập luồng Tài xế xe cứu thương:
- **Tên đăng nhập (Username)**: `driver1` (hoặc `driver`)
- **Mật khẩu (Password)**: `123456`
- **Vai trò**: `DRIVER`
- **Màn hình chính**: Bảng điều khiển ca trực tài xế (`/(driver)/dashboard`)

---

## 10. Kịch bản demo (Step-by-Step Flow)

### Luồng 1: Người Dân Tạo Yêu Cầu Cứu Hộ
1. Đăng nhập bằng tài khoản `reporter` / `123456`.
2. Cho phép quyền Vị trí GPS và Microphone.
3. **Gọi cấp cứu bằng giọng nói (Voice SOS)**:
   - Nhấn **"Bắt đầu ghi âm"**, nói mô tả tình trạng sự cố (ví dụ: *"Tai nạn ngã xe ở Chùa Bộc, bất tỉnh..."*).
   - Nhấn **"Dừng ghi âm"** → Nhấn **"Gửi ghi âm cấp cứu ngay"**.
   - App tự động upload audio lên MinIO và gửi `POST /calls/voice` đến Backend.
4. **Theo dõi hành trình**:
   - Nhấn **"Theo dõi xe cứu thương"** để chuyển sang màn hình Tracking (`/(citizen)/tracking`).
   - Xem xe cứu thương di chuyển trực tiếp trên bản đồ OSM Dark, thời gian dự kiến (ETA) và timeline trạng thái.

### Luồng 2: Tài Xế Nhận Đơn & Cứu Hộ
1. Đăng nhập bằng tài khoản `driver1` / `123456` trên một thiết bị khác (hoặc tab khác).
2. Xem thông tin xe cứu thương được gán từ `GET /driver-resource` (Biển số: `29A-115.88`, trang thiết bị AED, bình Oxy).
3. Khi có ca cấp cứu mới (`DISPATCHED`), bảng pop-up cảnh báo xuất hiện → Nhấn **"Chấp nhận nhiệm vụ"** (`POST /accept`).
4. Tại màn hình Điều Hướng (`/(driver)/navigation`), cập nhật tuần tự từng bước:
   - Nhấn **"Bắt đầu di chuyển"** (`POST /start`) → Trạng thái `EN_ROUTE`.
   - Nhấn **"Đã đến hiện trường"** (`POST /arrive-scene`) → Trạng thái `ARRIVED_SCENE`.
   - Nhấn **"Bắt đầu vận chuyển"** (`POST /start-transport`) → Trạng thái `TRANSPORTING`.
   - Nhấn **"Đã đến bệnh viện"** (`POST /arrive-hospital`) → Trạng thái `ARRIVED_HOSPITAL`.
   - Nhấn **"Hoàn thành nhiệm vụ"** (`POST /complete`) → Trạng thái `COMPLETED`.
5. Tọa độ GPS của xe được tự động đồng bộ lên máy chủ mỗi 15 giây qua `PATCH /driver-resource/location`.

---

## 11. Các giới hạn hiện tại
1. **Mạng Local Wi-Fi**: Cần chung dải mạng IP giữa thiết bị di động và máy chủ backend khi chưa deploy lên server Cloud (như AWS/DigitalOcean).
2. **Cập nhật trạng thái trực của xe**: Endpoint `PATCH /driver-resource/status` đang trong quá trình hoàn thiện ở backend, hiện tại ứng dụng hiển thị trạng thái mặc định theo dữ liệu gán từ quản trị viên.
3. **Thanh toán trực tuyến**: Hiện tại hệ thống ghi nhận lịch sử giao dịch và số dư ví (Mock balance), cổng thanh toán qua ngân hàng thực tế (VNPay/MoMo) sẽ được kết nối ở giai đoạn tiếp theo.
4. **Bản đồ Offline**: Bản đồ sử dụng nguồn dữ liệu CartoDB/OpenStreetMap trực tuyến, yêu cầu kết nối Internet liên tục để tải các mảnh bản đồ (tiles).

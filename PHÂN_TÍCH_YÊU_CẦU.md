# PHÂN TÍCH YÊU CẦU HỆ THỐNG 115 SMART DISPATCH

## 1. TỔNG QUAN HỆ THỐNG

Hệ thống là một nền tảng trung gian kết nối 3 đối tượng chính:
- **Bệnh nhân/Người nhà bệnh nhân** (Người dân)
- **Nhà cung cấp dịch vụ** (Provider/Bệnh viện)
- **Điều phối viên/Admin** (Trung tâm điều hành)

**Mô hình tham khảo**: Grab - Hệ thống trung gian kết nối người dùng và nhà cung cấp dịch vụ.

---

## 2. PHÂN QUYỀN VAI TRÒ

### 2.1 Danh sách vai trò

| Vai trò | Mô tả | Quyền hạn chính |
|---------|-------|-----------------|
| **Admin** | Quản trị hệ thống | Quản lý người dùng, provider, xem toàn bộ thống kê, báo cáo |
| **Hospital** | Bệnh viện/Đơn vị y tế | Quản lý đội xe của mình, xem hiệu suất, thống kê nội bộ |
| **Provider** | Nhà cung cấp xe cứu hộ | Đăng ký dịch vụ, xem hiệu quả kinh tế, quản lý tài chính |
| **Dispatcher** | Điều phối viên | Điều phối ca cứu hộ, theo dõi tiến trình |
| **Citizen** | Người dân/Bệnh nhân | Yêu cầu cứu hộ, đánh giá, xem lịch sử |
| **Driver** | Tài xế cứu hộ | Nhận nhiệm vụ, điều hướng, cập nhật trạng thái |

### 2.2 Ma trận phân quyền

| Chức năng | Admin | Hospital | Provider | Dispatcher | Citizen | Driver |
|-----------|-------|----------|----------|------------|---------|--------|
| Quản lý người dùng | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Quản lý provider | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Thống kê toàn hệ thống | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Thống kê nội bộ đơn vị | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Xem hiệu quả kinh tế | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Điều phối ca cứu hộ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Yêu cầu cứu hộ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Đánh giá dịch vụ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Nhận nhiệm vụ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Quản lý tài khoản tiền | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 3. ĐỐI TƯỢNG CHĂM SÓC

### 3.1 Bệnh nhân/Người nhà bệnh nhân
**Nhu cầu**:
- Yêu cầu cứu hộ khẩn cấp nhanh chóng
- Theo dõi vị trí xe cứu hộ theo thời gian thực
- Đánh giá chất lượng dịch vụ sau khi hoàn thành
- Xem lịch sử các ca cứu hộ
- Thanh toán đơn giản, an toàn

**Chức năng chính**:
- Gửi yêu cầu SOS với thông tin vị trí, tình trạng
- Theo dõi xe đến trên bản đồ
- Đánh giá (sao + bình luận) sau khi hoàn thành
- Xem lịch sử giao dịch
- Nâng hạng tài khoản (Đồng → Bạc → Vàng)

### 3.2 Nhà cung cấp dịch vụ (Provider/Hospital)
**Nhu cầu**:
- Đăng ký dịch vụ lên hệ thống
- Quản lý thông tin cá nhân, biển số xe
- Xem hiệu suất làm việc
- Xem hiệu quả kinh tế (doanh thu, chi phí)
- Quản lý tài khoản tiền (nạp, rút, xem lịch sử)
- Nhận phản hồi và đánh giá từ khách hàng

**Thông tin Provider cần quản lý**:
- Tên đơn vị/bệnh viện
- Thông tin liên hệ
- Danh sách xe (biển số, loại xe, tình trạng)
- Danh sách tài xế
- Thông tin tài khoản ngân hàng

### 3.3 Trung tâm điều phối
**Nhu cầu**:
- Điều phối xe đến hiện trường hiệu quả
- Theo dõi tất cả các ca cứu hộ đang diễn ra
- Thống kê hiệu suất của các provider
- Xử lý khiếu nại, lỗi hệ thống
- Xuất báo cáo thống kê

---

## 4. LUỒNG CHÍNH CỦA HỆ THỐNG

```
[Người dân] Yêu cầu SOS 
    ↓
[Điều phối] Phân công xe phù hợp
    ↓
[Driver] Nhận nhiệm vụ → Đi đến hiện trường
    ↓
[Hoàn thành] Cứu hộ xong
    ↓
[Thanh toán] Trừ tiền trực tiếp vào tài khoản gốc
    ↓
[Phản hồi] Người dùng đánh giá dịch vụ
    ↓
[Báo cáo] Xuất dữ liệu thống kê
```

### 4.1 Luồng chi tiết

**Bước 1: Đăng ký kênh Provider**
- Provider đăng ký thông tin trên hệ thống
- Nạp tiền vào tài khoản (bắt buộc)
- Hệ thống xác thực và kích hoạt

**Bước 2: Yêu cầu cứu hộ**
- Citizen gửi yêu cầu SOS với vị trí, tình trạng
- Hệ thống thông báo đến các provider nearby
- Điều phối viên chọn provider phù hợp

**Bước 3: Thực hiện nhiệm vụ**
- Driver nhận nhiệm vụ
- Cập nhật trạng thái: Đang đến → Đã đến → Đang xử lý → Hoàn thành
- Theo dõi trên bản đồ

**Bước 4: Thanh toán**
- Hệ thống tính phí dịch vụ
- Trừ trực tiếp vào tài khoản gốc của Provider
- Cộng phần doanh thu vào tài khoản của Provider
- Ghi nhận giao dịch

**Bước 5: Phản hồi và đánh giá**
- Citizen đánh giá (sao + bình luận)
- Provider có thể phản hồi lại
- Hệ thống cập nhật điểm đánh giá của Provider

**Bước 6: Thống kê báo cáo**
- Hệ thống tổng hợp dữ liệu
- Xuất báo cáo hiệu suất, doanh thu
- Phân tích các vấn đề (vd: 10% đặt bên đơn vị A có vấn đề)

---

## 5. HỆ THỐNG THANH TOÁN VÀ TÀI CHÍNH

### 5.1 Cơ chế tài khoản
- **Tài khoản gốc**: Mỗi Provider có 1 tài khoản chính
- **Nạp tiền**: Provider phải nạp tiền trước khi đăng ký kênh
- **Trừ trực tiếp**: Khi phát sinh dịch vụ, trừ phí dịch vụ ngay lập tức
- **Cộng dồn**: Doanh thu được cộng dồn vào tài khoản
- **Hoàn tiền**: Hỗ trợ hoàn tiền khi có lỗi (yêu cầu xác thực)
- **Rút tiền**: Provider có thể yêu cầu rút tiền về tài khoản ngân hàng

### 5.2 Cơ chế kiếm lợi nhuận (tham khảo Grab)
- **Phí dịch vụ**: Hệ thống thu một phần (%) từ mỗi ca cứu hộ
- **Phí đăng ký kênh**: Phí hàng tháng/năm cho Provider
- **Phí nâng cấp**: Phí cho các gói dịch vụ cao cấp
- **Commission**: Hoa hồng từ mỗi giao dịch thành công

### 5.3 Tránh bùng tiền
- **Cơ chế nạp trước**: Provider phải nạp tiền trước khi hoạt động
- **Giới hạn ngưỡng**: Nếu tài khoản dưới ngưỡng an toàn, hệ thống cảnh báo
- **Tạm dừng dịch vụ**: Nếu tài khoản về 0, tạm dừng nhận ca mới
- **Ghi nhận toàn bộ**: Mọi giao dịch đều được ghi lại rõ ràng
- **Không dùng số điện thoại**: Không sử dụng số điện thoại để thanh toán (tránh không lưu vết)

### 5.4 Quy trình thanh toán
```
1. Hoàn thành ca cứu hộ
2. Hệ thống tính tổng tiền
3. Trừ phí dịch vụ (cho hệ thống)
4. Cộng phần còn lại vào tài khoản Provider
5. Ghi nhận giao dịch vào lịch sử
6. Gửi thông báo đến Provider
7. Chờ quy trình hoàn thiện mới cho rút tiền
```

---

## 6. HỆ THỐNG ĐÁNH GIÁ VÀ PHẢN HỒI

### 6.1 Đánh giá từ khách hàng
- **Đánh giá sao**: 1-5 sao
- **Bình luận**: Nhận xét chi tiết
- **Ảnh/chụp màn hình**: Đính kèm bằng chứng (nếu cần)
- **Danh mục đánh giá**:
  - Tốc độ phản ứng
  - Thái độ phục vụ
  - Chất lượng xe
  - An toàn

### 6.2 Quản lý comment
- **Admin xem tất cả**: Xem toàn bộ đánh giá
- **Provider xem đánh giá của mình**: Xem và phản hồi lại
- **Lọc và tìm kiếm**: Theo ngày, theo provider, theo điểm
- **Xử lý khiếu nại**: Quy trình xử lý các đánh giá tiêu cực

### 6.3 Phân hạng khách hàng
| Hạng | Điều kiện | Quyền lợi |
|------|-----------|-----------|
| **Đồng** | Mới đăng ký | Ưu tiên cơ bản |
| **Bạc** | ≥ 10 ca, ≥ 4.0 sao | Ưu tiên cao hơn, giảm phí 5% |
| **Vàng** | ≥ 50 ca, ≥ 4.5 sao | Ưu tiên cao nhất, giảm phí 10% |

---

## 7. THỐNG KÊ VÀ BÁO CÁO

### 7.1 Thống kê hiệu suất Provider
- **Số ca cứu hộ**: Theo ngày/tuần/tháng
- **Thời gian phản hồi trung bình**
- **Điểm đánh giá trung bình**
- **Tỷ lệ hoàn thành nhiệm vụ**
- **Tỷ lệ khiếu nại**
- **Top provider tốt nhất/xấu nhất**

**Ví dụ cảnh báo**: "Đơn vị A có 10% ca bị khiếu nại - cần xem xét"

### 7.2 Thống kê kinh tế
- **Doanh thu tổng**: Theo thời gian
- **Doanh thu theo Provider**
- **Phí dịch vụ đã thu**
- **Lợi nhuận hệ thống**
- **Biểu đồ tăng trưởng**

### 7.3 Báo cáo
- **Báo cáo ngày**: Tổng hợp hoạt động trong ngày
- **Báo cáo tuần**: Tổng hợp tuần
- **Báo cáo tháng**: Tổng hợp tháng
- **Báo cáo hiệu suất**: Phân tích hiệu suất各 provider
- **Xuất dữ liệu**: Định dạng Excel/PDF (chỉ cần ra dữ liệu, không cần tích hợp chuyên sâu)

---

## 8. CÁC RỦI RO VÀ GIẢI PHÁP

| Rủi ro | Giải pháp |
|--------|-----------|
| Không lưu vết thanh toán khi dùng số điện thoại | Không sử dụng số điện thoại để thanh toán. Sử dụng tài khoản hệ thống, mọi giao dịch đều được ghi nhận |
| Bùng tiền, không kiểm soát được tài chính | Cơ chế nạp trước, giới hạn ngưỡng, tạm dừng dịch vụ khi tài khoản hết tiền |
| Provider không chất lượng | Hệ thống đánh giá, xếp hạng, cảnh báo khi có quá nhiều khiếu nại |
| Điều phối không hiệu quả | Sử dụng AI đề xuất xe phù hợp dựa trên vị trí, hiệu suất |
| Không thể tiếp cận nhiều người | UI/UX thân thiện, hỗ trợ nhiều nền tảng (web, mobile) |

---

## 9. CÁC CHỨC NĂNG CẦN TRIỂN KHAI THEO THỨ TỰ

### Giai đoạn 1: Cơ bản (Hiện tại - Điều phối)
✅ Đã có:
- Màn hình chào mừng với 3 vai trò
- Cổng Người dân (SOS)
- Cổng Đội cứu hộ (Dashboard, Navigation)
- Cổng Điều phối (Dashboard, Case Detail)

### Giai đoạn 2: Mở rộng vai trò
- Thêm vai trò Admin
- Thêm vai trò Hospital
- Thêm vai trò Provider
- Phân quyền chi tiết

### Giai đoạn 3: Quản lý Provider
- Đăng ký Provider
- Quản lý thông tin Provider
- Quản lý xe và biển số
- Quản lý tài xế

### Giai đoạn 4: Hệ thống tài chính
- Tài khoản tiền cho Provider
- Nạp/rút tiền (mock)
- Trừ phí dịch vụ
- Lịch sử giao dịch

### Giai đoạn 5: Đánh giá và phản hồi
- Đánh giá từ Citizen
- Quản lý comment
- Phân hạng khách hàng
- Xử lý khiếu nại

### Giai đoạn 6: Thống kê báo cáo
- Thống kê hiệu suất
- Thống kê kinh tế
- Xuất báo cáo
- Phân tích vấn đề

---

## 10. KẾT LUẬN

Hệ thống cần tập trung vào:
1. **Đơn giản hóa luồng**: Tối ưu luồng điều phối → thanh toán → phản hồi
2. **An toàn tài chính**: Cơ chế nạp trước, trừ trực tiếp, tránh bùng tiền
3. **Chất lượng dịch vụ**: Hệ thống đánh giá, xếp hạng provider
4. **Thông tin minh bạch**: Thống kê rõ ràng cho cả provider và admin
5. **Mở rộng dễ dàng**: Thiết kế hệ thống dễ thêm chức năng mới

**Mock Payment**: Vì là giai đoạn đầu, có thể mock hệ thống thanh toán trước, tích hợp thật sau.

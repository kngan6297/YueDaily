# YueDaily — Đặc tả sản phẩm (PRD)

> **Loại tài liệu:** Product Requirements Document  
> **Phiên bản:** 1.2.0 · **Cập nhật:** 2026-07-08  
> **Trạng thái:** Đang phát triển (Expo SDK 54, React Native 0.81, React 19)

**Đọc tài liệu này khi cần biết app *là gì*, *cho ai*, *làm gì* và *làm như thế nào ở mức sản phẩm*.**  
Chi tiết kỹ thuật (cài đặt, build, schema DB, kiến trúc code) → [`README.md`](./README.md).

---

## 1. Tóm tắt

**YueDaily** (tên repo / DB: **Yozakura**) là app quản lý thu chi gia đình cho người Việt, ưu tiên:

- **Local-first:** dữ liệu lưu 100% trên thiết bị bằng SQLite, không cần tài khoản, không server app.
- **Nhập nhanh:** chụp hoá đơn → AI quét → gợi ý số tiền, danh mục, mô tả → chỉnh lại nhanh rồi lưu.
- **Theo người trả:** mọi giao dịch gắn với *người trả* (Vợ, Chồng, …) để xem chi tiêu theo người.
- **Minh bạch:** lịch tháng, báo cáo danh mục, số dư theo nguồn tiền, dễ kiểm tra lại.

Tag: cá nhân/ gia đình · offline‑friendly · privacy‑first.

---

## 2. Mục tiêu & chỉ số thành công

| Mục tiêu          | Chỉ số thành công                                          |
|-------------------|------------------------------------------------------------|
| Ghi nhanh         | ≤ 30 giây từ chụp ảnh đến lưu (khi AI hoạt động bình thường) |
| Duy trì thói quen | Streak ngày liên tiếp hiển thị rõ ràng, dễ “giữ streak”   |
| Phân bổ gia đình  | Lọc theo *người trả* trên Trang chủ + Thống kê            |
| Riêng tư          | 100% dữ liệu on-device; AI chỉ dùng khi quét ảnh          |
| An toàn dữ liệu   | Backup/restore JSON đầy đủ, không mất dữ liệu nghiệp vụ   |

---

## 3. Personas

### 3.1 Vợ chồng / hộ gia đình nhỏ (chính)

- Cùng chi tiêu, muốn biết *tháng này ai trả nhiều hơn*, chi cho những nhóm gì.
- Ít thời gian, không muốn học app phức tạp.
- UI tiếng Việt, emoji và màu pastel dễ chịu.

### 3.2 Người ghi chép hàng ngày

- Thói quen chụp hoá đơn sau khi thanh toán.
- Ưu tiên: nhập càng nhanh càng tốt, không phải gõ nhiều.
- Quan tâm: streak, tổng chi trong tháng, top danh mục.

### 3.3 Người coi trọng privacy

- Không muốn tạo tài khoản, không sync cloud bắt buộc.
- Chấp nhận backup thủ công (export file JSON) để tự lưu trữ.

### 3.4 Người dùng Web (phụ)

- Muốn nhập bằng máy tính, upload ảnh thay vì chụp camera native.
- Tính năng / UX nền tảng Web giữ nguyên nghiệp vụ, camera thay bằng file picker.

---

## 4. Phạm vi sản phẩm

### 4.1 In scope

| Module        | Hành vi người dùng                                                                 |
|---------------|-------------------------------------------------------------------------------------|
| **Trang chủ** | Lịch tháng, lọc *người trả*, xem tổng Thu/Chi tháng, xem/sửa/xoá/thêm giao dịch    |
| **Camera**    | Chụp ảnh hoá đơn (native) hoặc chọn file (web); có thể bỏ qua để nhập tay          |
| **Form thu/chi** | Nhập số tiền, loại Thu/Chi, danh mục, người trả, nguồn tiền, ngày, mô tả; quét AI |
| **Thống kê**  | Donut theo danh mục, danh sách giao dịch; lọc theo khoảng thời gian & người trả   |
| **Tài khoản** | Xem số dư tổng và theo từng nguồn tiền (Tiền mặt, Chuyển khoản, …)                 |
| **Cài đặt**   | CRUD người trả, nguồn tiền, danh mục; xem thông tin app; backup/restore JSON       |
| **Streak**    | Tính chuỗi ngày có ≥1 giao dịch *complete* (kể cả giao dịch nhập bù ngày cũ)       |

### 4.2 Out of scope (hiện tại)

- Đăng nhập / đồng bộ cloud đa thiết bị.
- Ngân sách / cảnh báo vượt hạn mức.
- Đa tiền tệ.
- OCR offline (không cần mạng).
- UI hộp thư giao dịch `pending` (DB đã hỗ trợ, chưa có màn hình riêng).

---

## 5. Kiến trúc màn hình & điều hướng

### 5.1 Tab bar & stack

```text
Tab bar:  Trang chủ · Thống kê · [+] Camera · Tài khoản · Cài đặt

Stack:
  /camera        — chụp / chọn ảnh
  /form          — form thu/chi (tạo mới hoặc chỉnh sửa)
  /(tabs)/*      — các màn hình trong tab bar
```

- Tab giữa là **FAB `+`** mở camera (`camera-tab` → `/camera`).
- Từ `/camera` → `/form?imageUri=...&transactionDate=...`.
- Từ `/form`:
  - Lưu → quay lại màn trước (thường là Trang chủ hoặc Accounts).
  - Khi sửa giao dịch: `/form?transactionId=...&isEdit=true`.

### 5.2 Trang chủ

- Lời chào theo giờ + badge streak + card tổng Thu/Chi tháng hiện tại.
- Filter người trả:
  - `Tất cả` + danh sách người trả từ bảng `payers`.
- Lịch tháng:
  - Ô ngày hiển thị: emoji danh mục chính, thumbnail ảnh (nếu có), badge số giao dịch.
- Chạm vào một ngày:
  - Mở bottom sheet:
    - Danh sách giao dịch của ngày (scrollable).
    - Hành động: Sửa, Xoá, Thêm giao dịch mới (ngày mặc định là ngày đang chọn).

### 5.3 Form thu/chi

- Header:
  - Ảnh mờ nền (nếu form xuất phát từ ảnh).
  - Toggle Thu/Chi (ảnh hưởng màu header).
  - Số tiền hiển thị lớn, dễ bấm.
- Các trường:
  - Số tiền (VNĐ, integer, định dạng `vi-VN`).
  - Loại: `chi` \| `thu`.
  - Danh mục (dropdown, lọc theo loại).
  - Người trả.
  - Nguồn tiền.
  - Ngày giao dịch.
  - Mô tả (TextInput, có thể gõ dài).
- Bàn phím số:
  - Luôn hiển thị ở đáy màn khi chỉnh số tiền.
  - Tạm ẩn khi focus vào ô mô tả.
- AI:
  - Tự quét khi form được mở với ảnh mới.
  - Có nút “Quét lại” để gọi AI thủ công.
- Quy tắc:
  - **Không** thêm danh mục mới trực tiếp từ form.
  - CRUD danh mục/người trả/nguồn tiền chỉ ở màn Cài đặt.

### 5.4 Camera

- Native (iOS/Android):
  - Preview toàn màn.
  - Nút chụp lớn, hỗ trợ flash, lật camera.
  - Nút mở thư viện ảnh.
  - Nút “Bỏ qua” để vào form không có ảnh.
- Web:
  - Thay camera bằng upload / kéo‑thả file ảnh.
  - Sau khi chọn file → đi tiếp như native (nén ảnh + gửi AI).

### 5.5 Thống kê

- Chọn kỳ:
  - Theo tháng (mặc định tháng hiện tại).
  - Có thể mở rộng: năm / tất cả (tuỳ lộ trình).
- Bộ lọc:
  - Người trả (Tất cả hoặc từng người).
- Nội dung:
  - Donut chart theo danh mục Chi (có thể hiển thị Thu sau).
  - Danh sách top danh mục / top giao dịch (limit ~50).
  - Tổng Thu, tổng Chi và chênh lệch.

### 5.6 Tài khoản

- Thông tin:
  - Tổng số dư hiện tại (tính từ tất cả nguồn tiền).
  - Bảng từng nguồn tiền: Tổng Thu, Tổng Chi, Số dư.
- Hành vi:
  - Nút Thêm giao dịch từ đây cũng đi qua `/camera` hoặc `/form`.

### 5.7 Cài đặt

Thứ tự section:

1. **Về ứng dụng** — tên, phiên bản, thông tin lưu trữ (local-first).
2. **Thẻ tóm tắt** — Streak, Privacy, Phiên bản, Storage.
3. **Người trả** — thêm/sửa/xoá (tên, emoji, màu).
4. **Nguồn tiền** — thêm/sửa/xoá (ví, thẻ, chuyển khoản…).
5. **Danh mục** — thêm/sửa/xoá, lọc theo Chi/Thu/Tất cả.
6. **Sao lưu & Khôi phục** — export/import JSON.

**Quy tắc xoá:**

- Người trả:
  - Luôn phải còn ≥ 1 người trả.
  - Không xoá nếu còn giao dịch đang dùng người trả đó (gợi ý đổi tên thay vì xoá).
- Nguồn tiền:
  - Luôn phải còn ≥ 1 nguồn tiền.
  - Khi xoá, giao dịch cũ mất liên kết nguồn (hiển thị “Không rõ nguồn”).
- Danh mục:
  - Khi xoá, giao dịch cũ mất liên kết danh mục (hiển thị “Không rõ danh mục”).

---

## 6. Luồng nghiệp vụ chính

### 6.1 Ghi từ ảnh hoá đơn

```text
Tab [+] hoặc Tài khoản [+ Thêm]
  → /camera
  → Chụp ảnh hoặc chọn từ thư viện
  → /form?imageUri=...&transactionDate=...
  → AI quét: gợi ý amount + type + category + description
  → Người dùng chỉnh lại (nếu cần), chọn người trả + nguồn tiền
  → Lưu → quay về Trang chủ (lịch)
```

### 6.2 Nhập tay (không ảnh)

```text
Trang chủ → chọn ngày → Thêm giao dịch
  → /form?transactionDate=YYYY-MM-DD (không imageUri)
  → Nhập tay tất cả trường
  → Lưu
```

### 6.3 Sửa / xoá giao dịch

```text
Trang chủ → chọn ngày → bottom sheet danh sách
  → Sửa → /form?transactionId=...&isEdit=true
  → Xoá → hộp thoại xác nhận → cập nhật DB, reload list
```

### 6.4 Nhập bù ngày cũ

```text
Trang chủ → chọn một ngày trong quá khứ → Thêm giao dịch
  → /camera hoặc /form với ngày mặc định = ngày được chọn
  → Lưu → streak được tính lại từ tập ngày có giao dịch
```

### 6.5 Backup & restore

```text
Cài đặt → Sao lưu & Khôi phục

Backup:
  → Xuất JSON đầy đủ (toàn bộ bảng liên quan)
  → Share / lưu file tuỳ nền tảng (Files, Drive, v.v.)

Restore:
  → Chọn JSON đã backup
  → Xác nhận ghi đè toàn bộ DB hiện tại
  → Reload app / màn hình chính sau khi thành công
```

---

## 7. Dữ liệu nghiệp vụ (tóm tắt)

| Thực thể       | Vai trò                                                                 |
|----------------|-------------------------------------------------------------------------|
| **Giao dịch**  | Số tiền VNĐ, Thu/Chi, ngày, người trả (text), danh mục (FK), nguồn tiền (FK), mô tả, ảnh, trạng thái (`pending`/`complete`) |
| **Danh mục**   | Phân loại Chi/Thu; emoji + màu; seed khoảng 17 danh mục mặc định       |
| **Nguồn tiền** | Ví tiền mặt, tài khoản ngân hàng, ví điện tử…                          |
| **Người trả**  | Vợ, Chồng, … (tùy chỉnh); lưu bằng text trong giao dịch                |
| **Streak**     | Số ngày liên tiếp có giao dịch `complete`; tính từ bảng `transactions` |

Chi tiết schema SQL xem ở `README.md` → *Data Model (SQLite)*.

---

## 8. AI — Hành vi sản phẩm

| Khía cạnh        | Mô tả                                                                                 |
|------------------|---------------------------------------------------------------------------------------|
| Khi nào gọi      | Khi mở form với ảnh mới, hoặc khi người dùng nhấn “Quét lại”                         |
| Đầu vào          | Ảnh hoá đơn hoặc ảnh món / sản phẩm (sau khi đã được nén resize + JPEG)              |
| Hoá đơn          | AI cố gắng đọc số tiền, phân loại chi/thu, gợi ý danh mục và mô tả                   |
| Ảnh món/SP       | AI không tự suy số tiền; amount mặc định 0, người dùng nhập tay                      |
| Yêu cầu mạng     | Có; nếu mất mạng thì bỏ qua AI, người dùng nhập tay                                  |
| API key          | Người dùng cấu hình Groq / Gemini qua .env hoặc màn Cài đặt (lưu vào AsyncStorage)   |
| Hành vi lỗi      | Nếu key sai / hết quota / timeout, hiển thị thông báo ngắn gọn, cho phép nhập tay    |

Chain provider (chi tiết kỹ thuật ở `README.md`): Groq → Gemini Flash‑Lite → Gemini Flash, có cơ chế skip provider khi lỗi 4xx/5xx, timeout, payload quá lớn.

---

## 9. Yêu cầu phi chức năng

| Hạng mục   | Yêu cầu                                                                 |
|------------|-------------------------------------------------------------------------|
| Nền tảng   | iOS, Android, Web (browser modern)                                     |
| Ngôn ngữ   | Tiếng Việt                                                              |
| Định dạng  | Tiền tệ VNĐ, format `vi-VN`                                            |
| Offline    | Đọc/ghi DB offline; chỉ AI/backup phụ thuộc mạng                       |
| Privacy    | Không server app; không sync dữ liệu; backup JSON do người dùng nắm giữ |
| UX modal   | Bottom sheet không bị tab bar / system navbar che nội dung quan trọng  |

---

## 10. Thiết kế & Brand

- **Màu sắc:** pastel sakura (hồng) cho chi, mint cho thu, nền cream; hạn chế đỏ/xanh gắt.
- **Tab bar:** icon emoji + nhãn text; nút `+` nổi giữa mở camera.
- **Form:** header gradient đổi theo Thu/Chi; bàn phím số pastel 3×4.
- **Typography & layout:** thân thiện, dễ đọc, không overload thông tin.

Token màu cụ thể được định nghĩa tại `src/constants/theme.ts`.

---

## 11. Ràng buộc & giả định

- Một giao dịch = một số tiền nguyên (VNĐ).
- Ngày giao dịch không được > ngày hiện tại (không ghi tương lai).
- Lịch / báo cáo tháng không vượt quá tháng hiện tại (ưu tiên tháng hiện tại trước).
- Thương hiệu:
  - UI hiển thị: **YueDaily**.
  - Tên DB / file backup: **yozakura** (ghép với tên repo Yozakura).

---

## 12. Lộ trình gợi ý

| Ưu tiên | Hạng mục                                    |
|---------|---------------------------------------------|
| P1      | UI nhập API key trong Cài đặt (ẩn key, validate) |
| P2      | Màn hình inbox cho giao dịch `pending`     |
| P2      | Ngân sách theo danh mục / người trả        |
| P3      | Widget / shortcut chụp nhanh               |
| P3      | Export CSV bổ sung cho JSON backup         |

---

## 13. Tài liệu liên quan

| Tài liệu                | Nội dung                                                       |
|-------------------------|----------------------------------------------------------------|
| [`README.md`](./README.md) | Setup dev, build EAS, schema SQLite chi tiết, kiến trúc code, AI technical notes |


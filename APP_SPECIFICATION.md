# YueDaily — Đặc tả sản phẩm (PRD)

> **Loại tài liệu:** Product Requirements Document  
> **Phiên bản:** 1.4.1 · **Cập nhật:** 2026-08-12  
> **Trạng thái:** Đang phát triển (Expo SDK 54, React Native 0.81, React 19)

**Đọc tài liệu này khi cần biết app *là gì*, *cho ai*, *làm gì* và *làm như thế nào ở mức sản phẩm*.**  
Chi tiết kỹ thuật (cài đặt, build, schema DB, kiến trúc code) → [`README.md`](./README.md).

---

## 1. Tóm tắt

**YueDaily** (tên repo / DB: **Yozakura**) là app theo dõi chi tiêu gia đình cho người Việt, ưu tiên:

- **Local-first:** dữ liệu lưu 100% trên thiết bị bằng SQLite, không cần tài khoản, không server app.
- **Nhập nhanh:** chụp hoá đơn → AI quét → gợi ý số tiền, danh mục, mô tả → chỉnh lại nhanh rồi lưu.
- **Theo người trả & chi cho ai:** mọi giao dịch gắn *người trả* và *đối tượng hưởng* (`expense_audience`: Vợ, Chồng, 2 vợ chồng, …) để xem chi tiêu theo cả hai chiều.
- **Minh bạch:** lịch tháng, báo cáo danh mục, chi theo nguồn tiền, dễ kiểm tra lại.

Tag: cá nhân/ gia đình · offline‑friendly · privacy‑first.

---

## 2. Mục tiêu & chỉ số thành công

| Mục tiêu          | Chỉ số thành công                                          |
|-------------------|------------------------------------------------------------|
| Ghi nhanh         | ≤ 30 giây từ chụp ảnh đến lưu (khi AI hoạt động bình thường) |
| Duy trì thói quen | Streak ngày liên tiếp hiển thị rõ ràng, dễ “giữ streak”   |
| Phân bổ gia đình  | Lọc theo *người trả* và *chi cho ai* trên Trang chủ / Thống kê |
| Riêng tư          | 100% dữ liệu on-device; AI chỉ dùng khi quét ảnh          |
| An toàn dữ liệu   | Backup/restore JSON đầy đủ, không mất dữ liệu nghiệp vụ (kể cả `expense_audience`) |

---

## 3. Personas

### 3.1 Vợ chồng / hộ gia đình nhỏ (chính)

- Cùng chi tiêu, muốn biết *tháng này ai trả nhiều hơn*, *chi cho ai* (vợ, chồng, cả nhà, …), chi cho những nhóm gì.
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
| **Trang chủ** | Lịch tháng, lọc *người trả*, xem tổng chi tháng, xem/sửa/xoá/thêm giao dịch; bottom sheet ngày có summary tổng chi + số giao dịch; giao dịch hiện nhãn *Chi cho: …* |
| **Camera**    | Chụp ảnh hoá đơn (native) hoặc chọn file (web); có thể bỏ qua để nhập tay          |
| **Form giao dịch** | Nhập số tiền, danh mục, người trả, *chi cho ai*, nguồn tiền, ngày, mô tả; quét AI |
| **Thống kê**  | Donut theo danh mục, biểu đồ chi theo ngày (kỳ tháng), danh sách giao dịch; kỳ: ngày / tháng / khoảng tùy chỉnh; lọc người trả & *chi cho*; tìm kiếm giao dịch; tổng chi theo đối tượng |
| **Tài khoản** | Báo cáo chi theo từng nguồn tiền (Tiền mặt, Chuyển khoản, …); không hiển thị số dư |
| **Cài đặt**   | CRUD người trả, nguồn tiền, danh mục; xem thông tin app; backup/restore JSON       |
| **Streak**    | Tính chuỗi ngày có ≥1 giao dịch *complete* (kể cả giao dịch nhập bù ngày cũ)       |

### 4.2 Out of scope (hiện tại)

- Đăng nhập / đồng bộ cloud đa thiết bị.
- Ngân sách / cảnh báo vượt hạn mức.
- Đa tiền tệ.
- OCR offline (không cần mạng).
- UI / flow hộp thư giao dịch `pending` (cột `status` giữ cho backup cũ; không có producer UI).
- UI nhập / quản lý API key AI trong Cài đặt (key cấu hình qua `.env` / build env).
- Ghi lại giao dịch tương tự (repeat transaction).
- Export CSV.
- Thu nhập / income, cash-flow, opening balance, chuyển khoản nội bộ giữa tài khoản.
- Chia một giao dịch cho nhiều người / chia tiền theo đầu người.
- Bảng beneficiary riêng, quản lý shop / lương / vốn.

---

## 5. Kiến trúc màn hình & điều hướng

### 5.1 Tab bar & stack

```text
Tab bar:  Trang chủ · Thống kê · [+] Camera · Tài khoản · Cài đặt

Stack:
  /camera        — chụp / chọn ảnh
  /form          — form giao dịch chi tiêu (tạo mới hoặc chỉnh sửa)
  /(tabs)/*      — các màn hình trong tab bar
```

- Tab giữa là **FAB `+`** mở camera (`camera-tab` → `/camera`).
- Từ `/camera` → `/form?imageUri=...&transactionDate=...`.
- Từ `/form`:
  - Lưu → quay lại màn trước (thường là Trang chủ hoặc Accounts).
  - Khi sửa giao dịch: `/form?transactionId=...&isEdit=true`.

### 5.2 Trang chủ

- Lời chào theo giờ + badge streak + card tổng chi tháng hiện tại.
- Filter người trả:
  - `Tất cả` + danh sách người trả từ bảng `payers`.
- Lịch tháng:
  - Ô ngày hiển thị: emoji danh mục chính, thumbnail ảnh (nếu có), badge số giao dịch.
- Chạm vào một ngày:
  - Mở bottom sheet:
    - **Summary ngày** (phía trên danh sách, tuân theo filter *người trả* hiện tại):
      - Ngày được chọn.
      - Tổng chi trong ngày.
      - Số giao dịch.
    - Danh sách giao dịch của ngày (scrollable).
    - Giao dịch hiển thị nhãn ngắn `Chi cho: …` (không đổi layout lớn).
    - Hành động: Sửa, Xoá, Thêm giao dịch mới (ngày mặc định là ngày đang chọn).

### 5.3 Form giao dịch

- Header:
  - Ảnh mờ nền (nếu form xuất phát từ ảnh).
  - Số tiền hiển thị lớn, dễ bấm.
- Layout field (mỗi field có label nhỏ phía trên, không dùng placeholder làm label):

  | Hàng | Layout | Trường |
  |------|--------|--------|
  | 1 | Hai cột | Danh mục · Ai trả |
  | 2 | Full width | Chi cho ai |
  | 3 | Hai cột | Nguồn tiền · Ngày giao dịch |

- Các trường:
  - Số tiền (VNĐ, integer, định dạng `vi-VN`).
  - Danh mục (dropdown, chỉ danh mục chi tiêu).
  - Người trả (dropdown).
  - **Chi cho ai** (dropdown, luôn hiển thị) — giá trị lưu `expense_audience`:
    - `wife` — Vợ
    - `husband` — Chồng
    - `couple` — 2 vợ chồng *(mặc định khi tạo mới)*
    - `couple_and_sister` — 2 vợ chồng + em gái
    - `unspecified` — Chưa phân loại *(giao dịch cũ sau migration; hiện khi sửa, không hiện khi tạo mới)*
  - Nguồn tiền (dropdown) — phương thức/nguồn dùng để thanh toán, không dùng để tính số dư thực tế.
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
  - **Ngày** — xem báo cáo một ngày cụ thể.
  - **Tháng** — mặc định tháng hiện tại.
  - **Khoảng thời gian tùy chỉnh** — chọn `fromDate → toDate`; không cho chọn ngày tương lai.
- Bộ lọc (kết hợp với kỳ đã chọn):
  - Người trả (Tất cả hoặc từng người).
  - **Chi cho** (Tất cả, 4 nhóm + Chưa phân loại).
- Tìm kiếm giao dịch (kết hợp với kỳ và filter hiện tại):
  - Theo mô tả, số tiền, danh mục, người trả.
- Nội dung chung (tuân theo kỳ và filter):
  - Donut chart theo danh mục chi tiêu.
  - Danh sách top danh mục / danh sách giao dịch (limit ~50); giao dịch kèm nhãn `Chi cho: …`.
  - **Tổng chi theo từng `expense_audience`** (không chia tiền theo đầu người).
- **Khi xem theo Ngày**, hiển thị thêm:
  - Tổng chi, số giao dịch, trung bình / giao dịch.
  - Chi theo danh mục, chi theo người trả, chi theo `expense_audience`.
  - Danh sách giao dịch trong ngày.
- **Khi xem theo Tháng**, hiển thị thêm:
  - Biểu đồ chi tiêu theo ngày — mỗi ngày thể hiện tổng chi trong ngày.
  - Insight: trung bình chi / ngày, ngày chi cao nhất trong kỳ.
- **Khi xem theo Khoảng tùy chỉnh**: các summary, chart và filter áp dụng đúng range `fromDate → toDate`.

### 5.6 Tài khoản

- Màn hình báo cáo **chi theo nguồn tiền** (không hiển thị số dư tài khoản):
  - Tổng chi (theo filter kỳ hiện tại, nếu có).
  - Bảng từng nguồn tiền: tổng chi qua nguồn đó.
- Hành vi:
  - Nút Thêm giao dịch từ đây cũng đi qua `/camera` hoặc `/form`.

### 5.7 Cài đặt

Thứ tự section:

1. **Về ứng dụng** — tên, phiên bản, thông tin lưu trữ (local-first).
2. **Thẻ tóm tắt** — Streak, Privacy, Phiên bản, Storage.
3. **Người trả** — thêm/sửa/xoá (tên, emoji, màu).
4. **Nguồn tiền** — thêm/sửa/xoá (ví, thẻ, chuyển khoản…).
5. **Danh mục** — thêm/sửa/xoá danh mục chi tiêu.
6. **Sao lưu & Khôi phục** — export/import JSON (giữ `expense_audience`).

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
  → AI quét: gợi ý amount + category + description
  → Người dùng chỉnh lại (nếu cần), chọn người trả + chi cho ai + nguồn tiền
  → Lưu → quay về Trang chủ (lịch)
```

### 6.2 Nhập tay (không ảnh)

```text
Trang chủ → chọn ngày → Thêm giao dịch
  → /form?transactionDate=YYYY-MM-DD (không imageUri)
  → Nhập tay tất cả trường (chọn chi cho ai, mặc định 2 vợ chồng)
  → Lưu
```

### 6.3 Sửa / xoá giao dịch

```text
Trang chủ → chọn ngày → bottom sheet danh sách
  → Sửa → /form?transactionId=...&isEdit=true
     (giao dịch cũ chưa phân loại → hiện “Chưa phân loại”, cho chọn lại)
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
  → Xuất JSON đầy đủ (toàn bộ bảng liên quan, gồm expense_audience)
  → Share / lưu file tuỳ nền tảng (Files, Drive, v.v.)

Restore:
  → Chọn JSON đã backup
  → Backup cũ thiếu expense_audience → mặc định unspecified (không crash)
  → Xác nhận ghi đè toàn bộ DB hiện tại
  → Reload app / màn hình chính sau khi thành công
```

---

## 7. Dữ liệu nghiệp vụ (tóm tắt)

| Thực thể       | Vai trò                                                                 |
|----------------|-------------------------------------------------------------------------|
| **Giao dịch**  | Số tiền VNĐ, ngày, người trả (text), **chi cho ai** (`expense_audience`), danh mục (FK), nguồn tiền (FK), mô tả, ảnh, trạng thái (`pending`/`complete`); app chỉ ghi nhận chi tiêu |
| **Danh mục**   | Phân loại chi tiêu; emoji + màu; seed khoảng 17 danh mục mặc định       |
| **Nguồn tiền** | Phương thức/nguồn thanh toán (tiền mặt, tài khoản ngân hàng, ví điện tử…); dùng để báo cáo chi, không tính số dư thực tế |
| **Người trả**  | Vợ, Chồng, … (tùy chỉnh); lưu bằng text trong giao dịch                |
| **Streak**     | Số ngày liên tiếp có giao dịch `complete`; tính từ bảng `transactions` |

**`expense_audience`:**

| Giá trị | Label UI |
|---------|----------|
| `wife` | Vợ |
| `husband` | Chồng |
| `couple` | 2 vợ chồng |
| `couple_and_sister` | 2 vợ chồng + em gái |
| `unspecified` | Chưa phân loại |

- Giao dịch mới: mặc định `couple`.
- Migration DB cũ: cột mới với mặc định `unspecified` cho bản ghi sẵn có (không tự gán `couple`).
- Không chia một giao dịch cho nhiều đối tượng; không chia tiền theo đầu người.

Chi tiết schema SQL xem ở `README.md` → *Data Model (SQLite)*.

---

## 8. AI — Hành vi sản phẩm

| Khía cạnh        | Mô tả                                                                                 |
|------------------|---------------------------------------------------------------------------------------|
| Khi nào gọi      | Khi mở form với ảnh mới, hoặc khi người dùng nhấn “Quét lại”                         |
| Đầu vào          | Ảnh hoá đơn hoặc ảnh món / sản phẩm (sau khi đã được nén resize + JPEG)              |
| Hoá đơn          | AI cố gắng đọc số tiền, gợi ý danh mục và mô tả                   |
| Ảnh món/SP       | AI không tự suy số tiền; amount mặc định 0, người dùng nhập tay                      |
| Yêu cầu mạng     | Có; nếu mất mạng thì bỏ qua AI, người dùng nhập tay                                  |
| API key          | Cấu hình Groq / Gemini qua `.env` hoặc biến môi trường build (EAS); không có màn quản lý key cho người dùng |
| Hành vi lỗi      | Nếu key sai / hết quota / timeout, hiển thị thông báo ngắn gọn, cho phép nhập tay    |

Chain provider (chi tiết kỹ thuật ở `README.md`): Groq → Gemini Flash‑Lite → Gemini Flash, có cơ chế skip provider khi lỗi 4xx/5xx, timeout, payload quá lớn.

> AI **không** gợi ý `expense_audience`; người dùng chọn trên form.

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

- **Màu sắc:** pastel sakura (hồng) cho chi tiêu, nền cream; hạn chế đỏ/xanh gắt.
- **Tab bar:** icon emoji + nhãn text; nút `+` nổi giữa mở camera.
- **Form:** header gradient chi tiêu; bàn phím số pastel 3×4; label field màu lavender muted; dropdown đồng nhất chiều cao.
- **Typography & layout:** thân thiện, dễ đọc, không overload thông tin.

Token màu cụ thể được định nghĩa tại `src/constants/theme.ts`.

---

## 11. Ràng buộc & giả định

- Một giao dịch = một khoản chi tiêu, một số tiền nguyên (VNĐ).
- Một giao dịch = đúng một giá trị `expense_audience` (không split).
- Ngày giao dịch không được > ngày hiện tại (không ghi tương lai).
- Kỳ báo cáo (ngày, tháng, khoảng tùy chỉnh) không cho chọn ngày tương lai.
- Lịch / báo cáo tháng không vượt quá tháng hiện tại (ưu tiên tháng hiện tại trước).
- Không có opening balance, chuyển khoản nội bộ, thu nhập hay cash-flow.
- Thương hiệu:
  - UI hiển thị: **YueDaily**.
  - Tên DB / file backup: **yozakura** (ghép với tên repo Yozakura).

---

## 12. Lộ trình gợi ý

### Đã hoàn thành (P1)

| Hạng mục | Ghi chú |
|----------|---------|
| Daily summary | Bottom sheet ngày trên Trang chủ |
| Daily report | Báo cáo theo ngày trong Thống kê |
| Daily spending chart | Biểu đồ chi theo ngày, kỳ tháng |
| Custom date range | `fromDate → toDate` |
| Search transaction | Mô tả, số tiền, danh mục, người trả |

### Cân nhắc tiếp (chưa cam kết)

| Ưu tiên | Hạng mục | Ghi chú |
|---------|----------|---------|
| P2 | Ngân sách theo danh mục / người trả | Cảnh báo vượt hạn mức |
| P3 | Widget / shortcut chụp nhanh | Phụ thuộc nền tảng |

Các hạng mục **không** nằm trong lộ trình: UI API key Cài đặt, repeat transaction, export CSV, pending inbox, thu nhập / cash-flow / opening balance.

---

## 13. Tài liệu liên quan

| Tài liệu                | Nội dung                                                       |
|-------------------------|----------------------------------------------------------------|
| [`README.md`](./README.md) | Setup dev, build EAS, schema SQLite chi tiết, kiến trúc code, AI technical notes |

# YueDaily — Đặc tả sản phẩm (PRD)

> **Loại tài liệu:** Product Requirements Document  
> **Phiên bản:** 1.5.4 · **Cập nhật:** 2026-08-16  
> **Trạng thái:** Đang phát triển (Expo SDK 54, React Native 0.81, React 19)  
> **Phase hiện tại:** P1.5.4 — Home monitoring theo Nguồn chi

**Đọc tài liệu này khi cần biết app *là gì*, *cho ai*, *làm gì* và *làm như thế nào ở mức sản phẩm*.**  
Chi tiết kỹ thuật (cài đặt, build, schema DB, kiến trúc code) → [`README.md`](./README.md).

> README / Data Model cần cập nhật tương ứng sau khi PRD này được duyệt.  
> Phase này **chưa** implement Budget, contribution, savings, reimbursement, transfer hoặc household cash-flow.

---

## 1. Tóm tắt

**YueDaily** (tên repo / DB: **Yozakura**) là app theo dõi chi tiêu cá nhân/gia đình do **Yue** trực tiếp sử dụng. Ưu tiên:

- **Local-first:** dữ liệu lưu 100% trên thiết bị bằng SQLite, không cần tài khoản, không server app.
- **Nhập nhanh:** chụp hoá đơn → AI quét → gợi ý số tiền, danh mục, mô tả → chỉnh lại nhanh rồi lưu (≤ 30 giây).
- **Ghi đúng hai chiều quan trọng:** mỗi giao dịch trả lời *khoản này lấy tiền từ đâu?* (`source_id` — **Nguồn chi**) và *khoản này chi cho ai?* (`expense_audience`).
- **Minh bạch:** lịch tháng, báo cáo danh mục, chi theo nguồn chi, chi theo đối tượng hưởng.
- **Privacy-first:** không account/cloud bắt buộc; backup/restore JSON do người dùng nắm giữ.
- **Không phải accounting app:** không quản lý số dư thực tế, không tính profit, không track thu nhập / cash-flow.

Tag: cá nhân/ gia đình · offline‑friendly · privacy‑first.

YueDaily ghi **fact** — tiền thực tế đã lấy từ nguồn nào — không ghi intended policy. Ví dụ: quỹ ăn là Woori nhưng Yue trả bằng tiền mặt của mình thì `source_id` phải là **Tiền mặt Yue**, không ghi Woori chỉ vì “đáng lẽ thuộc food budget”.

App **không** kết luận “ai bỏ tiền riêng” từ người physically thao tác thanh toán. Field `payer` (nếu còn trong dữ liệu cũ) không phải chiều báo cáo chính.

---

## 2. Mục tiêu & chỉ số thành công

| Mục tiêu | Chỉ số thành công |
|----------|-------------------|
| Ghi nhanh | ≤ 30 giây từ lúc bắt đầu nhập đến lưu (khi AI hoạt động bình thường). Form không bắt nhập người thanh toán / quỹ tiền / người duyệt. |
| Attribution correctness | Người dùng phân biệt được: *Lấy tiền từ đâu?* và *Chi cho ai?* mà không suy một field từ field khác. |
| Reporting correctness | App report đúng `source_id` đã chọn và đúng một `expense_audience`. Không dùng `payer` để suy ownership của tiền. Không gộp `Tiền mặt Yue` với `Tiền mặt Kai`. |
| Duy trì thói quen | Streak ngày liên tiếp hiển thị rõ ràng, dễ “giữ streak”. |
| Phân bổ gia đình | Lọc theo *Nguồn chi* và *Chi cho ai* trên Thống kê; hỗ trợ cross-filter (ví dụ Woori × Yue + Kai). |
| Riêng tư | 100% dữ liệu on-device; AI chỉ dùng khi quét ảnh. |
| An toàn dữ liệu | Backup/restore JSON đầy đủ; không mất `source_id`, `expense_audience`, hay legacy `payer`. Restore không tự merge source, không tự đổi audience, không migrate VCB Shop → Woori. |

---

## 3. Personas

### 3.1 Yue — người dùng chính

- Tự nhập gần như toàn bộ giao dịch mà mình biết.
- Cần biết *khoản này lấy tiền từ nguồn nào* và *chi cho ai* (Yue, Kai, Yue + Kai, Yue + Meo, Yue + Kai + Meo).
- Không cần track “ai physically quét QR / đưa tiền”.
- Nếu Kai tự chi khi Yue không có mặt và Yue không biết khoản đó, YueDaily **không** cố trở thành sổ đầy đủ chi tiêu độc lập của Kai.
- Ít thời gian, không muốn học app phức tạp.
- UI tiếng Việt, emoji và màu pastel dễ chịu.

### 3.2 Hộ gia đình nhỏ quanh Yue

- Thành viên: **Yue** (người dùng app), **Kai** (chồng), **Meo** (em gái Yue).
- Tiền cá nhân Yue, tiền mặt Kai, quỹ ăn Woori và (lịch sử) VCB Shop là các *nguồn chi* khác nhau — không gộp.
- Household đang thử food arrangement mới qua **Woori · Quỹ ăn**. Budget engine chưa thuộc phase này.

### 3.3 Người ghi chép hàng ngày

- Thói quen chụp hoá đơn sau khi thanh toán.
- Ưu tiên: nhập càng nhanh càng tốt, không phải gõ nhiều.
- Quan tâm: streak, tổng chi trong tháng, top danh mục, chi theo nguồn chi, chi cho ai.

### 3.4 Người coi trọng privacy

- Không muốn tạo tài khoản, không sync cloud bắt buộc.
- Chấp nhận backup thủ công (export file JSON) để tự lưu trữ.

### 3.5 Người dùng Web (phụ)

- Muốn nhập bằng máy tính, upload ảnh thay vì chụp camera native.
- Tính năng / UX nền tảng Web giữ nguyên nghiệp vụ, camera thay bằng file picker.

---

## 4. Phạm vi sản phẩm

### 4.1 In scope

| Module | Hành vi người dùng |
|--------|---------------------|
| **Trang chủ** | Lịch tháng, xem tổng chi tháng, xem/sửa/xoá/thêm giao dịch; bottom sheet ngày có summary tổng chi + số giao dịch; giao dịch hiện nhãn *Chi cho: …* và *Nguồn: …*. Không ưu tiên hiển thị người thanh toán. |
| **Camera** | Chụp ảnh hoá đơn (native) hoặc chọn file (web); có thể bỏ qua để nhập tay. |
| **Form giao dịch** | Nhập số tiền, danh mục, chi cho ai, nguồn chi, ngày, mô tả; quét AI. **Không** có Người thanh toán / Quỹ tiền / Người duyệt trên form chính. |
| **Thống kê** | Donut theo danh mục, biểu đồ chi theo ngày (kỳ tháng), danh sách giao dịch; kỳ: ngày / tháng / khoảng tùy chỉnh; lọc danh mục, nguồn chi, chi cho ai; tìm kiếm giao dịch; tổng chi theo đối tượng; báo cáo **Chi theo nguồn**. |
| **Tài khoản** | Báo cáo chi theo từng *Nguồn chi* (`source_id`); **không** hiển thị số dư; **không** biến thành dashboard budget. |
| **Cài đặt** | CRUD nguồn chi, danh mục; xem thông tin app; backup/restore JSON. CRUD người thanh toán không còn là surface chính. |
| **Streak** | Tính chuỗi ngày có ≥1 giao dịch *complete* (kể cả giao dịch nhập bù ngày cũ). |

**P1.5 — Source & Audience Foundation (scope lần cập nhật này):**

- Mô hình giao dịch **source-first**: `source_id` là chiều attribution chính; terminology UI = **Nguồn chi**.
- Bỏ *Người thanh toán* / *Ai trả* khỏi form chính và khỏi core product goal.
- Chuẩn hóa UI labels audience thành Yue / Kai / Meo; thêm **Yue + Meo**.
- Tách **Tiền mặt Yue** và **Tiền mặt Kai**; thêm **Woori · Quỹ ăn** như source (example/config của Yue).
- Giữ **VCB Shop** cho lịch sử; không retroactively chuyển sang Woori.
- Cập nhật form, thống kê/filter theo nguồn chi + chi cho ai, backup/restore, migration an toàn.
- **Không** triển khai `funding_pool`, `approved_by`, `expense_nature`, `budget_bucket`.

### 4.2 Out of scope (hiện tại — giữ nguyên / mở rộng)

**Nền tảng / hạ tầng (giữ từ trước):**

- Đăng nhập / đồng bộ cloud đa thiết bị.
- Đa tiền tệ.
- OCR offline (không cần mạng).
- UI / flow hộp thư giao dịch `pending` (cột `status` giữ cho backup cũ; không có producer UI).
- UI nhập / quản lý API key AI trong Cài đặt (key cấu hình qua `.env` / build env).
- Ghi lại giao dịch tương tự (repeat transaction).
- Export CSV.

**Không biến YueDaily thành accounting / cash-flow app:**

- Thu nhập / income, cash-flow, opening balance, chuyển khoản nội bộ giữa nguồn.
- Quản lý số dư thực tế (`account balance`), kể cả số dư Woori.
- Bank sync.
- Accounting cho TOKUani Shop, profit calculation, owner draw, dividend, salary.
- Chia một giao dịch cho nhiều người / chia tiền theo đầu người / split bill / beneficiary allocation.
- Reimbursement / transfer khi Yue trả hộ quỹ ăn.
- Source grouping / `funding_group`.
- Bảng beneficiary riêng, quản lý shop / lương / vốn.

**Không thêm attribution layer phụ trong P1.5:**

- `funding_pool` (quỹ tiền).
- `approved_by` (người duyệt).
- `expense_nature` (`normal` / `one_off` / `recurring`).
- `budget_bucket`.

**Budget & household spending — roadmap tương lai, không thuộc P1.5:**

- Monthly budget, food budget, budget target (kể cả 7.500.000đ), remaining food balance, soft ceiling.
- Weekday/weekend allowance, personal allowance.
- Contribution tracking của Yue/Kai; top-up Woori.
- Budget rollover, budget warning, month-end leftover / sweep.
- Savings goals, Family Savings, TPBank savings (savings không phải expense; không track số tiền tiết kiệm hiện có).
- Big spend insight, one-off vs recurring.

`expense_nature` **không** triển khai ở P1.5. Có thể thêm cùng Budget/Insights ở P1.6–P1.7.

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

Không overload Home. Giữ:

- Lời chào theo giờ + badge streak + card tổng chi tháng hiện tại.
- **Quick monitoring** (theo **Nguồn chi**, không theo `expense_audience`; không persist; không thêm field trên transaction):
  - `Tất cả` — mọi giao dịch chi `complete` trong tháng đang xem, gồm personal, household, và nguồn chưa phân loại (mặc định khi mở app).
  - `Cá nhân Yue` — `sources.spending_group = personal_yue` (seed: VPBank, Tiền mặt Yue).
  - `Quỹ chung` — `sources.spending_group = household` (seed: Woori · Quỹ ăn, Tiền mặt Kai).
  - `expense_audience` (**Chi cho ai**) không quyết định tab. Yue + Woori → Quỹ chung; Yue + VPBank → Cá nhân Yue; Kai + Woori → Quỹ chung.
  - Nguồn legacy không classify (`Tiền mặt`, `Chuyển khoản`, `VCB Shop`) → `spending_group` NULL, chỉ hiện trong Tất cả.
  - Archived source vẫn report theo `spending_group` đã gắn; `is_active` không lọc lịch sử.
  - Selection áp dụng cho **cả màn**: tổng tháng, lịch (marker/ảnh/số GD), summary ngày, danh sách bottom sheet. Đổi tháng giữ mode trong session.
- Lịch tháng:
  - Ô ngày hiển thị: emoji danh mục chính, thumbnail ảnh (nếu có), badge số giao dịch.
- Chạm vào một ngày:
  - Mở bottom sheet:
    - **Summary ngày** (phía trên danh sách):
      - Ngày được chọn.
      - Tổng chi trong ngày.
      - Số giao dịch.
    - Danh sách giao dịch của ngày (scrollable).
    - Metadata ngắn trên từng giao dịch, ưu tiên:
      1. `Chi cho: …` (`expense_audience` — label Yue / Kai / Meo)
      2. `Nguồn: …` (`source_id` — tên nguồn chi)
    - **Không** cần hiển thị `Người thanh toán: …` trong normal UI. Legacy payer data không xóa, chỉ không ưu tiên hiện.
    - Hành động: Sửa, Xoá, Thêm giao dịch mới (ngày mặc định là ngày đang chọn).

Không thêm filter người thanh toán / quỹ tiền / người duyệt lên Trang chủ ở P1.5. Nếu filter payer đang tồn tại, có thể giữ tạm cho tương thích nhưng **không** còn là core product goal.

### 5.3 Form giao dịch

Mục tiêu: nhập ≤ 30 giây.

- Header:
  - Ảnh mờ nền (nếu form xuất phát từ ảnh).
  - Số tiền hiển thị lớn, dễ bấm.
- Layout field (mỗi field có label nhỏ phía trên, không dùng placeholder làm label):

  | Hàng | Layout | Trường |
  |------|--------|--------|
  | 1 | Hai cột | Danh mục · Chi cho ai |
  | 2 | Hai cột | Nguồn chi · Ngày giao dịch |
  | — | Full width | Mô tả |

- **Trường luôn hiển thị (critical path):**
  - Số tiền (VNĐ, integer, định dạng `vi-VN`).
  - Danh mục (dropdown, chỉ danh mục chi tiêu; **thường dùng trước** — `usage_count` giao dịch chi `complete`, không theo số tiền / tháng hiện tại).
  - **Chi cho ai** (dropdown) — `expense_audience`; label Yue / Kai / Meo.
  - **Nguồn chi** (dropdown) — `source_id`; **bắt buộc**; helper text nếu cần: *Khoản này lấy tiền từ đâu?* Form tạo mới chỉ liệt kê source **đang dùng** (`is_active`). Sửa giao dịch cũ: source archived hiện tại vẫn hiện + các source đang dùng; không đổi silently sang source khác.
  - Ngày giao dịch.
  - Mô tả (TextInput, có thể gõ dài).
- **Không có trên form P1.5:**
  - Người thanh toán / Ai trả (`payer`).
  - Quỹ tiền (`funding_pool`).
  - Người duyệt (`approved_by`).
  - Tính chất khoản chi (`expense_nature`).
- Bàn phím số:
  - Luôn hiển thị ở đáy màn khi chỉnh số tiền.
  - Tạm ẩn khi focus vào ô mô tả.
- AI:
  - Tự quét khi form được mở với ảnh mới.
  - Có nút “Quét lại” để gọi AI thủ công.
  - AI chỉ gợi ý amount, category, description — xem §8.
- Quy tắc:
  - **Không** thêm danh mục / nguồn chi mới trực tiếp từ form.
  - CRUD master data chỉ ở màn Cài đặt.
  - App **không** hard-block tổ hợp source × audience. YueDaily là tracker, không phải policy enforcement engine.

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
- Bộ lọc chính (kết hợp với kỳ đã chọn; các chiều độc lập, có thể cross-filter):
  - **Danh mục** (Tất cả hoặc từng danh mục).
  - **Nguồn chi** (Tất cả hoặc từng `source_id`).
  - **Chi cho** (Tất cả + các giá trị `expense_audience`, gồm Yue + Meo và Chưa phân loại).
- Tìm kiếm giao dịch (kết hợp với kỳ và filter hiện tại):
  - Theo mô tả, số tiền, danh mục.
- Filter `payer` (nếu đang tồn tại): có thể giữ tạm để backward compatibility; **không** còn là core product goal; roadmap có thể deprecate sau.
- Nội dung chung (tuân theo kỳ và filter):
  - Donut chart theo danh mục chi tiêu.
  - Danh sách top danh mục / danh sách giao dịch (limit ~50); giao dịch kèm nhãn `Chi cho: …` và `Nguồn: …`.
  - **Tổng chi theo từng `expense_audience`** (không chia tiền theo đầu người).
  - **Chi theo nguồn** — aggregation theo `source_id`. Wording: **Chi theo nguồn** (hoặc **Nguồn chi**). Ví dụ (config của Yue):

    ```text
    Woori · Quỹ ăn
    VPBank
    Tiền mặt Yue
    Tiền mặt Kai
    VCB Shop
    ```

- **Khi xem theo Ngày**, hiển thị thêm:
  - Tổng chi, số giao dịch, trung bình / giao dịch.
  - Chi theo danh mục, chi theo `expense_audience`, chi theo nguồn chi.
  - Danh sách giao dịch trong ngày.
- **Khi xem theo Tháng**, hiển thị thêm:
  - Biểu đồ chi tiêu theo ngày — mỗi ngày thể hiện tổng chi trong ngày.
  - Insight: trung bình chi / ngày, ngày chi cao nhất trong kỳ.
- **Khi xem theo Khoảng tùy chỉnh**: các summary, chart và filter áp dụng đúng range `fromDate → toDate`.

**Cross-filter bắt buộc P1.5 phải trả lời được:**

| Câu hỏi | Query ý nghĩa | Cách hiểu đúng | Không được hiểu |
|---------|---------------|----------------|-----------------|
| Food fund dùng cho hai người | `source = Woori · Quỹ ăn` AND `audience = Yue + Kai` | Tổng chi từ Woori hưởng bởi Yue + Kai | số dư Woori còn lại; monthly budget |
| Food fund khi có Meo đi cùng | `source = Woori · Quỹ ăn` AND `audience = Yue + Kai + Meo` | Tổng chi từ Woori khi cả ba | Meo tiêu một mình; split bill |
| Yue + Meo (social/personal) | `source IN (VPBank, Tiền mặt Yue)` AND `audience = Yue + Meo` | Chi Yue đi với Meo từ tiền cá nhân Yue | household food fund; Yue tiêu một mình |
| Personal Yue từ VPBank | `source = VPBank` AND `audience = Yue` | Chi Yue lấy từ VPBank | mọi khoản audience = Yue đều là personal |
| Historical VCB household | `source = VCB Shop` AND `audience = Yue + Kai` | Lịch sử đã ghi từ VCB Shop | tự chuyển thành Woori |

YueDaily không có đủ accounting context để gọi số “chi từ VCB Shop” là lợi nhuận hay rút vốn shop. App cũng **không** biết Woori còn bao nhiêu tiền.

### 5.6 Tài khoản

- Màn hình báo cáo **chi theo Nguồn chi** (`source_id`) — không hiển thị số dư:
  - Tổng chi (theo filter kỳ hiện tại, nếu có).
  - Bảng từng nguồn: tổng chi qua nguồn đó.
- Có thể hiển thị các source trong config của Yue:

  ```text
  Woori · Quỹ ăn
  VPBank
  Tiền mặt Yue
  Tiền mặt Kai
  VCB Shop
  ```

- **Không** đổi màn này thành budget dashboard hay funding-pool dashboard.
- Không bank sync, không opening balance, không biết Woori thực tế đang còn bao nhiêu.
- Tên ngân hàng / quỹ (Woori, VPBank, VCB, …) **không** phải logic domain bắt buộc — chỉ là `source` user cấu hình. Product phải generic / reusable.
- Hành vi:
  - Nút Thêm giao dịch từ đây cũng đi qua `/camera` hoặc `/form`.

### 5.7 Cài đặt

Thứ tự section:

1. **Giao diện** — sáng / tối / theo hệ thống.
2. **Thẻ tóm tắt** — Streak, Privacy, Phiên bản.
3. **Nguồn chi** — thêm/sửa; **Nhóm theo dõi** (Cá nhân Yue / Quỹ chung) khi tạo hoặc khi chưa có giao dịch; xoá khi chưa có giao dịch tham chiếu; Lưu trữ / Dùng lại khi đã có lịch sử.
4. **Danh mục** — thêm/sửa/xoá danh mục chi tiêu.
5. **Sao lưu & Khôi phục** — export/import JSON (gồm `sources`, `transaction.source_id`, `expense_audience` kể cả Yue + Meo, legacy `payer` nếu đang tồn tại).
6. **Về ứng dụng** — mô tả product hiện tại (Danh mục · Nguồn chi · Chi cho ai, local-first, không tài khoản / không đồng bộ ngân hàng, backup, giao diện). Phiên bản đọc từ metadata app.

CRUD **Người trả / Người thanh toán không còn trên Settings.** Cột/bảng `payer` giữ cho backup và giao dịch cũ; form không nhập field này.

**Nguồn chi — CRUD & seed:**

- Data model generic: user-configurable master data (tên, emoji, màu). **Không** hardcode ngân hàng / quỹ thành product enum.
- Installation của Yue dùng các source sau làm **example / default configuration** (không phải domain bắt buộc cho mọi user):

  | Ví dụ tên | Ý nghĩa vận hành (context, không encode thành rule DB) |
  |-----------|--------------------------------------------------------|
  | 🍚 Woori · Quỹ ăn | Tài khoản riêng cho tiền ăn chung; source, **không** phải budget engine |
  | 🏦 VPBank | Tiền cá nhân Yue |
  | 👛 Tiền mặt Yue | Tiền mặt Yue đang dùng; tách với tiền mặt Kai |
  | 💵 Tiền mặt Kai | Tiền mặt Kai đang dùng; tách với tiền mặt Yue |
  | 🏪 VCB Shop | Source lịch sử; không còn ưu tiên cho household/personal food mới |

- **Không gộp** `Tiền mặt Yue` và `Tiền mặt Kai` thành một source `Tiền mặt`.
- Source có lifecycle **đang dùng / đã lưu trữ** (`is_active`):
  - Archived ẩn khỏi form tạo giao dịch mới.
  - Giữ nguyên `source_id` lịch sử; Thống kê / Tài khoản / backup vẫn report đúng tên.
  - Sửa giao dịch cũ: source archived hiện tại vẫn representable; không migrate VCB Shop → Woori.
  - Last-selected source nếu đã archived thì không preselect cho giao dịch mới.
- `spending_group` là metadata của **Nguồn chi** (`personal_yue` | `household` | NULL) — dùng cho Home monitoring, **không** phải transaction scope / `expense_audience`.
  - Tạo nguồn mới: bắt buộc chọn Nhóm theo dõi. Không đoán từ tên.
  - Đã có giao dịch: khóa `spending_group` (đổi ý nghĩa → lưu trữ nguồn cũ, tạo nguồn mới). Vẫn được đổi tên / Lưu trữ / Dùng lại.
  - Seed/migration exact name: VPBank + Tiền mặt Yue → `personal_yue`; Woori · Quỹ ăn + Tiền mặt Kai → `household`. Không classify `Tiền mặt` / `Chuyển khoản` / `VCB Shop`.
- Installation Yue: archive exact seed names `Tiền mặt`, `Chuyển khoản`, `VCB Shop` nếu chúng tồn tại — không fuzzy, không xóa, không merge.

**Quy tắc xoá:**

- Nguồn chi:
  - Luôn phải còn ≥ 1 nguồn chi.
  - **Chưa từng được giao dịch tham chiếu** (`COUNT(transactions.source_id) = 0`) → cho phép **Xoá**. Không cascade, không null `source_id` của giao dịch khác.
  - **Đã có giao dịch** → không xoá; chỉ **Lưu trữ** / **Dùng lại**. UI báo: *Nguồn chi này đã có giao dịch nên chỉ có thể lưu trữ.* Repository enforce, không tin count cache trên UI.
  - Historical `VCB Shop` / `Tiền mặt` / `Chuyển khoản` nếu còn reference: archive, không delete.
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
     (KHÔNG gợi ý source_id / expense_audience / payer)
  → Người dùng chỉnh lại (nếu cần):
       chi cho ai + nguồn chi
  → Lưu → quay về Trang chủ (lịch)
```

### 6.2 Nhập tay (không ảnh)

```text
Trang chủ → chọn ngày → Thêm giao dịch
  → /form?transactionDate=YYYY-MM-DD (không imageUri)
  → Nhập tay các trường primary
       (chi cho ai mặc định Yue + Kai;
        nguồn chi: last-selected — xem §7.4)
  → Lưu
```

### 6.3 Sửa / xoá giao dịch

```text
Trang chủ → chọn ngày → bottom sheet danh sách
  → Sửa → /form?transactionId=...&isEdit=true
     (audience cũ unspecified → hiện “Chưa phân loại”, cho chọn lại)
     (source cũ giữ nguyên; không tự map sang Woori)
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
  → Xuất JSON đầy đủ (toàn bộ bảng liên quan), gồm:
       sources
       transaction.source_id
       expense_audience (kể cả Yue + Meo)
       legacy payer nếu đang tồn tại
  → Share / lưu file tuỳ nền tảng (Files, Drive, v.v.)

Restore:
  → Chọn JSON đã backup
  → Giữ nguyên source_id lịch sử
       KHÔNG merge Tiền mặt Yue + Tiền mặt Kai
       KHÔNG migrate VCB Shop → Woori
       KHÔNG infer source
  → expense_audience hiện có giữ nguyên
       KHÔNG tự migrate wife → wife_and_sister
       Label UI cũ (Vợ / Chồng / 2 vợ chồng / …) map sang Yue / Kai / …
         mà không mất semantic
  → Legacy payer giữ nguyên nếu có; không bắt user nhập lại
  → Xác nhận ghi đè toàn bộ DB hiện tại
  → Reload app / màn hình chính sau khi thành công
```

Giao dịch cũ phân loại sai (nếu có) do user chỉnh thủ công khi muốn — app không đoán hộ.

---

## 7. Dữ liệu nghiệp vụ (tóm tắt)

### 7.1 Hai chiều phân loại khoản chi (P1.5)

Đây là mô hình sản phẩm cốt lõi. Hai chiều **độc lập**; không được dùng một chiều làm proxy cho chiều khác.

| Chiều | Field | Câu hỏi | Không phải |
|-------|-------|---------|------------|
| **Nguồn chi** | `source_id` | Khoản này lấy tiền từ đâu để thanh toán? | Số dư tài khoản; intended budget; người physically trả |
| **Chi cho ai** | `expense_audience` | Ai hưởng khoản chi? | Người thanh toán; personal vs household policy engine |

Các field **không** thuộc normal flow P1.5:

| Field | Xử lý |
|-------|--------|
| `payer` | Legacy. Giữ DB nếu đã có; không xóa historical data; không bắt nhập; không dùng làm primary reporting dimension; không suy ownership từ payer. Có thể deprecate ở technical layer sau. |
| `funding_pool` | **Không** triển khai. |
| `approved_by` | **Không** triển khai. |
| `expense_nature` | **Không** triển khai. |
| `budget_bucket` | **Không** triển khai. |

**Ví dụ hợp lệ:**

```text
amount = 280.000
source = Woori · Quỹ ăn
expense_audience = Yue + Kai
```

```text
amount = 600.000
source = VPBank
expense_audience = Yue + Meo
```

```text
amount = 300.000
source = Tiền mặt Kai
expense_audience = Yue + Kai
```

Trường hợp thứ ba **không** report thành “Kai bỏ tiền cá nhân” theo nghĩa ownership sâu — YueDaily chỉ report đúng source đã chọn: **Tiền mặt Kai**.

### 7.2 Thực thể

| Thực thể | Vai trò |
|----------|---------|
| **Giao dịch** | Số tiền VNĐ, ngày, chi cho ai (`expense_audience`), nguồn chi (FK `source_id`), danh mục (FK), mô tả, ảnh, trạng thái (`pending`/`complete`); app chỉ ghi nhận chi tiêu. `payer` có thể còn trên bản ghi cũ. |
| **Danh mục** | Phân loại chi tiêu; emoji + màu; seed khoảng 17 danh mục mặc định |
| **Nguồn chi** | Master data user-configurable: phương thức/tài khoản tiền thực tế được lấy để trả; báo cáo chi, không tính số dư thực tế |
| **Streak** | Số ngày liên tiếp có giao dịch `complete`; tính từ bảng `transactions` |

`source_id` **chỉ cho biết** transaction được thanh toán từ nguồn nào. App không biết tài khoản còn bao nhiêu, không xác định tiền shop có phải lợi nhuận hay không, không enforce household budget.

### 7.3 `expense_audience`

Ưu tiên **migration safety**. Codebase hiện dùng identifier nội bộ `wife` / `husband` / `couple` / `couple_and_sister` / `unspecified`. **Không** đổi identifier chỉ vì cosmetic naming. Giữ enum cũ; đổi UI labels. Nếu `wife_and_sister` chưa có thì **thêm** support tương ứng.

| Giá trị nội bộ (giữ) | Label UI P1.5.1 |
|----------------------|-----------------|
| `wife` | Yue |
| `husband` | Kai |
| `couple` | Yue + Kai |
| `wife_and_sister` | Yue + Meo |
| `couple_and_sister` | Yue + Kai + Meo |
| `unspecified` | Chưa phân loại |

- Giao dịch mới: mặc định `couple` (UI: **Yue + Kai**), vì phần lớn transaction mới là household/shared.
- Migration DB cũ (trước khi có cột audience): mặc định `unspecified` cho bản ghi sẵn có (không tự gán `couple`).
- P1.5 **không** tự migrate `wife` → `wife_and_sister`.
- Một transaction = đúng một `expense_audience`. Không chia tiền theo từng người. Không beneficiary allocation. Không split bill.

**Semantics (hướng dẫn sản phẩm, không phải validation cứng):**

| Audience | Ý nghĩa | Gợi ý source (không hard-block) |
|----------|---------|----------------------------------|
| **Yue** | Chỉ dành cho Yue (ăn một mình, mua đồ cá nhân, nạp game, …). Không mặc định mọi khoản Yue đều là personal hoặc household. | `Audience = Yue` + Woori có thể hợp lệ nếu là bữa ăn bình thường được food fund cover. `Audience = Yue` + VPBank thường là personal. |
| **Kai** | Dành cho Kai (ví dụ Yue mua đồ ăn mang về chỉ cho Kai). | Có thể Woori nếu là household food. |
| **Yue + Kai** | Shared household / food cho Yue và Kai. Audience chính đối với Woori Food Fund. | Woori · Quỹ ăn khi đúng là tiền quỹ ăn. |
| **Yue + Meo** | **Mặc định là chi tiêu cá nhân/social của Yue**, không phải food spending chung Yue + Kai. | VPBank hoặc Tiền mặt Yue. Không mặc định lấy Woori. Nếu Yue cố tình chọn Woori, transaction vẫn hợp lệ. |
| **Yue + Kai + Meo** | Yue + Kai chi chung và có Meo cùng tham gia. | Có thể Woori · Quỹ ăn — household food arrangement hiện tại có allowance bao Meo khi đi chung. |

Ví dụ: Yue đi ăn với Meo, hoá đơn 600.000đ → `expense_audience = wife_and_sister` (UI: Yue + Meo). **Không** report “Yue tiêu một mình 600.000đ”. **Không** split 300k / 300k.

### 7.4 `source_id` — Nguồn chi

Field bắt buộc trên form. Terminology UI: **Nguồn chi**. Helper: *Khoản này lấy tiền từ đâu?*

Ba chiều tách nhau:

- `expense_audience` = **Chi cho ai**
- `source_id` = **Lấy tiền từ đâu**
- `sources.spending_group` = phân loại Home monitoring trên Nguồn chi (`personal_yue` / `household` / chưa phân loại) — **không** phải field trên transaction, **không** phải `expense_scope`.

Home tabs Tất cả / Cá nhân Yue / Quỹ chung đọc `spending_group`. Thống kê vẫn lọc Chi cho ai bình thường.

**Default giao dịch mới:** nguồn user chọn gần nhất (UI convenience, không phải AI inference). User luôn có thể đổi. Ví dụ vừa nhập Woori thì transaction tiếp theo có thể preselect Woori.

**Ghi fact, không ghi policy:** nếu food fund là Woori nhưng Yue thực tế lấy Tiền mặt Yue để trả → `source_id` = Tiền mặt Yue. Không ghi Woori chỉ vì “đáng lẽ thuộc food budget”. Reimbursement / transfer thuộc phase khác.

#### Ý nghĩa các source trong workflow hiện tại của Yue (acceptance / example)

Đây là context sử dụng thực tế, **không** hardcode thành product enum.

**Woori · Quỹ ăn**

- Tài khoản riêng dùng cho tiền ăn chung; Yue và Kai đang dùng để test household food spending.
- Tại thời điểm bắt đầu test nửa cuối tháng 8/2026, balance thực tế đang khoảng **3.000.000đ**. YueDaily **không** track số này; **không** hardcode 3.000.000đ hay 7.500.000đ vào schema / product rules.
- Có thể dùng cho transaction nhóm ăn uống chung (`Yue + Kai`, `Yue + Kai + Meo`) nếu đúng là household/shared food.
- P1.5: Woori **chỉ là một Nguồn chi**. Không monthly food budget, remaining balance, contribution, top-up, month-end sweep.

**VPBank**

- Tiền cá nhân Yue.
- Ví dụ: Light and Night, Starbucks / Stanley, shopping cá nhân, ăn riêng mang tính personal/treat, Yue + Meo khi Yue chủ động chi cá nhân.

**Tiền mặt Yue**

- Tiền mặt Yue đang có và dùng; thường rút từ nguồn cá nhân của Yue.
- Source riêng — không gộp với Tiền mặt Kai.

**Tiền mặt Kai**

- Tiền mặt Kai đang có và dùng.
- YueDaily chỉ cần biết transaction được thanh toán bằng **Tiền mặt Kai**.
- Không track provenance từng tờ tiền, bóp/két, cash balance, cash-flow Shop.
- Không gộp với Tiền mặt Yue.

**VCB Shop — historical / non-household source**

- Đã từng được dùng cho một số transaction household/personal food trước đây.
- **Going forward:** Yue chủ động ngừng dùng VCB Shop để thanh toán food/personal household spending.
- **Không** xóa source; **không** sửa historical transaction; **không** retroactively chuyển VCB → Woori.
- Form tạo mới không liệt kê VCB Shop (archived). Statistics vẫn report giao dịch cũ đúng source.
- App **không** enforce bằng validation; **không** chịu trách nhiệm quản lý chi phí vận hành TOKUani Shop.

### 7.5 Migration dữ liệu đang có

Giao dịch hiện có **giữ nguyên**: amount, category, source, payer (nếu có), date, description, image, status, `expense_audience` hiện tại.

- **Không** thêm `funding_pool` / `approved_by`.
- **Không** merge các source tiền mặt.
- **Không** map VCB Shop → Woori.
- **Không** infer audience.
- **Không** retroactively sửa transaction cũ nếu không có đủ thông tin.
- Thêm support `wife_and_sister` (UI: Yue + Meo); record cũ giữ nguyên.
- Thêm `sources.is_active` (DEFAULT đang dùng). Archive exact seed `Tiền mặt` / `Chuyển khoản` / `VCB Shop` nếu có — không fuzzy, không xóa row, không đổi `source_id`.

Chi tiết schema SQL xem ở `README.md` → *Data Model (SQLite)*. README / Data Model cần cập nhật tương ứng (không viết SQL trong PRD này).

---

## 8. AI — Hành vi sản phẩm

| Khía cạnh | Mô tả |
|-----------|-------|
| Khi nào gọi | Khi mở form với ảnh mới, hoặc khi người dùng nhấn “Quét lại” |
| Đầu vào | Ảnh hoá đơn hoặc ảnh món / sản phẩm (sau khi đã được nén resize + JPEG) |
| Hoá đơn | AI cố gắng đọc số tiền, gợi ý danh mục và mô tả |
| Ảnh món/SP | AI không tự suy số tiền; amount mặc định 0, người dùng nhập tay |
| Yêu cầu mạng | Có; nếu mất mạng thì bỏ qua AI, người dùng nhập tay |
| API key | Cấu hình Groq / Gemini qua `.env` hoặc biến môi trường build (EAS); không có màn quản lý key cho người dùng |
| Hành vi lỗi | Nếu key sai / hết quota / timeout, hiển thị thông báo ngắn gọn, cho phép nhập tay |

Chain provider (chi tiết kỹ thuật ở `README.md`): Groq → Gemini Flash‑Lite → Gemini Flash, có cơ chế skip provider khi lỗi 4xx/5xx, timeout, payload quá lớn.

AI **chỉ** gợi ý:

- amount
- category
- description

AI **không** tự quyết / không infer từ ảnh:

- `source_id`
- `expense_audience`
- `payer` (legacy)

Ảnh hoá đơn không đủ context để biết Yue dùng Woori hay VPBank, tiền mặt Yue hay Kai, bữa đó là Yue + Kai hay Yue + Meo.

---

## 9. Yêu cầu phi chức năng

| Hạng mục | Yêu cầu |
|----------|---------|
| Nền tảng | iOS, Android, Web (browser modern) |
| Ngôn ngữ | Tiếng Việt |
| Định dạng | Tiền tệ VNĐ, format `vi-VN` |
| Offline | Đọc/ghi DB offline; chỉ AI/backup phụ thuộc mạng |
| Privacy | Không server app; không sync dữ liệu; backup JSON do người dùng nắm giữ |
| UX modal | Bottom sheet không bị tab bar / system navbar che nội dung quan trọng |
| Domain generic | Không hardcode Woori / VPBank / VCB (hay ngân hàng bất kỳ) thành logic bắt buộc; đó chỉ là `source` user cấu hình |
| Policy vs tracker | App ghi fact; không hard-block tổ hợp source × audience; không encode 3.000.000đ / 7.500.000đ thành product rule |

---

## 10. Thiết kế & Brand

- **Màu sắc:** pastel sakura (hồng) cho chi tiêu, nền cream; hạn chế đỏ/xanh gắt.
- **Tab bar:** icon emoji + nhãn text; nút `+` nổi giữa mở camera.
- **Form:** header gradient chi tiêu; bàn phím số pastel 3×4; label field màu lavender muted; dropdown đồng nhất chiều cao.
- **Typography & layout:** thân thiện, dễ đọc, không overload thông tin.
- **Wording:** ưu tiên ngắn trên mobile (*Nguồn chi*, *Chi cho ai*). Labels audience: Yue / Kai / Meo — không dùng Vợ / Chồng / 2 vợ chồng trên UI mới.

Token màu cụ thể được định nghĩa tại `src/constants/theme.ts`.

---

## 11. Ràng buộc & giả định

- Một giao dịch = một khoản chi tiêu, một số tiền nguyên (VNĐ).
- Một giao dịch = đúng một giá trị `expense_audience` (không split).
- Một giao dịch = đúng một `source_id` (Nguồn chi; không balance).
- Ghi đúng tiền thực tế đã lấy — không ghi intended budget/policy.
- `payer` (nếu còn) không phải proxy cho ownership của tiền và không thuộc primary UX.
- Không triển khai `funding_pool`, `approved_by`, `expense_nature` trong P1.5.
- Không gộp `Tiền mặt Yue` và `Tiền mặt Kai`.
- Không tự migrate historical VCB Shop sang Woori.
- Ngày giao dịch không được > ngày hiện tại (không ghi tương lai).
- Kỳ báo cáo (ngày, tháng, khoảng tùy chỉnh) không cho chọn ngày tương lai.
- Lịch / báo cáo tháng không vượt quá tháng hiện tại (ưu tiên tháng hiện tại trước).
- Không có opening balance, chuyển khoản nội bộ, thu nhập hay cash-flow.
- Không quản lý số dư thực tế (kể cả Woori).
- Không model Family Savings như expense budget hay spending account trong P1.5.
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
| Search transaction | Mô tả, số tiền, danh mục |
| Expense audience (bản đầu) | `wife` / `husband` / `couple` / `couple_and_sister` / `unspecified` |

### Đang triển khai — P1.5 / P1.5.1 Source & Audience Foundation

Scope của PRD 1.5.1 (lần cập nhật này):

- Source-first transaction model; `source_id` = **Nguồn chi**.
- Bỏ Người thanh toán / Ai trả khỏi primary UX; giữ legacy `payer` để backward compatible.
- **Không** implement `funding_pool` / `approved_by`.
- UI labels Yue / Kai / Meo; thêm Yue + Meo (`wife_and_sister`).
- Tách Tiền mặt Yue / Tiền mặt Kai; thêm Woori · Quỹ ăn như source (config của Yue).
- VCB Shop giữ historical; không ưu tiên cho household food mới; không sửa lịch sử.
- Form 2 hàng (Danh mục \| Chi cho ai · Nguồn chi \| Ngày) + mô tả.
- Stats / filter theo nguồn chi + audience; cross-filter bắt buộc.
- Backup/restore đầy đủ; restore backward compatible; không heuristic.
- Acceptance scenarios A–H.

### Tương lai — không thuộc P1.5

| Ưu tiên | Hạng mục | Ghi chú |
|---------|----------|---------|
| **P1.6** | Household Food Budget | Monthly food target, Woori food budget, amount funded per month, remaining amount, contribution Yue/Kai nếu cần, policy khi hết budget, month-end leftover. **Chỉ thiết kế sau khi test thực tế.** Không hardcode 3.000.000đ / 7.500.000đ trước khi household rule ổn định. **Future only.** |
| **P1.7** | Spending Insights | Food vs drinks/snacks, big spend, one-off / recurring (`expense_nature`), weekday/weekend patterns, baseline lifestyle. **Future only.** |
| P2 | Widget / shortcut chụp nhanh | Phụ thuộc nền tảng |

Nếu một ý tưởng cần Budget mới hoạt động, **không** tự mở rộng P1.5 — ghi vào P1.6.

Các hạng mục **không** nằm trong lộ trình sản phẩm cốt lõi: UI API key Cài đặt, repeat transaction, export CSV, pending inbox, thu nhập / cash-flow / opening balance, shop accounting / profit / owner draw, Family Savings balance, reimbursement / internal transfer.

---

## 13. Tài liệu liên quan

| Tài liệu | Nội dung |
|----------|---------|
| [`README.md`](./README.md) | Setup dev, build EAS, schema SQLite chi tiết, kiến trúc code, AI technical notes. **Cần cập nhật Data Model** cho terminology Nguồn chi, audience Yue + Meo / labels Yue·Kai·Meo, backup schema, legacy payer. **Không** thêm `funding_pool` / `approved_by`. |

---

## 14. Kịch bản chấp nhận (P1.5.1)

### Scenario A — Yue + Kai ăn bằng Food Fund

```text
Amount: 280.000
Category: Ăn uống
Audience: Yue + Kai
Source: Woori · Quỹ ăn
```

**Expected:**

- Woori +280k.
- Yue + Kai +280k.
- Không cần payer.
- **Không** hiện Người thanh toán trên form / row.

### Scenario B — Yue ăn một bữa bình thường bằng Food Fund

```text
Amount: 70.000
Category: Ăn uống
Audience: Yue
Source: Woori · Quỹ ăn
```

**Expected:**

- Woori +70k.
- Yue +70k.
- Transaction hợp lệ.
- App **không** tự kết luận đây là personal spending chỉ vì audience = Yue.

### Scenario C — Yue ăn và mua phần mang về cho Kai

```text
Amount: 190.000
Category: Ăn uống
Audience: Yue + Kai
Source: Woori · Quỹ ăn
Description: Yue ăn + mua phần cho Kai
```

**Expected:**

- Woori +190k.
- Yue + Kai +190k.
- Không split transaction.

### Scenario D — Yue + Kai + Meo đi ăn

```text
Amount: 850.000
Category: Ăn uống
Audience: Yue + Kai + Meo
Source: Woori · Quỹ ăn
```

**Expected:**

- Woori +850k.
- Yue + Kai + Meo +850k.

### Scenario E — Yue đi ăn riêng với Meo

```text
Amount: 600.000
Category: Ăn uống
Audience: Yue + Meo
Source: VPBank
```

**Expected:**

- VPBank +600k.
- Yue + Meo +600k.
- **Không** report Yue một mình tiêu 600k.
- **Không** split 300k / 300k.
- Đây là model mặc định phù hợp với household rule hiện tại.
- **Không** tính vào Woori chỉ vì đây là food.
- Nếu user cố tình chọn Woori, app vẫn lưu (tracker, không enforce).

### Scenario F — Yue dùng tiền mặt cá nhân

```text
Amount: 100.000
Category: Ăn uống
Audience: Yue
Source: Tiền mặt Yue
```

**Expected:**

- Tiền mặt Yue +100k.
- Yue +100k.
- **Không** gộp vào “Tiền mặt” generic hay Tiền mặt Kai.

### Scenario G — Kai dùng tiền mặt

```text
Amount: 300.000
Category: Ăn uống
Audience: Yue + Kai
Source: Tiền mặt Kai
```

**Expected:**

- Tiền mặt Kai +300k.
- Yue + Kai +300k.
- Không cần payer field.
- **Không** report thành “Kai personal spending +300k” theo nghĩa ownership sâu — chỉ report đúng source.

### Scenario H — Historical VCB transaction

Existing transaction:

```text
Amount: 800.000
Audience: Yue + Kai
Source: VCB Shop
```

**Expected sau migration:**

- Source vẫn = VCB Shop.
- Audience vẫn = Yue + Kai.
- Amount không đổi.
- **Không** tự chuyển thành Woori.

---

## 15. Câu hỏi sản phẩm P1.5 phải trả lời

App phải trả lời được nhanh:

- Tháng này tổng chi bao nhiêu?
- Chi vào category nào?
- Khoản này lấy tiền từ đâu? (Woori · Quỹ ăn / VPBank / Tiền mặt Yue / Tiền mặt Kai / VCB Shop)
- Chi cho ai? (Yue / Kai / Yue + Kai / Yue + Meo / Yue + Kai + Meo)
- Woori đã được dùng cho những transaction nào?
- Woori dùng bao nhiêu cho Yue + Kai?
- Woori dùng bao nhiêu cho Yue + Kai + Meo?
- Yue + Meo đã tiêu bao nhiêu qua VPBank / Tiền mặt Yue?
- Historical VCB Shop household spending là bao nhiêu?

App **không** cần trả lời chính xác:

- Ai physically đưa tiền / quét QR?
- Ai duyệt khoản chi?
- Woori còn balance bao nhiêu?
- Mỗi tháng được ăn bao nhiêu? Yue/Kai đóng bao nhiêu? Cuối tháng dư xử lý thế nào? → **P1.6**

---

## CHANGELOG TỪ 1.5.0

Cập nhật 2026-08-16 · phiên bản **1.5.1** · phase **P1.5 Source & Audience Foundation**.

Đây là **product correction / simplification** dựa trên workflow sử dụng thực tế của Yue — không phải feature mới chồng lên 1.5.0.

- **Source-first model:** Attribution chính còn hai chiều — `source_id` (**Nguồn chi**) và `expense_audience` (**Chi cho ai**). Phase này chỉ chuẩn hóa: *Chi bao nhiêu → Chi gì → Chi cho ai → Lấy tiền từ đâu.*
- **Bỏ Người thanh toán khỏi primary UX:** Không còn dropdown *Ai trả* / *Người thanh toán* trên form chính. Không còn product goal “tháng này ai trả nhiều hơn”. Legacy `payer` giữ trong DB để backward compatibility; không xóa historical data; không bắt nhập; không dùng làm primary reporting / ownership proxy.
- **Không triển khai funding pool:** Bỏ `funding_pool` khỏi scope P1.5. Các source thực tế đã đủ semantic. Aggregate theo ownership group (`source_group` / `funding_group`) nếu cần thì phase sau.
- **Không triển khai approved_by:** Không có Người duyệt trên form, không có field mới.
- **`source_id` = Nguồn chi:** Terminology UI đổi từ Nguồn tiền / Nguồn thanh toán. Helper: *Khoản này lấy tiền từ đâu?* Field bắt buộc. Ghi fact (tiền thực tế đã lấy), không ghi intended policy.
- **Chuẩn hóa UI labels Yue / Kai / Meo:** Thay Vợ / Chồng / 2 vợ chồng / Vợ + em gái. Giữ internal enum (`wife`, `husband`, `couple`, …) vì migration safety.
- **Thêm Yue + Meo:** Support `wife_and_sister`. Mặc định đây là chi cá nhân/social của Yue (VPBank / Tiền mặt Yue), không phải household food fund — app không hard-block nếu user chọn Woori.
- **Tách tiền mặt:** `Tiền mặt Yue` và `Tiền mặt Kai` là hai source khác nhau. Không gộp thành `Tiền mặt`.
- **Woori · Quỹ ăn:** Source mới trong config của Yue (real-world envelope cho household food). **Không** phải budget engine. Không hardcode 3.000.000đ / 7.500.000đ. Budget thuộc P1.6.
- **VCB Shop historical:** Giữ source và transaction cũ. Going forward Yue ngừng dùng VCB cho household/personal food. Không sửa lịch sử, không migrate sang Woori, không xóa source đang được tham chiếu.
- **Form:** Layout 2 hàng (Danh mục \| Chi cho ai · Nguồn chi \| Ngày) + mô tả. Default audience = Yue + Kai (`couple`). Default source = last-selected. Target vẫn ≤ 30 giây.
- **Home / Thống kê / Tài khoản:** Metadata *Chi cho* + *Nguồn*. Filter chính: kỳ, danh mục, nguồn chi, chi cho ai, search. Màn Tài khoản vẫn report theo source, không số dư.
- **Backup / restore / migration:** Preserve sources, `source_id`, audience, legacy payer. Không merge cash, không infer source/audience, không map VCB → Woori. Restore file cũ map label Vợ/Chồng → Yue/Kai mà không mất semantic.
- **AI:** Vẫn chỉ gợi ý amount / category / description. Không infer source hay audience.
- **Out of scope / Budget:** Monthly food budget, remaining balance, contribution, sweep, reimbursement, transfer, shop accounting — giữ ngoài P1.5; roadmap P1.6 / P1.7.

Không xóa feature hiện có của 1.4.1 / 1.5.0 ngoài việc **rút** payer / funding pool / approved_by khỏi primary product surface của phase này.

## CHANGELOG 1.5.2

Cập nhật 2026-08-16 · phiên bản **1.5.2** · **P1.5.2 Transaction Entry UX Cleanup**.

- **Source lifecycle:** `is_active` — archived ẩn khỏi form tạo mới; lịch sử / reporting / edit / backup giữ nguyên `source_id`. Không xóa, không merge, không remap VCB Shop.
- **Category picker:** form giao dịch sắp xếp theo tần suất dùng (số giao dịch chi `complete`), không theo alphabet hay số tiền. Settings giữ thứ tự hiện tại.
- **Không** thuộc P1.6 Budget.

## CHANGELOG 1.5.3

Cập nhật 2026-08-16 · phiên bản **1.5.3** · **P1.5.3 UX cleanup**.

- **Settings:** không còn CRUD Người trả trên UI (cột/bảng `payer` giữ cho backup). Nguồn chưa dùng → Xoá; nguồn đã có giao dịch → Lưu trữ / Dùng lại.
- **About:** mô tả product hiện tại (Danh mục · Nguồn chi · Chi cho ai, local-first, không đồng bộ ngân hàng).
- **Home:** quick monitoring tabs (session-only). Theme Sakura Twilight + Edit ghost / safe-area footer.

## CHANGELOG 1.5.4

Cập nhật 2026-08-16 · phiên bản **1.5.4** · **Home monitoring theo Nguồn chi**.

- Home tabs **Tất cả / Cá nhân Yue / Quỹ chung** lọc `sources.spending_group`, **không** lọc `expense_audience`.
- `spending_group` là metadata Nguồn chi (`personal_yue` | `household` | NULL). Không thêm field trên transaction. Khóa nhóm sau khi đã có giao dịch.
- Backup `backupVersion: '3'`. Restore chấp nhận v1/v2/v3.
- **Không** thuộc P1.6 Budget.

---

## README / TECH SPEC FOLLOW-UP

Sau khi PRD được duyệt, cập nhật kỹ thuật (không implement trong bước viết PRD này):

| Hạng mục | Việc cần làm |
|----------|----------------|
| **DB migration** | **Không** thêm `funding_pool` / `approved_by`. Mở rộng check/enum `expense_audience` với `wife_and_sister` nếu chưa có. Existing rows giữ nguyên amount, category, source, payer, audience. Deterministic, không heuristic. |
| **Legacy payer compatibility** | Giữ cột/field `payer` trên transaction và bảng `payers` cho backup; **không** expose CRUD Người trả trên Settings. Form không bắt chọn; Home/Stats không ưu tiên payer; không xóa historical data. |
| **Source master-data** | Terminology **Nguồn chi**. CRUD tên. Seed/example đang dùng: Woori · Quỹ ăn, VPBank, Tiền mặt Yue, Tiền mặt Kai — **không** hardcode thành product enum. `VCB Shop` / `Tiền mặt` / `Chuyển khoản` là lịch sử, không seed install mới. Không merge hai source tiền mặt. |
| **Source active/inactive** | `is_active`: archived ẩn khỏi form tạo mới; lịch sử / Thống kê / backup giữ `source_id`. |
| **Audience enum / labels** | Giữ identifier `wife` / `husband` / `couple` / `couple_and_sister` / `unspecified`; thêm `wife_and_sister`; đổi `EXPENSE_AUDIENCE_LABELS` → Yue / Kai / Yue + Kai / Yue + Meo / Yue + Kai + Meo / Chưa phân loại. Default mới vẫn `couple`. |
| **Transaction form** | Bỏ dropdown Ai trả / Người thanh toán. Layout: Danh mục \| Chi cho ai · Nguồn chi \| Ngày + mô tả. Default audience `couple`; default source last-selected. Không thêm quỹ tiền / người duyệt. |
| **Home transaction metadata** | Row / bottom sheet: `Chi cho: …` + `Nguồn: …`. Quick views Tất cả / Cá nhân Yue / Quỹ chung theo `sources.spending_group`. Không hiện Người thanh toán. |
| **Statistics filters** | Primary: kỳ, danh mục, nguồn chi, chi cho ai, search. Aggregation **Chi theo nguồn** + **Chi cho ai**. Cross-filter §5.5. Payer filter nếu còn: temporary, không core. |
| **Source aggregation / Tài khoản** | Màn Tài khoản report theo `source_id`, không số dư. Không biến thành budget dashboard. |
| **Backup schema** | Export `sources` (`is_active` + `spending_group`) + `transaction.source_id` + `expense_audience` + legacy `payer`. |
| **Settings** | Section **Nguồn chi** (unused → Xoá; referenced → Lưu trữ; Nhóm theo dõi khi tạo / khi chưa dùng). Không CRUD Người trả trên UI. Không thêm Quỹ tiền. |
| **Restore compatibility** | Backup cũ: giữ source/audience/payer; map label UI Vợ/Chồng → Yue/Kai; không merge cash; không VCB → Woori; không infer. |
| **Migration tests** | Existing transactions giữ nguyên field cũ; `wife_and_sister` nhận record mới; VCB Shop không bị remap; hai source tiền mặt không gộp. |
| **Unit / integration tests** | Scenarios A–H; restore cũ; không split audience; form không yêu cầu payer; AI không điền source/audience. |
| **AI layer** | Đảm bảo prompt/parser không điền `source_id`, `expense_audience`, `payer`. |
| **Copy / i18n labels** | Thay “Ai trả”, “Người thanh toán”, “Nguồn tiền”, “Nguồn thanh toán”, “Vợ/Chồng” trên form, stats, settings, accounts, home cho khớp P1.5.1. |

---

## IMPLEMENTATION BOUNDARY

> **Phase này (P1.5 / 1.5.1) chỉ chuẩn hóa: Chi bao nhiêu → Chi gì → Chi cho ai → Lấy tiền từ đâu.**  
> Woori là **Nguồn chi thực tế**, chưa phải budget engine.

Không triển khai trong 1.5.1: monthly budget, food budget / 7.5m target, remaining food balance, budget target, warning, weekday/weekend allowance, contribution Yue/Kai, top-up, rollover, savings goal / sweep / Family Savings / TPBank savings, Woori balance, reimbursement, internal transfer, source grouping, `funding_pool`, `approved_by`, income, account balance, bank sync, shop accounting, profit, owner draw, split bill, `expense_nature`.

Những hạng mục đó thuộc **P1.6 — Household Food Budget** và **P1.7 — Spending Insights**. Nếu khi implement P1.5 phát hiện feature nào cần Budget mới chạy được, giữ nguyên boundary này và ghi vào roadmap P1.6 — không tự mở rộng scope.

# YueDaily — Đặc tả sản phẩm (PRD)

> **Loại tài liệu:** Product Requirements Document  
> **Phiên bản:** 1.6.0 · **Cập nhật:** 2026-09-01  
> **Trạng thái:** Đang phát triển (Expo SDK 54, React Native 0.81, React 19)  
> **Phase hiện tại:** P1.7A — AI Receipt Scan Reliability (**Implemented / verified**)

**Đọc tài liệu này khi cần biết app *là gì*, *cho ai*, *làm gì* và *làm như thế nào ở mức sản phẩm*.**  
Chi tiết kỹ thuật (cài đặt, build, schema DB, kiến trúc code) → [`README.md`](./README.md).

> README / Data Model cần cập nhật tương ứng sau khi PRD này được duyệt.  
> P1.6 **đã triển khai và verified** trên Expo Go (expo-sqlite). P1.6 **không** triển khai account balance, contribution ledger, reimbursement, transfer hay bank sync.

---

## 1. Tóm tắt

**YueDaily** (tên repo / DB: **Yozakura**) là app theo dõi chi tiêu cá nhân/gia đình do **Yue** trực tiếp sử dụng. Ưu tiên:

- **Local-first:** dữ liệu lưu 100% trên thiết bị bằng SQLite, không cần tài khoản, không server app.
- **Nhập nhanh:** chụp hoá đơn → AI quét → gợi ý số tiền, danh mục, mô tả → chỉnh lại nhanh rồi lưu (≤ 30 giây).
- **Ghi đúng hai chiều quan trọng:** mỗi giao dịch trả lời *khoản này lấy tiền từ đâu?* (`source_id` — **Nguồn chi**) và *khoản này chi cho ai?* (`expense_audience`).
- **Minh bạch:** lịch tháng dương lịch cho báo cáo chi tiêu chung; theo dõi ngân sách ăn uống gia đình theo **kỳ quỹ 05→04** riêng (P1.6 — chỉ Household Food Budget).
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
| Household food budget | Yue thấy rõ **kỳ quỹ ăn hiện tại** (05→04) gia đình đã dùng bao nhiêu trong ngân sách 7.500.000đ và còn bao nhiêu — derived từ giao dịch, không phải số dư Woori. |
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
- Household food arrangement qua **Woori · Quỹ ăn** và các nguồn `household` khác; quỹ ăn được nạp theo chu kỳ **ngày 5 hàng tháng**; ngân sách mỗi kỳ **7.500.000đ** (P1.6).

### 3.3 Người ghi chép hàng ngày

- Thói quen chụp hoá đơn sau khi thanh toán.
- Ưu tiên: nhập càng nhanh càng tốt, không phải gõ nhiều.
- Quan tâm: tổng chi trong tháng (lịch), ngân sách quỹ ăn kỳ hiện tại còn bao nhiêu, top danh mục, chi theo nguồn chi, chi cho ai.

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
| **Trang chủ** | Lịch tháng, xem tổng chi tháng, card **Quỹ ăn kỳ** (P1.6), xem/sửa/xoá/thêm giao dịch; bottom sheet ngày có summary tổng chi + số giao dịch; giao dịch hiện nhãn *Chi cho: …* và *Nguồn: …*. Không ưu tiên hiển thị người thanh toán. |
| **Camera** | Chụp ảnh hoá đơn (native) hoặc chọn file (web); có thể bỏ qua để nhập tay. |
| **Form giao dịch** | Nhập số tiền, danh mục, chi cho ai, nguồn chi, ngày, mô tả; quét AI. **Không** có Người thanh toán / Quỹ tiền / Người duyệt trên form chính. |
| **Thống kê** | Donut theo danh mục, biểu đồ chi theo ngày (kỳ tháng), danh sách giao dịch; kỳ: ngày / tháng / khoảng tùy chỉnh; lọc danh mục, nguồn chi, chi cho ai; tìm kiếm giao dịch; tổng chi theo đối tượng; báo cáo **Chi theo nguồn**. |
| **Tài khoản** | Báo cáo chi theo từng *Nguồn chi* (`source_id`); **không** hiển thị số dư; **không** biến thành dashboard budget. |
| **Cài đặt** | CRUD nguồn chi, danh mục; xem thông tin app; backup/restore JSON. CRUD người thanh toán không còn là surface chính. |

**P1.6 — Household Food Budget (scope lần cập nhật này):**

- Chu kỳ **05/MM → 04/(MM+1)** và **`cycle_start_day = 5`** áp dụng **CHỈ** cho `budget_key = household_food` (Household Food Budget). **Không** migrate/refactor/reinterpret báo cáo chi tiêu chung quanh ngày 5.
- Mọi báo cáo chi tiêu chung vẫn theo **tháng dương lịch** (01→cuối tháng): Home tổng tháng, Home Cá nhân Yue, Home Quỹ chung, Statistics, báo cáo danh mục / nguồn chi / chi cho ai.
- Ngân sách ăn uống gia đình theo **kỳ quỹ 05/MM → 04/(MM+1)**: **7.500.000đ/kỳ**; phạm vi danh mục **Ăn uống** + **Trà & Cà phê** (all-in).
- Kai nhận lương ngày 5 → quỹ ăn nạp ngày 5 — dùng **chỉ** để định nghĩa kỳ budget food; **không** đổi kỳ báo cáo Home/Statistics.
- Planned contribution: Kai **80%** (6.000.000đ), Yue **20%** (1.500.000đ) — display only, không ledger thực nạp.
- Budget membership: `source.spending_group = household` + `category.budget_group = household_food` + **transaction date trong kỳ**; **`expense_audience` không quyết định**.
- Home card **Quỹ ăn kỳ** + Budget Detail; hiển thị theo **active budget period** (chứa ngày hiện tại / ngày được chọn), **không** theo tháng lịch Home.
- **Household Food Budget ≠ Woori balance**; không track số dư tài khoản.
- VCB Shop → `household` (one-time trusted migration).
- Category `budget_group`; bảng **`budget_periods`**; backup `backupVersion = 4`.
- Kỳ P1.6 đầu tiên được cấu hình: **05/09/2026 → 04/10/2026**; **01–04/09** = transition days (không tiêu kỳ mới).
- **Loại bỏ Streak**; budget monitoring only — không block Save khi vượt ngân sách.

**P1.5 — Source & Audience Foundation (đã hoàn thành):**

- Mô hình giao dịch **source-first**: `source_id` là chiều attribution chính; terminology UI = **Nguồn chi**.
- Bỏ *Người thanh toán* / *Ai trả* khỏi form chính và khỏi core product goal.
- Chuẩn hóa UI labels audience thành Yue / Kai / Meo; thêm **Yue + Meo**.
- Tách **Tiền mặt Yue** và **Tiền mặt Kai**; thêm **Woori · Quỹ ăn** như source (example/config của Yue).
- Giữ **VCB Shop** cho lịch sử; P1.6 gán `spending_group = household`; không retroactively chuyển sang Woori.
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

**Budget & household spending — P1.6 out of scope (không triển khai trong P1.6):**

- Bank sync, account balances, Woori balance tracking.
- Actual contribution / top-up ledger (Kai/Yue đã nạp bao nhiêu, ngày top-up, bank transfer history).
- Salary / payroll / income tracking (biết Kai lương ngày 5 chỉ để định nghĩa chu kỳ budget).
- Daily allowance, budget rollover, saving goals, personal Yue budget, multiple budget systems.
- AI budget advice, forecasting, notifications, recurring budget automation.
- Transaction-level budget override (`expense_scope`, `funding_pool`, `budget_scope`, `counts_toward_budget`, manual checkbox).
- Streak / gamification (kể cả no-spend streak, saving streak).
- Reimbursement / transfer khi Yue trả hộ quỹ ăn.

**Đã chuyển vào P1.6 in scope (specified, chưa implement):**

- Food budget limit per **payday cycle** (7.500.000đ/kỳ; first period 05/09–04/10).
- Spent / remaining / over-budget monitoring (derived).
- Planned contribution display Kai 80% / Yue 20%.
- Home budget card + Budget Detail.
- Category `budget_group` + **`budget_periods`**.

**Vẫn roadmap tương lai (P1.7+):**

- Weekday/weekend allowance, soft ceiling warnings nâng cao.
- Big spend insight, one-off vs recurring (`expense_nature`).
- Savings goals, Family Savings, TPBank savings, month-end leftover / sweep.

`expense_nature` **không** triển khai ở P1.5–P1.6. Có thể thêm cùng Spending Insights ở P1.7.

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

- Lời chào theo giờ + card **tổng chi tháng dương lịch** hiện tại + card **Quỹ ăn kỳ** (Household Food Budget — P1.6; xem §7.6).
- **Quick monitoring** (theo **Nguồn chi**, không theo `expense_audience`; **kỳ = tháng dương lịch đang xem**, 01→cuối tháng — **không** 05→04):
  - `Tất cả` — mọi giao dịch chi `complete` trong **tháng dương lịch** đang xem, gồm personal, household, và nguồn chưa phân loại (mặc định khi mở app).
  - `Cá nhân Yue` — `sources.spending_group = personal_yue` (seed: VPBank, Tiền mặt Yue).
  - `Quỹ chung` — `sources.spending_group = household` (seed: Woori · Quỹ ăn, Tiền mặt Kai, VCB Shop).
  - `expense_audience` (**Chi cho ai**) không quyết định tab. Yue + Woori → Quỹ chung; Yue + VPBank → Cá nhân Yue; Kai + Woori → Quỹ chung.
  - Nguồn legacy không classify (`Tiền mặt`, `Chuyển khoản`) → `spending_group` NULL, chỉ hiện trong Tất cả.
  - Archived source vẫn report theo `spending_group` đã gắn; `is_active` không lọc lịch sử.
  - Selection áp dụng cho **cả màn** (trừ card Quỹ ăn kỳ): tổng tháng, lịch, summary ngày, bottom sheet — **tất cả theo tháng dương lịch** (01→cuối tháng). Đổi tháng lịch giữ mode trong session; **không** đổi identity budget period.
- **Card Quỹ ăn kỳ** (Household Food Budget Period — P1.6; **duy nhất** surface dùng chu kỳ 05→04):
  - **Không** phụ thuộc tab Tất cả / Cá nhân Yue / Quỹ chung.
  - **Không** suy budget period từ tháng lịch đang xem. Resolve **active/relevant budget period** theo ngày hiện tại (hoặc ngày relevant khi inspect historical context).
  - **Ví dụ cùng ngày, hai kỳ khác nhau:**

    ```text
    Ngày: 02/10/2026

    Home / Statistics tháng 10 (dương lịch)
    → 01/10 – 31/10

    Household Food Budget active period
    → 05/09 – 04/10
    ```
  - Hiển thị: khoảng ngày kỳ, ngân sách, đã dùng, còn lại (hoặc vượt), progress, percentage, over-budget state.
  - Ví dụ copy:

    ```text
    QUỸ ĂN
    05/09 – 04/10

    Ngân sách
    7.500.000đ

    Đã dùng
    x.xxx.xxxđ

    Còn lại
    x.xxx.xxxđ

    Kai  6.000.000đ · 80%
    Yue  1.500.000đ · 20%
    ```

  - Planned contribution **informational only** — **không** hiển thị *Kai đã nạp* / *Yue đã nạp* (P1.6 không có contribution ledger).
  - **Không** label kiểu *Woori còn …* — đây không phải số dư tài khoản.
  - Chạm card → Budget Detail (§7.6).
- **Home Quỹ chung vs Household Food Budget:**
  - Home **Quỹ chung** = mọi chi từ `source.spending_group = household` trong **tháng dương lịch** đang xem (01→cuối tháng).
  - **Household Food Budget** = Quỹ chung **và** `category.budget_group = household_food` (Ăn uống + Trà & Cà phê) **và** ngày giao dịch nằm trong **kỳ quỹ 05→04** active/relevant.
  - Ví dụ: Tiền mặt Kai + Mua sắm → Home Quỹ chung (tháng 10): Yes nếu trong 01–31/10; Household Food Budget (kỳ 05/09–04/10): No.
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

- **Kỳ báo cáo = tháng dương lịch** (01→cuối tháng) cho mọi view Thống kê — **không** chuyển sang chu kỳ 05→04. P1.6 **không** migrate, refactor, hay reinterpret Statistics quanh `cycle_start_day`.
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
- **Statistics / general reporting invariant (P1.6):** donut danh mục, chi theo ngày, chi theo nguồn, chi theo `expense_audience`, tổng Cá nhân Yue, mọi personal Yue spending summary — **tất cả** theo kỳ đã chọn (ngày / **tháng dương lịch** / khoảng tùy chỉnh). **Chỉ** Budget Detail (Household Food Budget) dùng kỳ quỹ 05→04.
- **Khi xem theo Khoảng tùy chỉnh**: các summary, chart và filter áp dụng đúng range `fromDate → toDate`.

**Cross-filter bắt buộc P1.5 phải trả lời được:**

| Câu hỏi | Query ý nghĩa | Cách hiểu đúng | Không được hiểu |
|---------|---------------|----------------|-----------------|
| Food fund dùng cho hai người | `source = Woori · Quỹ ăn` AND `audience = Yue + Kai` | Tổng chi từ Woori hưởng bởi Yue + Kai | số dư Woori còn lại; payday budget period |
| Food fund khi có Meo đi cùng | `source = Woori · Quỹ ăn` AND `audience = Yue + Kai + Meo` | Tổng chi từ Woori khi cả ba | Meo tiêu một mình; split bill |
| Yue + Meo (social/personal) | `source IN (VPBank, Tiền mặt Yue)` AND `audience = Yue + Meo` | Chi Yue đi với Meo từ tiền cá nhân Yue | household food fund; Yue tiêu một mình |
| Personal Yue từ VPBank | `source = VPBank` AND `audience = Yue` | Chi Yue lấy từ VPBank | mọi khoản audience = Yue đều là personal |
| Historical VCB household | `source = VCB Shop` AND `audience = Yue + Kai` | Lịch sử chi từ VCB Shop (household source) | tự chuyển thành Woori; coi VCB unclassified |

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
2. **Thẻ tóm tắt** — Privacy, Phiên bản (P1.6: **không** còn Streak).
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
  | 🍚 Woori · Quỹ ăn | Nguồn chi chính cho quỹ ăn gia đình; `spending_group = household` |
  | 🏦 VPBank | Tiền cá nhân Yue; `spending_group = personal_yue` |
  | 👛 Tiền mặt Yue | Tiền mặt Yue; `spending_group = personal_yue` |
  | 💵 Tiền mặt Kai | Tiền mặt Kai; `spending_group = household` |
  | 🏪 VCB Shop | Nguồn household khi Kai/Yue dùng tiền Shop cho chi ăn chung; `spending_group = household`; **không** phải Woori balance; **không** personal source |

- **Không gộp** `Tiền mặt Yue` và `Tiền mặt Kai` thành một source `Tiền mặt`.
- Source có lifecycle **đang dùng / đã lưu trữ** (`is_active`):
  - Archived ẩn khỏi form tạo giao dịch mới.
  - Giữ nguyên `source_id` lịch sử; Thống kê / Tài khoản / backup vẫn report đúng tên.
  - Sửa giao dịch cũ: source archived hiện tại vẫn representable; không migrate VCB Shop → Woori.
  - Last-selected source nếu đã archived thì không preselect cho giao dịch mới.
- `spending_group` là metadata của **Nguồn chi** (`personal_yue` | `household` | NULL) — dùng cho Home monitoring và Household Food Budget membership, **không** phải transaction scope / `expense_audience`.
  - **Trusted classification (seed / one-time migration):**

    | Nguồn chi (exact name) | `spending_group` |
    |------------------------|------------------|
    | Woori · Quỹ ăn | `household` |
    | Tiền mặt Kai | `household` |
    | VCB Shop | `household` |
    | VPBank | `personal_yue` |
    | Tiền mặt Yue | `personal_yue` |
    | Tiền mặt, Chuyển khoản (legacy) | NULL |

  - Tạo nguồn mới: bắt buộc chọn Nhóm theo dõi. Không đoán từ tên.
  - Đã có giao dịch: khóa `spending_group` (đổi ý nghĩa → lưu trữ nguồn cũ, tạo nguồn mới). Vẫn được đổi tên / Lưu trữ / Dùng lại.
  - **VCB Shop migration (P1.6):** one-time trusted migration gán `spending_group = household`; preserve source ID; idempotent; không overwrite arbitrary user edits mỗi startup; runtime **không** name-based branching.
- Installation Yue: archive exact seed names `Tiền mặt`, `Chuyển khoản` nếu chúng tồn tại — không fuzzy, không xóa, không merge. **VCB Shop** giữ active hoặc archived theo lifecycle hiện có; sau migration có `spending_group = household`.

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
  → Lưu → cập nhật lịch và budget derived (P1.6)
```

### 6.5 Backup & restore

```text
Cài đặt → Sao lưu & Khôi phục

Backup:
  → Xuất JSON đầy đủ (toàn bộ bảng liên quan), gồm:
       sources (is_active, spending_group)
       categories (budget_group — v4+)
       budget_periods (v4+)
       transaction.source_id
       expense_audience (kể cả Yue + Meo)
       legacy payer nếu đang tồn tại
  → backupVersion = '4' (P1.6)
  → v4 **không** export product streak state
  → Share / lưu file tuỳ nền tảng (Files, Drive, v.v.)

Restore:
  → Chấp nhận backup v1 / v2 / v3 / v4
  → v1–v3: ignore legacy streak; exact-name classify trusted household-food categories;
       preserve all transaction/source IDs; preserve source lifecycle;
       apply trusted source classification including VCB Shop → household (one-time policy on restore/migration)
  → v4: preserve budget_group + budget_periods (period_start, period_end, limit_amount)
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
| **Chi cho ai** | `expense_audience` | Ai hưởng khoản chi? | Người thanh toán; personal vs household policy engine; **Household Food Budget membership** |

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
| **Danh mục** | Phân loại chi tiêu; emoji + màu; metadata `budget_group` (`household_food` | NULL); seed khoảng 17 danh mục mặc định |
| **Nguồn chi** | Master data user-configurable: phương thức/tài khoản tiền thực tế được lấy để trả; báo cáo chi, không tính số dư thực tế; `spending_group` cho Home + Budget |
| **Budget period** | Bản ghi limit theo kỳ quỹ (`budget_periods`); P1.6: `budget_key = household_food`; `period_start` / `period_end`; không persist spent/remaining |

**Streak (legacy — P1.6 removed):** DB cũ có thể còn bảng/dữ liệu streak. P1.6: **không** UI, **không** read/write; để inert. Fresh install không tạo streak storage. Không bắt buộc DROP migration.

`source_id` **chỉ cho biết** transaction được thanh toán từ nguồn nào. **Nguồn chi determines whether the money is personal or household.** Household Food Budget là subset chi household-source thuộc danh mục `household_food`. App không biết tài khoản còn bao nhiêu, không enforce budget khi Save.

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
- **`expense_audience` chỉ trả lời *Chi cho ai?*** — **không** quyết định transaction có tính vào Household Food Budget hay không. Budget membership do `source.spending_group` + `category.budget_group` quyết định.

**Ví dụ quan trọng — Yue + Kai qua VPBank:**

```text
Category: Ăn uống
Source: VPBank
Audience: Yue + Kai
```

→ **Không** tính Household Food Budget. Semantic: *Yue đang mời Kai bằng tiền cá nhân của Yue.* Không gọi là “Yue lỡ trả”, “Yue tạm ứng”, hay “household expense paid personally” trừ khi product tương lai explicitly introduce concept đó.

**Thay đổi chỉ audience không đổi budget membership:**

```text
VPBank + Yue + Ăn uống → excluded
đổi audience Yue → Yue + Kai → vẫn excluded

Woori + Yue + Ăn uống → included
đổi audience Yue → Yue + Kai → vẫn included
```

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
- `sources.spending_group` = phân loại Home monitoring **và** Household Food Budget membership trên Nguồn chi (`personal_yue` / `household` / chưa phân loại) — **không** phải field trên transaction, **không** phải `expense_scope`.

Home tabs Tất cả / Cá nhân Yue / Quỹ chung đọc `spending_group`. Thống kê vẫn lọc Chi cho ai bình thường.

**Default giao dịch mới:** nguồn user chọn gần nhất (UI convenience, không phải AI inference). User luôn có thể đổi. Ví dụ vừa nhập Woori thì transaction tiếp theo có thể preselect Woori.

**Ghi fact, không ghi policy:** nếu food fund là Woori nhưng Yue thực tế lấy Tiền mặt Yue để trả → `source_id` = Tiền mặt Yue. Không ghi Woori chỉ vì “đáng lẽ thuộc food budget”. Reimbursement / transfer thuộc phase khác.

#### Ý nghĩa các source trong workflow hiện tại của Yue (acceptance / example)

Đây là context sử dụng thực tế, **không** hardcode thành product enum.

**Woori · Quỹ ăn**

- Nguồn chi chính cho quỹ ăn gia đình; `spending_group = household`.
- YueDaily **không** track số dư Woori thực tế; **Household Food Budget ≠ Woori balance**.
- Có thể dùng cho mọi transaction household food nếu user chọn đúng source.
- Food budget limit **7.500.000đ/kỳ** (05→04) là monitoring derived — xem §7.6. Quỹ nạp ngày 5 hàng tháng.

**VPBank**

- Tiền cá nhân Yue; `spending_group = personal_yue`.
- Chi từ VPBank **không** tính Household Food Budget, kể cả audience Yue + Kai (*Yue mời Kai*).
- Ví dụ: Light and Night, Starbucks / Stanley, shopping cá nhân, ăn riêng mang tính personal/treat, Yue + Meo khi Yue chủ động chi cá nhân.

**Tiền mặt Yue**

- Tiền mặt Yue; `spending_group = personal_yue`.
- Source riêng — không gộp với Tiền mặt Kai.

**Tiền mặt Kai**

- Tiền mặt Kai; `spending_group = household`.
- Chi household food từ Tiền mặt Kai **tính** Household Food Budget khi category thuộc `household_food`.
- Không track cash balance hay provenance từng tờ tiền.

**VCB Shop — household source**

- `spending_group = household` (P1.6 one-time trusted migration).
- **Không** phải Woori balance; **không** personal source.
- Business meaning: Yue không dùng VCB Shop cho Yue-only hay Yue + Meo. Cuối tháng nếu Woori hết nhưng Kai quyết định tiếp tục ăn ngoài, Kai có thể bảo Yue lấy tiền Shop thanh toán — Yue thông báo/đồng thuận với Kai.
- **Không** xóa source; **không** sửa historical transaction; **không** retroactively chuyển VCB → Woori.
- Giao dịch food từ VCB Shop **tính** Household Food Budget (khi category `household_food`).
- App **không** enforce bằng validation; **không** chịu trách nhiệm quản lý chi phí vận hành TOKUani Shop.

### 7.5 Migration dữ liệu đang có

Giao dịch hiện có **giữ nguyên**: amount, category, source, payer (nếu có), date, description, image, status, `expense_audience` hiện tại.

- **Không** thêm `funding_pool` / `approved_by`.
- **Không** merge các source tiền mặt.
- **Không** map VCB Shop → Woori.
- **Không** infer audience.
- **Không** retroactively sửa transaction cũ nếu không có đủ thông tin.
- Thêm support `wife_and_sister` (UI: Yue + Meo); record cũ giữ nguyên.
- Thêm `sources.is_active` (DEFAULT đang dùng). Archive exact seed `Tiền mặt` / `Chuyển khoản` nếu có — không fuzzy, không xóa row, không đổi `source_id`.
- **P1.6:** one-time migration `VCB Shop` → `spending_group = household` (preserve ID, idempotent).
- **P1.6:** migration `categories.budget_group` — exact trusted names: **Ăn uống**, **Trà & Cà phê** → `household_food`; còn lại → NULL.
- **P1.6:** create `budget_periods`; first explicit configured period only: `period_start = 2026-09-05`, `period_end = 2026-10-04`, `limit_amount = 7500000`.
- **Không** invent August budget periods (01/08–31/08, 05/08–04/09). Dữ liệu test 16–31/08 chỉ là evidence chọn limit 7,5m — **không** phải kỳ budget formal.
- **Không** gắn giao dịch **01–04/09/2026** vào kỳ 05/09–04/10.
- Legacy streak data: leave inert; no UI reads/writes.

Chi tiết schema SQL xem ở `README.md` → *Data Model (SQLite)*. README / Data Model cần cập nhật tương ứng (không viết SQL trong PRD này).

### 7.6 Household Food Budget (P1.6)

> **Nguyên tắc sản phẩm:** **Nguồn chi** determines whether the money is personal or household. **Household Food Budget** là subset chi từ nguồn `household` thuộc danh mục `household_food`. `expense_audience` ghi ai hưởng — **không** đổi budget membership.

#### 7.6.1 Mục tiêu

Yue theo dõi mỗi **kỳ quỹ ăn** (payday-aligned) gia đình đã dùng bao nhiêu trong ngân sách và còn bao nhiêu.

- Limit mỗi kỳ: **7.500.000đ**.
- Budget scope categories: **Ăn uống** + **Trà & Cà phê** (all-in).
- **Household Food Budget Period** = chu kỳ **05/MM → 04/(MM+1)**, vì quỹ ăn gia đình nạp **ngày 5** (Kai nhận lương ngày 5).
- **`cycle_start_day = 5`** — thuộc **duy nhất** `budget_key = household_food`. P1.6 **không** generic recurring-budget engine; **không** multiple budget types; **không** áp dụng cho báo cáo chi tiêu chung.

Ví dụ kỳ budget food:

```text
05/09/2026 → 04/10/2026
05/10/2026 → 04/11/2026
```

#### 7.6.1a Domain invariant — payday cycle scope

> **Chu kỳ 05→04 áp dụng CHỈ cho Household Food Budget** (`budget_key = household_food`).  
> **Mọi báo cáo chi tiêu chung vẫn theo tháng dương lịch** (01→cuối tháng).

| Surface | Kỳ báo cáo | Dùng `cycle_start_day`? |
|---------|------------|-------------------------|
| Home — tổng chi tháng | Tháng dương lịch đang xem | **No** |
| Home — tab Cá nhân Yue | Tháng dương lịch | **No** |
| Home — tab Quỹ chung | Tháng dương lịch | **No** |
| Home — lịch / bottom sheet ngày | Tháng dương lịch | **No** |
| Statistics — mọi kỳ/filter | Ngày / **tháng dương lịch** / khoảng tùy chỉnh | **No** |
| Báo cáo danh mục | Theo kỳ Statistics (calendar) | **No** |
| Báo cáo nguồn chi | Theo kỳ Statistics (calendar) | **No** |
| Báo cáo chi cho ai | Theo kỳ Statistics (calendar) | **No** |
| Personal Yue spending summaries | Tháng dương lịch | **No** |
| **Card Quỹ ăn kỳ + Budget Detail** | **Kỳ quỹ 05/MM → 04/(MM+1)** | **Yes** |

**Ví dụ authoritative (02/10/2026):**

```text
Home / Statistics tháng 10
→ 01/10 – 31/10

Household Food Budget active period
→ 05/09 – 04/10
```

P1.6 **không** migrate, refactor, hay reinterpret general reporting quanh ngày 5. `cycle_start_day` **không** là global app calendar rule.

#### 7.6.2 Planned contribution (display only)

Total planned fund **mỗi kỳ**: **7.500.000đ**

| Thành viên | Tỷ lệ | Planned contribution |
|------------|-------|----------------------|
| Kai | 80% | 6.000.000đ |
| Yue | 20% | 1.500.000đ |

Đây là **planned contribution** vào household food fund — **không** phải tỷ lệ chia từng hoá đơn. P1.6 **không** ledger: Kai/Yue đã thực nạp bao nhiêu, ngày top-up, bank transfer history. Có thể hiển thị trong Budget Detail; actual contribution accounting ngoài scope.

#### 7.6.3 Category metadata — `budget_group`

Không hardcode category names tại runtime trong implementation. Dùng metadata persisted:

```text
budget_group:
  household_food
  NULL
```

Trusted initial mapping (one-time migration exact name):

| Danh mục | `budget_group` |
|----------|----------------|
| Ăn uống | `household_food` |
| Trà & Cà phê | `household_food` |
| Tất cả danh mục khác | NULL |

Sau migration, runtime đọc `categories.budget_group` — **không** category-name branching.

#### 7.6.4 Budget membership rule

Một transaction tính vào **một Household Food Budget period** cụ thể khi **tất cả** điều kiện:

```text
type = chi
AND status = complete
AND category.budget_group = household_food
AND source.spending_group = household
AND period_start <= transaction_date <= period_end
```

Pseudo-spec:

```ts
isBudgetTransaction =
  transaction.type === 'chi' &&
  transaction.status === 'complete' &&
  category.budget_group === 'household_food' &&
  source.spending_group === 'household' &&
  transaction.date is inside budget period;
```

**DO NOT** dùng `expense_audience` cho budget membership. Rule sai (đã loại khỏi spec):

```text
source household OR audience contains Kai   ← SAI
```

Archived household source + food category + date in period → **included** (theo `spending_group` đã gắn).

**Transition days 01–04/09/2026:** giao dịch household food vẫn là chi household semantically (Home / Statistics) nhưng **không** tiêu kỳ **05/09–04/10** — *before first configured budget period*. Không cần field đặc biệt trên transaction.

#### 7.6.5 Acceptance matrix

| Transaction | Household Food Budget? |
| ----------- | ---------------------: |
| Yue + Kai · Woori · Ăn uống | Yes |
| Kai · Woori · Ăn uống | Yes |
| Yue + Kai + Meo · Woori · Ăn uống | Yes |
| Yue · Woori · Ăn uống | Yes |
| Yue + Meo · VPBank · Ăn uống | No |
| Yue · VPBank · Trà & Cà phê | No |
| Yue + Kai · VPBank · Ăn uống | **No — Yue mời Kai** |
| Yue + Kai · VCB Shop · Ăn uống | Yes |
| Kai · Tiền mặt Kai · Ăn uống | Yes |
| Yue + Kai · VCB Shop · Mua sắm | No |
| Woori · Di chuyển | No |
| archived household source · Ăn uống | Yes historically |

#### 7.6.6 Budget period model — `budget_periods`

Persisted limit only — **không** persist calculated fields. **Không** dùng `month = '2026-09'` làm period key.

```text
budget_periods

id
budget_key
period_start      -- e.g. 2026-09-05
period_end        -- e.g. 2026-10-04
limit_amount
created_at
updated_at
```

P1.6 supported: `budget_key = household_food`.

**First explicitly configured P1.6 period:**

```text
budget_key   = household_food
period_start = 2026-09-05
period_end   = 2026-10-04
limit_amount = 7500000
```

Enforce one `household_food` period per `period_start` / non-overlapping cycles (implementation design).

**Không** persist: `spent`, `remaining`, `percentage`, `over_amount` — derived từ transactions trong `[period_start, period_end]`.

**Không** fabricate historical periods for August or 05/08–04/09. Test data 16–31/08 informed the 7,5m limit choice — not a formal budget period.

#### 7.6.7 Budget ≠ account balance

```text
Household Food Budget ≠ Woori bank balance
```

**Operating flow (conceptual):**

- **Ngày 5:** planned household food funding = **7,5m** (Kai 6m + Yue 1,5m planned share).
- **Woori** là nguồn chi chính cho quỹ ăn.
- **Tiền mặt Kai**, **VCB Shop** vẫn có thể trả qualifying household food — **cùng tiêu active kỳ 05→04**.
- P1.6 **không** track số dư Woori/VPBank/VCB/cash thực tế, top-up ledger, bank sync, salary/income ledger.

Biết Kai nhận lương ngày 5 chỉ để **định nghĩa chu kỳ budget** — P1.6 **không** thành payroll tracker.

#### 7.6.8 Period lifecycle

- Budget **period records** = payday cycles `05/MM → 04/(MM+1)` — **không** dùng calendar month làm period key. (General expense reporting vẫn calendar-month — xem §7.6.1a.)
- **Không** rollover unused amount. Ví dụ kỳ 05/09–04/10: limit 7,5m, spent 7,1m, unused 0,4m → kỳ 05/10–04/11 limit vẫn **7,5m** (NOT 7,9m), trừ khi Yue đổi limit kỳ mới.
- **Ngày 05/MM:** nếu chưa có period mới, tạo kỳ tiếp theo inherit **latest previous configured limit** (ví dụ 7,5m).
- **Chỉnh ngân sách kỳ này** (ví dụ đổi 05/10–04/11 → 8m) **chỉ** sửa period đó — **không** mutate 05/09–04/10.
- Historical period limits **không** đổi retroactively.
- Sau transition 01–04/09, các kỳ recurring liên tục: 05/09–04/10, 05/10–04/11, 05/11–04/12, …

#### 7.6.9 Budget Detail

Màn hình / bottom sheet khi chạm card Quỹ ăn kỳ. Resolve period chứa ngày relevant/selected. Tối thiểu:

- Period range (`05/09 – 04/10`), limit, Spent, Remaining / Over, Progress
- Breakdown **Ăn uống** / **Trà & Cà phê**
- Danh sách giao dịch matching rule **và** nằm trong period
- Mỗi row: amount, category, description, date, **Chi cho ai**, **Nguồn chi**
- Planned contribution Kai 80% / Yue 20% (informational; không *đã nạp*)

Statistics (§5.5) và mọi general reporting giữ **calendar-month** (và ngày / khoảng tùy chỉnh) — Budget Detail là **duy nhất** lens payday-cycle 05→04.

#### 7.6.10 Over-budget behavior

Budget là **monitoring**, không **enforcement**. Nếu `spent > limit` → hiển thị *Vượt xxx.xxxđ*.

**Không:** block transaction, block Save, block household sources, auto-switch source, require approval, prevent going out to eat.

#### 7.6.11 Edit / delete recalculation

Budget derived — mọi thay đổi qualifying transaction cập nhật spent:

| Thay đổi | Budget effect |
|----------|---------------|
| create qualifying transaction | spent ↑ |
| delete | spent ↓ |
| edit amount | recalculate |
| category in/out `household_food` | recalculate |
| source household ↔ personal | recalculate |
| move date across **period boundaries** | subtract old period, add new period |
| move date 04/10 → 05/10 | leaves 05/09–04/10; enters 05/10–04/11 |
| **audience only** | **no change** |

#### 7.6.11a Period boundary acceptance (kỳ 05/09–04/10)

| Transaction date | Qualifying household food | Counts toward 05/09–04/10? |
|------------------|----------------------------|---------------------------|
| 04/09/2026 | Yes (household semantics) | **No** — transition / before first period |
| 05/09/2026 | Yes | **Yes** |
| 30/09/2026 | Yes | **Yes** |
| 01/10/2026 | Yes | **Yes** |
| 04/10/2026 | Yes | **Yes** |
| 05/10/2026 | Yes | **No** — belongs to next period 05/10–04/11 |

#### 7.6.12 No transaction-level budget field

P1.6 **không** thêm: `expense_scope`, `funding_pool`, `budget_scope`, `counts_toward_budget`, `household_food` boolean, manual budget checkbox trên form.

#### 7.6.13 Streak removal

P1.6 loại Streak khỏi product. Lý do: YueDaily hỗ trợ mindful spending/saving; ngày không giao dịch có thể là kết quả tích cực; streak penalizes no-spend days.

Loại khỏi spec: current streak, last logged date, daily streak, streak badge, streak encouragement, 🔥 streak UI. **Không** thay bằng no-spend streak / saving streak / daily logging streak.

Legacy DB: leave streak table/data inert; fresh install không tạo streak storage; không bắt buộc DROP migration.

#### 7.6.14 Backup v4

`backupVersion = 4` adds: `categories.budget_group`, **`budget_periods`** (`budget_key`, `period_start`, `period_end`, `limit_amount`). v4 không export product streak state.

Restore **preserve period boundaries exactly** — không regenerate start/end từ calendar month. v1–v3: no budget periods; restore **không** fabricate historical limits; sau restore, P1.6 init có thể tạo first/current period theo normal rules. Legacy streak ignored/inert (xem §6.5).

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
| Hành vi lỗi | Phân loại lỗi rõ ràng (thiếu key, auth, model, quota, mạng, timeout); luôn cho phép nhập tay |

**P1.7A — AI Receipt Scan Reliability**

| Khía cạnh | Mô tả |
|-----------|-------|
| Thứ tự provider | **Gemini 2.5 Flash‑Lite → Gemini 2.5 Flash** (primary chain) |
| Groq | **Tắt** cho quét ảnh hoá đơn — tài khoản hiện không có model vision/image phù hợp (`qwen/qwen3.6-27b` trả 404) |
| Env | `EXPO_PUBLIC_GEMINI_API_KEY` (bắt buộc cho quét); `EXPO_PUBLIC_GROQ_API_KEY` (optional, không dùng receipt scan P1.7A) |
| Expo Go | `EXPO_PUBLIC_*` được inline khi Metro bundle; đổi `.env` **phải** restart Metro (`npx expo start --clear`) |
| Fallback | Model unavailable / rate limit / 5xx / timeout → thử model Gemini kế tiếp |
| Lỗi auth | 401 → key không hợp lệ; 403 → từ chối quyền (không gom mọi lỗi thành “key sai”) |
| Lỗi không phải auth | 404 model, 429/quota, mạng — **không** hiển thị “API key không hợp lệ” |
| Manual entry | AI lỗi không chặn lưu giao dịch |
| Bảo mật key | Key client-side (`EXPO_PUBLIC_*`) — không phải secret thật; backend proxy **deferred** |
| Receipt archive | **Deferred P1.7B** — P1.7A không đổi `transactions.image_uri` / persistence |

Implementation: `src/services/receiptAi/*`, hook `src/hooks/useGemini.ts`.

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
| Policy vs tracker | App ghi fact; không hard-block tổ hợp source × audience. Budget limit 7.500.000đ là configured monthly limit (P1.6), không phải Woori balance. |

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
- Không model Family Savings như expense budget hay spending account.
- Household Food Budget (P1.6) là monitoring derived — không enforcement khi Save.
- Streak **không** còn là product feature (P1.6).
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

### Đã hoàn thành — P1.5 / P1.5.4 Source & Audience Foundation

- Source-first transaction model; `source_id` = **Nguồn chi**.
- Bỏ Người thanh toán / Ai trả khỏi primary UX; giữ legacy `payer`.
- UI labels Yue / Kai / Meo; Yue + Meo (`wife_and_sister`).
- Tách Tiền mặt Yue / Tiền mặt Kai; Woori · Quỹ ăn.
- Home tabs Tất cả / Cá nhân Yue / Quỹ chung theo `spending_group`.
- Backup v3; restore v1–v3.
- Acceptance scenarios A–H.

### Implemented / verified — P1.6 Household Food Budget

| Hạng mục | Ghi chú |
|----------|---------|
| Payday food budget limit | 7.500.000đ/kỳ (05→04); Ăn uống + Trà & Cà phê |
| Budget membership | `household` source + `household_food` category + date in period |
| Planned contribution | Kai 80% / Yue 20% (display only) |
| Home budget card + Detail | Active period by date; independent of Home tab + calendar month |
| VCB Shop → household | One-time trusted migration |
| Category `budget_group` + **`budget_periods`** | Backup v4 |
| Streak removal | Legacy data inert |

**Trạng thái:** Implemented / verified (PRD v1.6.0; Expo Go + expo-sqlite).

### Implemented / verified — P1.7A AI Receipt Scan Reliability

| Hạng mục | Ghi chú |
|----------|---------|
| Provider order | Gemini Flash-Lite → Gemini Flash |
| Groq receipt vision | Disabled — no verified image model on account |
| Error classification | missing_key, auth, permission, model, quota, network, timeout |
| False key-error fix | 404/rate limit/network no longer labeled as key invalid |
| Expo Go env | Metro restart required after `.env` change |
| Receipt persistence | Unchanged — deferred **P1.7B** |

**Trạng thái:** Implemented / verified (PRD v1.7A; Expo Go).

### Tương lai — P1.7+

| Ưu tiên | Hạng mục | Ghi chú |
|---------|----------|---------|
| **P1.7B** | Receipt image archive | Persistent receipt storage, viewer, backup media — sau P1.7A. |
| **P1.7C** | Spending Insights | Food vs drinks/snacks, big spend, one-off / recurring (`expense_nature`), weekday/weekend patterns, baseline lifestyle. |
| P2 | Widget / shortcut chụp nhanh | Phụ thuộc nền tảng |

Các hạng mục **không** nằm trong lộ trình sản phẩm cốt lõi: UI API key Cài đặt, repeat transaction, export CSV, pending inbox, thu nhập / cash-flow / opening balance, shop accounting / profit / owner draw, Family Savings balance, reimbursement / internal transfer, actual contribution ledger, bank sync, streak/gamification.

---

## 13. Tài liệu liên quan

| Tài liệu | Nội dung |
|----------|---------|
| [`README.md`](./README.md) | Setup dev, build EAS, schema SQLite chi tiết, kiến trúc code, AI technical notes. **Cần cập nhật Data Model** cho P1.6: `budget_group`, **`budget_periods`** (`household_food` only), backup v4, VCB Shop `spending_group`, payday cycle scope (§7.6.1a), streak removal. |

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

**Expected sau migration (P1.6):**

- Source vẫn = VCB Shop; `spending_group = household`.
- Audience vẫn = Yue + Kai.
- Amount không đổi.
- **Không** tự chuyển thành Woori.
- Giao dịch Ăn uống từ VCB Shop **tính** Household Food Budget.

---

## 15. Câu hỏi sản phẩm (P1.5 + P1.6)

App phải trả lời được nhanh:

- Tháng này tổng chi bao nhiêu?
- Chi vào category nào?
- Khoản này lấy tiền từ đâu? (Woori · Quỹ ăn / VPBank / Tiền mặt Yue / Tiền mặt Kai / VCB Shop)
- Chi cho ai? (Yue / Kai / Yue + Kai / Yue + Meo / Yue + Kai + Meo)
- Woori đã được dùng cho những transaction nào?
- Woori dùng bao nhiêu cho Yue + Kai?
- Woori dùng bao nhiêu cho Yue + Kai + Meo?
- Yue + Meo đã tiêu bao nhiêu qua VPBank / Tiền mặt Yue?
- Historical VCB Shop spending (household source) là bao nhiêu?
- Tháng này Household Food Budget **kỳ active** đã dùng bao nhiêu / còn bao nhiêu? (P1.6 — resolve period chứa hôm nay)
- Ăn uống vs Trà & Cà phê breakdown trong budget? (P1.6)

App **không** cần trả lời chính xác:

- Ai physically đưa tiền / quét QR?
- Ai duyệt khoản chi?
- Woori còn balance bao nhiêu?
- Kai/Yue đã thực nạp bao nhiêu vào quỹ ăn? → **P1.6+ out of scope**

---

## 16. Kịch bản chấp nhận P1.6 (Household Food Budget)

Critical test cases (future implementation):

| Case | Expected budget membership |
|------|---------------------------|
| Woori + food | included |
| Cash Kai + food | included |
| VCB Shop + food | included |
| VPBank + Yue + food | excluded |
| VPBank + Yue+Meo + food | excluded |
| VPBank + Yue+Kai + food | excluded (*Yue mời Kai*) |
| Woori + Yue + food | included |
| VCB Shop + Shopping | excluded |
| household source + Coffee (Trà & Cà phê) | included |
| personal source + Coffee | excluded |
| archived household source + food | included historically |

**Must explicitly test:** changing **only** `expense_audience` does **not** change budget membership.

**General reporting invariant:** Home tổng tháng, tabs Cá nhân Yue / Quỹ chung, Statistics, category/source/audience reports — **calendar month** (01→cuối tháng). **Only** Budget card/Detail uses 05→04. `cycle_start_day` applies to `budget_key = household_food` only.

**Home budget card:** switching tabs must **not** change budget amounts. Card shows active **budget period** (date-resolved), not calendar month from Home lịch.

**Period boundaries (kỳ 05/09–04/10):** 04/09 excluded; 05/09–04/10 included; 05/10 excluded (next period). Move 04/10 → 05/10 recalculates both periods.

**Transition 01–04/09:** household food transactions exist in Home/Stats but do **not** consume 05/09–04/10 limit.

**Over-budget:** app shows *Vượt …*; Save and household sources remain allowed.

**Streak:** no UI, no reads/writes after P1.6.

**Backup v4:** export/import `budget_group` + **`budget_periods`** (start/end/limit); v1–v3 restore must not fabricate historical limits.

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

## CHANGELOG 1.6.0

Cập nhật 2026-09-01 · phiên bản **1.6.0** · **P1.6 Household Food Budget** (specified; ready for implementation).

- **Payday cycle scope:** `cycle_start_day = 5` và 05→04 **chỉ** cho `budget_key = household_food`; general reporting (Home, Statistics, category/source/audience) **giữ tháng dương lịch**.
- **Household Food Budget:** ngân sách **7.500.000đ/kỳ** cho **Ăn uống** + **Trà & Cà phê**; kỳ **payday-aligned 05/MM → 04/(MM+1)**; spent/remaining derived.
- **First configured period:** 05/09/2026 → 04/10/2026; **01–04/09** transition days; không fake August periods.
- **Planned contribution:** Kai 80% (6.000.000đ) / Yue 20% (1.500.000đ) — display only.
- **Budget membership:** `household` source + `household_food` category + **date in period**; **`expense_audience` không quyết định**.
- **VCB Shop → `household`:** one-time migration; không phải Woori balance.
- **`budget_periods`:** `period_start` / `period_end` / `limit_amount` — không calendar `monthly_budgets`.
- **Home:** card Quỹ ăn kỳ (05/09 – 04/10); active period by date; **Statistics và Home monitoring giữ tháng dương lịch** (§7.6.1a).
- **Yue + Kai via VPBank:** *Yue mời Kai* — excluded.
- **Streak removed;** **Backup v4** with `budget_periods`; restore preserve period boundaries.
- **Out of scope P1.6:** account balances, contribution ledger, bank sync, salary tracking, rollover, enforcement on Save.

---

## README / TECH SPEC FOLLOW-UP

Sau khi PRD được duyệt, cập nhật kỹ thuật (không implement trong bước viết PRD này):

| Hạng mục | Việc cần làm |
|----------|----------------|
| **DB migration (P1.6)** | `budget_group`; `budget_periods`; VCB Shop → household; first period 2026-09-05→2026-10-04 only; no August fake periods; 01–04/09 not attached to first period. Idempotent. |
| **Legacy payer compatibility** | Giữ cột/field `payer` trên transaction và bảng `payers` cho backup; **không** expose CRUD Người trả trên Settings. Form không bắt chọn; Home/Stats không ưu tiên payer; không xóa historical data. |
| **Source master-data** | Terminology **Nguồn chi**. Trusted classification: Woori · Quỹ ăn, Tiền mặt Kai, VCB Shop → `household`; VPBank, Tiền mặt Yue → `personal_yue`. Legacy `Tiền mặt` / `Chuyển khoản` → NULL. VCB Shop **không** unclassified sau P1.6 migration. |
| **Source active/inactive** | `is_active`: archived ẩn khỏi form tạo mới; lịch sử / Thống kê / backup giữ `source_id`. |
| **Audience enum / labels** | Giữ identifier `wife` / `husband` / `couple` / `couple_and_sister` / `unspecified`; thêm `wife_and_sister`; đổi `EXPENSE_AUDIENCE_LABELS` → Yue / Kai / Yue + Kai / Yue + Meo / Yue + Kai + Meo / Chưa phân loại. Default mới vẫn `couple`. |
| **Transaction form** | Bỏ dropdown Ai trả / Người thanh toán. Layout: Danh mục \| Chi cho ai · Nguồn chi \| Ngày + mô tả. Default audience `couple`; default source last-selected. Không thêm quỹ tiền / người duyệt. |
| **Home transaction metadata** | Row / bottom sheet: `Chi cho: …` + `Nguồn: …`. Quick views Tất cả / Cá nhân Yue / Quỹ chung theo `sources.spending_group`. Không hiện Người thanh toán. |
| **Statistics filters** | Primary: kỳ, danh mục, nguồn chi, chi cho ai, search. Aggregation **Chi theo nguồn** + **Chi cho ai**. Cross-filter §5.5. Payer filter nếu còn: temporary, không core. |
| **Source aggregation / Tài khoản** | Màn Tài khoản report theo `source_id`, không số dư. Không biến thành budget dashboard. |
| **Backup schema** | v4: `sources`, `categories.budget_group`, **`budget_periods`**, transactions, legacy payer. Preserve period_start/end. Restore v1–v4. |
| **P1.6 budget** | `budget_group`; **`budget_periods`** (05→04, `budget_key = household_food` only); Home budget card by active period; **general reporting stays calendar-month**. |
| **VCB Shop migration** | One-time: `spending_group = household`; preserve ID; idempotent. |
| **Streak removal** | No UI/read/write; legacy inert; fresh install no streak table. |
| **P1.6 tests** | §16 cases; audience-only edit unchanged; over-budget non-blocking. |
| **Settings** | Section **Nguồn chi** (unused → Xoá; referenced → Lưu trữ; Nhóm theo dõi khi tạo / khi chưa dùng). Không CRUD Người trả trên UI. Không thêm Quỹ tiền. |
| **Restore compatibility** | Backup cũ: giữ source/audience/payer; map label UI Vợ/Chồng → Yue/Kai; không merge cash; không VCB → Woori; không infer. |
| **Migration tests** | VCB Shop → household (not remap to Woori); `budget_group` on trusted category names; audience-only edit does not change budget membership. |
| **Unit / integration tests** | Scenarios A–H + §16 P1.6; restore v1–v4; audience-only edit budget invariant. |
| **AI layer** | Đảm bảo prompt/parser không điền `source_id`, `expense_audience`, `payer`. |
| **Copy / i18n labels** | Thay “Ai trả”, “Người thanh toán”, “Nguồn tiền”, “Nguồn thanh toán”, “Vợ/Chồng” trên form, stats, settings, accounts, home cho khớp P1.5.1. |

---

## IMPLEMENTATION BOUNDARY

> **P1.5 (hoàn thành):** Chi bao nhiêu → Chi gì → Chi cho ai → Lấy tiền từ đâu.  
> **P1.6 (implemented / verified):** Household Food Budget monitoring — derived từ `source.spending_group` + `category.budget_group`; **không** phải Woori balance; **không** enforcement.

**Triển khai trong P1.6 (khi implement):** food limit 7,5m per payday period (`household_food` only), Budget card/Detail (05→04), `budget_group`, **`budget_periods`**, VCB Shop migration, backup v4, streak removal. **Không** đổi kỳ Home/Statistics sang 05→04.

**Không triển khai trong P1.6:** account balances, contribution/top-up ledger, bank sync, salary/income tracking, rollover, streak/gamification, transaction-level budget fields, block Save when over budget, generic multi-budget engine, notifications, automatic transfer.

Những hạng mục insights nâng cao thuộc **P1.7 — Spending Insights**. Không tự mở rộng P1.6 sang accounting app.

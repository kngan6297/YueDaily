# YueDaily 🌸

> Local-first app theo dõi chi tiêu gia đình · Expo SDK 54 · SQLite · AI quét hoá đơn

**Đặc tả sản phẩm (PRD):** [`APP_SPECIFICATION.md`](./APP_SPECIFICATION.md) — _app làm gì, cho ai, phạm vi tính năng_
**Tài liệu này** — _cách clone, chạy, build và hiểu codebase_

---

## Quick start

```bash
git clone https://github.com/kngan6297/Yozakura.git
cd Yozakura
npm install

# .env — cần ít nhất một key
echo "EXPO_PUBLIC_GROQ_API_KEY=gsk_xxxxxxxx" > .env
echo "EXPO_PUBLIC_GEMINI_API_KEY=AIzaSyxxxxxxxx" >> .env

npm start
```

| Yêu cầu      | Ghi chú                                                                     |
| ------------ | --------------------------------------------------------------------------- |
| Node.js ≥ 18 |                                                                             |
| API key      | [Groq](https://console.groq.com) hoặc [Gemini](https://aistudio.google.com) |
| EAS CLI      | Chỉ khi build APK: `npm i -g eas-cli`                                       |

> Camera im lặng (tắt shutter) cần **EAS native build** — Expo Go không đủ.

---

## Build Android

```bash
npx eas-cli login
npx eas-cli build --platform android --profile preview    # APK nội bộ
npx eas-cli build --platform android --profile production # Play Store
```

Đặt env trên [expo.dev](https://expo.dev) → project Yozakura → **Environment variables** (profile `preview`).

---

## Tech stack

| Layer     | Thư viện                                            |
| --------- | --------------------------------------------------- |
| Framework | Expo 54 · RN 0.81 · React 19                        |
| Routing   | Expo Router 6 (`src/app`)                           |
| DB        | expo-sqlite 16 · WAL · FK ON                        |
| Camera    | expo-camera 17 · image-picker · image-manipulator   |
| AI        | Groq API → Gemini 2.5 Flash-Lite → Gemini 2.5 Flash |
| Charts    | react-native-svg 15                                 |
| Backup    | expo-file-system · sharing · document-picker        |
| State     | Hooks thuần (`useState`, `useFocusEffect`)          |
| Language  | TypeScript strict                                   |

---

## Cấu trúc thư mục

```
YueDaily/
├── src/
│   ├── app/                      # Expo Router
│   │   ├── _layout.tsx           # DB init, BottomSheetPortal, Stack
│   │   ├── form.tsx              # Form chi tiêu + AI scan (source-first)
│   │   ├── camera.tsx            # Camera native / file picker web
│   │   └── (tabs)/
│   │       ├── _layout.tsx       # Tab bar + FAB camera
│   │       ├── index.tsx         # Lịch tháng
│   │       ├── reports.tsx       # Thống kê (nguồn chi + chi cho ai)
│   │       ├── accounts.tsx      # Chi theo nguồn chi
│   │       ├── settings.tsx      # CRUD nguồn chi / danh mục + backup
│   │       └── camera-tab.tsx    # Redirect → /camera
│   ├── components/
│   │   ├── camera/CaptureButton.tsx
│   │   ├── form/AmountKeyboard.tsx
│   │   └── ui/
│   │       ├── BottomSheetModal.tsx   # Portal + safe area đáy
│   │       └── BottomSheetPortal.tsx
│   ├── constants/
│   │   ├── layout.ts             # TAB_BAR_CONTENT_HEIGHT, SYSTEM_NAV_BAR_FALLBACK
│   │   └── theme.ts
│   ├── database/
│   │   ├── initDb.ts             # Schema + seed nguồn chi idempotent
│   │   ├── sourceSeed.ts         # Example source names (không phải product enum)
│   │   ├── sourceLifecycle.ts    # Active / archived source picker
│   │   ├── categoryUsage.ts      # Form category order (usage DESC)
│   │   ├── homeSpendView.ts      # Home tabs: spending_group, not audience
│   │   ├── transactions.ts       # CRUD; update preserve legacy payer
│   │   ├── categories.ts         # categories, sources, payers, streak
│   │   ├── reportQueries.ts      # Filter/aggregation SQLite
│   │   ├── reportCalculations.ts # Pure helpers (testable)
│   │   └── backup.ts             # JSON backup/restore version 3
│   ├── hooks/
│   │   ├── useDatabase.ts
│   │   ├── useGemini.ts          # Multi-provider AI
│   │   ├── useStreak.ts
│   │   └── useModalBottomInset.ts
│   ├── types/index.ts            # ExpenseAudience + UI labels Yue/Kai/Meo
│   └── utils/
│       ├── date.ts
│       └── lastSource.ts         # Last-selected source_id (AsyncStorage)
├── assets/                       # Icon, splash (root — Expo convention)
├── APP_SPECIFICATION.md          # PRD
├── app.json
├── index.ts                      # expo-router/entry
├── metro.config.js               # + .wasm cho SQLite web
└── tsconfig.json                 # Path aliases → src/*
```

### Path aliases

```json
"@/*"           → "src/*"
"@components/*" → "src/components/*"
"@database/*"   → "src/database/*"
"@hooks/*"      → "src/hooks/*"
"@constants/*"  → "src/constants/*"
"@types/*"      → "src/types/*"
"@utils/*"      → "src/utils/*"
```

---

## Luồng điều hướng

```
src/app/_layout.tsx (init DB)
└── (tabs)/
    ├── index        → FAB / modal ngày → /camera → /form
    ├── reports
    ├── camera-tab   → /camera
    ├── accounts     → [+ Thêm] → /camera
    └── settings

/camera  → /form?imageUri=...&transactionDate=...
/form    → save → router.dismissAll()
         → /form?transactionId=&isEdit=true  (sửa)
```

---

## Data Model (SQLite)

Database: `yozakura.db`

P1.5 attribution (source-first): mỗi giao dịch trả lời *chi bao nhiêu / chi gì / chi cho ai / lấy tiền từ đâu* qua `amount`, `category_id`, `expense_audience`, `source_id`.

`payer` là **legacy**: cột vẫn NOT NULL, backup vẫn preserve, form/thống kê không còn bắt user chọn. Insert mới ghi `LEGACY_DEFAULT_PAYER` (`Vợ`) để thỏa schema. `updateTransaction` **không** ghi đè `payer`.

Không có `funding_pool`, `approved_by`, `expense_nature`, hay balance/budget.

### `transactions`

| Cột                 | Kiểu       | Ghi chú                                                      |
| ------------------- | ---------- | ------------------------------------------------------------ |
| `id`                | INTEGER PK |                                                              |
| `amount`            | INTEGER    | VNĐ                                                          |
| `type`              | TEXT       | `chi` \| `thu` (legacy; app chỉ ghi `chi`)                   |
| `category_id`       | INTEGER FK | nullable khi xoá danh mục                                    |
| `source_id`         | INTEGER FK | Nguồn chi; nullable khi xoá nguồn                            |
| `payer`             | TEXT       | Legacy NOT NULL DEFAULT `'Vợ'`; không còn primary UX         |
| `expense_audience`  | TEXT       | Identifier nội bộ — xem bảng mapping dưới                    |
| `image_uri`         | TEXT       |                                                              |
| `location`          | TEXT       | legacy                                                       |
| `note`              | TEXT       | Mô tả                                                        |
| `status`            | TEXT       | `complete` \| `pending`                                      |
| `created_at`        | TEXT       | `datetime('now','localtime')`                                |

Index: `created_at`, `status`.

Migration: DB cũ thiếu `expense_audience` → `ALTER TABLE ... DEFAULT 'unspecified'` (không tự gán `couple`). Giá trị mới `wife_and_sister` là TEXT — không cần ALTER. Không rewrite audience/source lịch sử.

### `expense_audience` — enum nội bộ + label UI

Identifier **không** đổi chỉ vì đổi copy. UI P1.5:

| Giá trị nội bộ        | Label UI          |
| --------------------- | ----------------- |
| `wife`                | Yue               |
| `husband`             | Kai               |
| `couple`              | Yue + Kai         |
| `wife_and_sister`     | Yue + Meo         |
| `couple_and_sister`   | Yue + Kai + Meo   |
| `unspecified`         | Chưa phân loại    |

Giao dịch mới mặc định `couple`. `unspecified` chỉ hiện khi sửa bản ghi legacy. Một transaction = đúng một audience; không split.

### `categories`

| Cột                                                          | Kiểu |
| ------------------------------------------------------------ | ---- |
| `id`, `name`, `type` (`chi`\|`thu`\|`both`), `icon`, `color` |      |

Seed: 12 danh mục chi tiêu (xem `src/database/initDb.ts`). Cột `type` giữ cho backup cũ. Form giao dịch sắp xếp danh mục theo số giao dịch chi `complete` (`usage_count DESC`, `name ASC`); Cài đặt giữ `ORDER BY name`.

### `sources`

| Cột                          | Kiểu |
| ---------------------------- | ---- |
| `id`, `name` UNIQUE          |      |
| `is_active` INTEGER NOT NULL | `1` đang dùng / `0` đã lưu trữ; DEFAULT `1` |
| `spending_group` TEXT        | `personal_yue` \| `household` \| NULL (Chưa phân loại) |

Master data generic — **không** hardcode ngân hàng thành product enum. Form tạo mới chỉ list source `is_active = 1`. Thống kê / Tài khoản / backup đọc mọi source (kể cả archived) để giữ lịch sử. Home monitoring lọc theo `spending_group`, **không** theo `expense_audience` và **không** theo `is_active`.

Seed idempotent (`missingSourceSeeds` + `INSERT OR IGNORE`): thêm tên còn thiếu kèm group, không rename/merge source đã có (kể cả `Tiền mặt` hay `VCB Shop` lịch sử). Fresh install nhận example config đang dùng của Yue:

| Tên | `spending_group` |
| --- | --- |
| Woori · Quỹ ăn | `household` |
| VPBank | `personal_yue` |
| Tiền mặt Yue | `personal_yue` |
| Tiền mặt Kai | `household` |

`VCB Shop` / `Tiền mặt` / `Chuyển khoản` không seed trên install mới.

Migration: `ALTER` thêm `spending_group`, rồi classify **exact name** VPBank / Tiền mặt Yue / Woori · Quỹ ăn / Tiền mặt Kai. Không fuzzy, không classify legacy seeds. Lần chạy sau không re-classify (user có thể đã đổi tên; group đã gắn vẫn giữ).

Tạo nguồn mới bắt buộc chọn Nhóm theo dõi. Source đã có giao dịch: khóa `spending_group`; vẫn đổi tên / Lưu trữ / Dùng lại.

Migration P1.5.2: `ALTER` thêm `is_active DEFAULT 1`, rồi archive **exact name** `Tiền mặt`, `Chuyển khoản`, `VCB Shop` nếu row đó tồn tại. Không fuzzy, không xóa, không đổi `source_id`. Lần chạy sau không re-archive (user có thể Dùng lại trong Cài đặt).

`Tiền mặt Yue` và `Tiền mặt Kai` là hai source khác nhau. Không gộp thành `Tiền mặt`.

Form sửa giao dịch cũ: source archived hiện tại + các source đang dùng. Last-selected source đã archived không preselect cho giao dịch mới.

### `payers`

| Cột                                  | Kiểu |
| ------------------------------------ | ---- |
| `id`, `name` UNIQUE, `icon`, `color` |      |

Seed: Vợ 👩‍🦰, Chồng 👨‍🦱. Bảng/cột legacy cho backup; **không** còn CRUD trên Settings hay dropdown trên form.

### `streaks`

Single row `id=1`: `current_streak`, `last_logged_date`.

`updateStreak()` tính lại từ tập ngày có giao dịch `complete` (hỗ trợ backdate).

### Backup / restore

`backupVersion: '3'` — thêm `sources.spending_group`. Export mới ghi `'3'`. Restore chấp nhận `'1'`, `'2'`, `'3'`; version khác → reject.

Backup JSON gồm `transactions` (kể cả `payer` + `expense_audience` + `source_id`), `sources` (kể cả `is_active` + `spending_group`), `categories`, `payers`, `streak`.

Restore:

- v1 không có `is_active` → default đang dùng, rồi archive exact seed `Tiền mặt` / `Chuyển khoản` / `VCB Shop` nếu có; classify exact trusted spending groups
- v2 giữ nguyên `is_active`; classify exact trusted spending groups (`VPBank` / `Tiền mặt Yue` → personal; `Woori · Quỹ ăn` / `Tiền mặt Kai` → household; legacy → NULL)
- v3 giữ nguyên `is_active` và `spending_group` (round-trip, kể cả nguồn đã đổi tên)

Restore backup cũ:

- thiếu `expense_audience` → `unspecified`; không infer `wife_and_sister`
- giữ nguyên `source_id` / tên source; không merge tiền mặt; không map VCB → Woori
- giữ nguyên `payer`

### Thống kê

Filter độc lập theo kỳ (ngày / tháng / khoảng), `source_id`, `expense_audience`, search (mô tả / số tiền / danh mục). Cross-filter source × audience. Aggregation **Chi theo nguồn**, **Chi cho ai** và danh mục chạy SQL `GROUP BY` trên toàn bộ giao dịch khớp filter (không phụ thuộc list). Danh sách giao dịch trên màn hình vẫn `LIMIT 50`. Màn Tài khoản report theo `source_id`, không số dư.

---

## AI Integration

Implementation: `src/hooks/useGemini.ts`

### Provider chain

```
Groq (llama-4-scout-17b-16e-instruct)
  → Gemini 2.5 Flash-Lite
  → Gemini 2.5 Flash
```

### API keys

```env
EXPO_PUBLIC_GROQ_API_KEY=gsk_...
EXPO_PUBLIC_GEMINI_API_KEY=AIzaSy...
```

Cấu hình qua `.env` (dev) hoặc biến môi trường EAS (build). Không có màn quản lý API key trong app; key không được backup.

### Output type

```typescript
interface GeminiAnalysisResult {
  is_receipt?: boolean; // false → amount = 0, nhập tay
  amount?: number;
  description?: string;
  category?: string;
}
```

AI chỉ gợi ý amount / category / description. **Không** infer `source_id` hay `expense_audience`.

### Error handling

| Tình huống   | Hành động                   |
| ------------ | --------------------------- |
| Mất mạng     | Dừng chain                  |
| Timeout 20s  | Skip provider               |
| 413 (Groq)   | Skip → Gemini               |
| 401/403      | Dừng, báo key sai           |
| 429/503      | Retry 1× sau 3.5s, rồi skip |
| base64 > 4MB | Reject trước khi gọi        |

### Nén ảnh (form.tsx)

```typescript
await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1024 } }], {
  compress: 0.7,
  format: SaveFormat.JPEG,
  base64: true,
});
```

---

## Design System

File: `src/constants/theme.ts` · Pastel sakura — **không dùng đỏ/xanh thô**.

| Token              | Hex       | Dùng cho       |
| ------------------ | --------- | -------------- |
| pink[400]          | `#FFB7C5` | Nút chính, chi |
| pink[500]          | `#FF8FA8` | Chi tiêu       |
| mint[400]          | `#4BBFA0` | Accent phụ (legacy palette) |
| lavender[300]      | `#C5B0E8` | Accent         |
| background.primary | `#FFFBFB` | Nền app        |

---

## Quy tắc kiến trúc

1. **Local-first** — SQLite on-device; backup JSON do user quản lý.
2. **Không global state** — `useState` + `useFocusEffect` reload màn hình.
3. **DB singleton + WAL** — Tự reopen khi native object bị giải phóng (hot reload).
4. **Parse date an toàn** — `created_at.slice(0,10).split('-')`; tránh `new Date()` với SQLite localtime trên Hermes.
5. **Join metadata** — Query giao dịch JOIN categories/sources cho `category_name`, `category_icon`, `source_name`.
6. **Bottom sheet root-level** — `BottomSheetPortalProvider` ở `_layout.tsx`; inset đáy = navbar hệ thống only (`useModalBottomInset`).
7. **Tab bar custom** — `TAB_BAR_CONTENT_HEIGHT` (62) + safe area; FAB giữa → `/camera`.
8. **Master data** — CRUD sources/categories trong Settings; form chỉ chọn, không thêm danh mục. Payer **không** còn trên Settings UI (cột/bảng legacy giữ cho backup). Source unused → Xoá; referenced → Lưu trữ / Dùng lại (`is_active`). `spending_group` trên source cho Home (Cá nhân Yue / Quỹ chung); khóa sau khi đã có giao dịch.
9. **Source-first filters** — Thống kê lọc theo nguồn chi + chi cho ai (không còn primary filter payer). Last-selected `source_id` lưu AsyncStorage; bỏ qua nếu source đã archived.
10. **Pending status (legacy)** — Cột `status` + giá trị `pending` giữ cho backup/schema cũ; không có UI inbox hay flow tạo pending.

---

## Scripts

```bash
npm start          # Expo dev server
npm run android    # expo run:android
npm run ios        # expo run:ios
npm run web        # expo start --web
npm run build:web  # expo export --platform web
npm test           # Unit tests (date, report helpers, attribution, source lifecycle, category usage, Home spend groups)
npx tsc --noEmit   # Typecheck
```

---

## Environment & config

| File              | Vai trò                                                     |
| ----------------- | ----------------------------------------------------------- |
| `.env`            | API keys (gitignored)                                       |
| `app.json`        | Expo config; `softwareKeyboardLayoutMode: resize` (Android) |
| `eas.json`        | Build profiles                                              |
| `metro.config.js` | WASM support cho SQLite web                                 |

---

## License

MIT

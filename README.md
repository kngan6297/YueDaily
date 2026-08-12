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
│   │   ├── form.tsx              # Form thu/chi + AI scan
│   │   ├── camera.tsx            # Camera native / file picker web
│   │   └── (tabs)/
│   │       ├── _layout.tsx       # Tab bar + FAB camera
│   │       ├── index.tsx         # Lịch tháng
│   │       ├── reports.tsx       # Thống kê
│   │       ├── accounts.tsx      # Chi theo nguồn tiền
│   │       ├── settings.tsx      # CRUD + backup
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
│   │   ├── initDb.ts             # Schema + seed
│   │   ├── transactions.ts       # CRUD + aggregations
│   │   ├── categories.ts         # categories, sources, payers, streak
│   │   └── backup.ts
│   ├── hooks/
│   │   ├── useDatabase.ts
│   │   ├── useGemini.ts          # Multi-provider AI
│   │   ├── useStreak.ts
│   │   └── useModalBottomInset.ts
│   ├── types/index.ts
│   └── utils/date.ts
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

### `transactions`

| Cột           | Kiểu       | Ghi chú                                     |
| ------------- | ---------- | ------------------------------------------- |
| `id`          | INTEGER PK |                                             |
| `amount`      | INTEGER    | VNĐ                                         |
| `type`        | TEXT       | `chi` \| `thu` (legacy; app chỉ ghi `chi`)  |
| `category_id` | INTEGER FK | nullable khi xoá danh mục                   |
| `source_id`   | INTEGER FK | nullable khi xoá nguồn                      |
| `payer`       | TEXT       | Tên người trả (text, sync khi rename payer) |
| `image_uri`   | TEXT       |                                             |
| `location`    | TEXT       | legacy                                      |
| `note`        | TEXT       | Mô tả                                       |
| `status`      | TEXT       | `complete` \| `pending`                     |
| `created_at`  | TEXT       | `datetime('now','localtime')`               |

Index: `created_at`, `status`.

### `categories`

| Cột                                                          | Kiểu |
| ------------------------------------------------------------ | ---- |
| `id`, `name`, `type` (`chi`\|`thu`\|`both`), `icon`, `color` |      |

Seed: 12 danh mục chi tiêu (xem `src/database/initDb.ts`). Cột `type` giữ cho backup cũ.

### `sources`

| Cột                 | Kiểu |
| ------------------- | ---- |
| `id`, `name` UNIQUE |      |

Seed: Tiền mặt, Chuyển khoản.

### `payers`

| Cột                                  | Kiểu |
| ------------------------------------ | ---- |
| `id`, `name` UNIQUE, `icon`, `color` |      |

Seed: Vợ 👩‍🦰, Chồng 👨‍🦱.

### `streaks`

Single row `id=1`: `current_streak`, `last_logged_date`.

`updateStreak()` tính lại từ tập ngày có giao dịch `complete` (hỗ trợ backdate).

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
8. **Master data** — CRUD payers/sources/categories trong Settings; form chỉ chọn, không thêm danh mục.
9. **Dynamic payers** — Filter Trang chủ / Thống kê / dropdown form load từ bảng `payers`.
10. **Pending status (legacy)** — Cột `status` + giá trị `pending` giữ cho backup/schema cũ; không có UI inbox hay flow tạo pending.

---

## Scripts

```bash
npm start          # Expo dev server
npm run android    # expo run:android
npm run ios        # expo run:ios
npm run web        # expo start --web
npm run build:web  # expo export --platform web
npm test           # Unit tests (date + report helpers)
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

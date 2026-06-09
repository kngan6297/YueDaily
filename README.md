# Yozakura 🌙🌸

Ứng dụng quản lý tài chính cá nhân / gia đình dành cho người Việt — chụp hoá đơn, AI tự điền thông tin, theo dõi chi tiêu theo danh mục.

---

## Tính năng

- **Chụp ảnh hoá đơn** — camera tích hợp sẵn, nhận diện bill tự động
- **AI phân tích thông minh** — hỗ trợ Groq (Llama 4 Scout) và Google Gemini 2.5; thứ tự ưu tiên: Groq → Gemini Lite → Gemini Flash
- **Nhập tay nhanh** — bàn phím số tuỳ chỉnh, chọn danh mục bằng lưới icon
- **11 danh mục chi tiêu** — Ăn uống, Trà & Cà phê, Mua sắm, Di chuyển, Làm đẹp, Sức khoẻ, Giải trí, Giáo dục, Gia đình, Thú cưng, Khác
- **Streak** — theo dõi chuỗi ngày nhập liệu liên tục
- **Báo cáo** — thống kê chi tiêu theo tuần / tháng / danh mục
- **Lưu cục bộ** — toàn bộ dữ liệu lưu trên thiết bị bằng SQLite (không cần tài khoản)
- **Hỗ trợ nhiều người** — phân chia chi tiêu theo người dùng

---

## Tech Stack

| Layer | Thư viện |
|---|---|
| Framework | [Expo](https://expo.dev) ~54 · React Native 0.81 |
| Navigation | Expo Router ~6 (file-based) |
| Database | expo-sqlite ~16 |
| Camera | expo-camera ~17 · expo-image-picker ~17 |
| AI | Groq API (`llama-4-scout-17b`) · Google Gemini 2.5 Flash/Lite |
| Animations | react-native-reanimated ~3.17 |
| State | React hooks thuần (useState / useCallback) |

---

## Yêu cầu

- Node.js ≥ 18
- [Expo CLI](https://docs.expo.dev/more/expo-cli/) (`npm install -g expo-cli`)
- Tài khoản [Expo](https://expo.dev) (để build APK qua EAS)
- API Key của [Groq](https://console.groq.com) hoặc [Google AI Studio](https://aistudio.google.com) (ít nhất một trong hai)

---

## Cài đặt & chạy local

```bash
# 1. Clone repo
git clone https://github.com/<your-username>/Yozakura.git
cd Yozakura

# 2. Cài dependencies
npm install

# 3. Tạo file .env (copy từ mẫu bên dưới)
# 4. Khởi động dev server
npm start
```

### Biến môi trường (`.env`)

Tạo file `.env` ở thư mục gốc:

```env
EXPO_PUBLIC_GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxx
EXPO_PUBLIC_GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxx
```

> API Key cũng có thể nhập trực tiếp trong ứng dụng ở màn hình **Cài đặt** mà không cần restart.

---

## Build APK (Android)

Xem hướng dẫn chi tiết bên dưới trong phần **"Lấy file APK"**.

---

## Cấu trúc thư mục

```
Yozakura/
├── app/
│   ├── _layout.tsx          # Root layout
│   ├── (tabs)/
│   │   ├── index.tsx        # Trang chủ (danh sách giao dịch)
│   │   ├── camera-tab.tsx   # Tab chụp ảnh
│   │   ├── reports.tsx      # Báo cáo
│   │   ├── accounts.tsx     # Tài khoản / người dùng
│   │   └── settings.tsx     # Cài đặt API Key
│   ├── camera.tsx           # Màn hình camera full-screen
│   └── form.tsx             # Form nhập giao dịch
├── components/
│   ├── camera/              # CaptureButton
│   ├── form/                # AmountKeyboard, CategoryGrid, PayerToggle
│   └── ui/                  # PastelBadge, StreakBanner
├── database/
│   ├── initDb.ts            # Khởi tạo schema SQLite
│   ├── transactions.ts      # CRUD giao dịch
│   └── categories.ts        # Danh mục mặc định
├── hooks/
│   ├── useDatabase.ts       # Hook truy vấn DB
│   ├── useGemini.ts         # Hook gọi AI (Groq + Gemini)
│   └── useStreak.ts         # Hook tính streak
├── constants/theme.ts       # Màu sắc, font, spacing
└── types/index.ts           # TypeScript types
```

---

## License

MIT

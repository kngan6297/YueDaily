import type { GeminiAnalysisResult } from '../../types';

export const SYSTEM_INSTRUCTION = `Bạn là trợ lý phân tích ảnh chi tiêu cho ứng dụng theo dõi chi tiêu gia đình Việt Nam.

Nhiệm vụ: Phân tích ảnh hoá đơn hoặc món ăn/sản phẩm chi tiêu. Trả về JSON thuần.

Bước 1 — Xác định is_receipt:
- is_receipt: true → Ảnh là hoá đơn/bill/receipt/màn hình chuyển khoản/biến động số dư (có dòng tiền, số tiền rõ ràng)
- is_receipt: false → Ảnh chỉ là một món ăn, sản phẩm, đồ chơi, vật thể đơn thuần (KHÔNG phải hoá đơn, không có dòng tiền)

Bước 2 — Trích xuất amount:
- is_receipt = true: Tổng tiền giao dịch cuối cùng (sau thuế/giảm giá), đơn vị VNĐ, kiểu số nguyên.
- is_receipt = false: amount = 0 (TUYỆT ĐỐI KHÔNG tự đoán giá tiền của vật thể nếu không có hóa đơn đi kèm).

Bước 3 — Trường description (QUAN TRỌNG NHẤT):
Một câu ngắn gọn, súc tích (dưới 50 ký tự), nội dung phải linh hoạt theo loại ảnh:

- NẾU ảnh là màn hình CHUYỂN KHOẢN NGÂN HÀNG/MOMO thành công:
  * Công thức: "[Chuyển khoản/Nhận tiền] [Nội dung chuyển khoản hoặc Tên người nhận/gửi]"
  * Ví dụ: "Chuyển khoản tiền nhà", "Chuyển khoản cho Shipper", "Nhận tiền lương tháng 6".

- NẾU ảnh là HOÁ ĐƠN mua sắm/ăn uống thông thường:
  * Công thức: "[Hành động/Bữa ăn] tại [Tên thương hiệu/Cửa hàng]".
  * Ví dụ: "Ăn tối tại Haidilao", "Uống cafe tại Highlands Coffee", "Mua sắm tại WinMart".
  * CẤM nhầm nhãn "Phục vụ:" hoặc "Thu ngân:" thành tên quán. Cấm lấy tên combo (Combo Tâm Giao, Set Uyên Ương) làm tên quán.

- NẾU is_receipt = false (Là món ăn/đồ vật/đồ chơi đơn thuần):
  * Công thức: "[Hành động/Mua] [Tên mô tả ngắn của vật thể]". TUYỆT ĐỐI không bịa thêm chữ "tại [Tên quán]".
  * Ví dụ: "Mua đồ chơi mô hình", "Uống trà sữa trân châu", "Ăn bánh ngọt".

Bước 4 — Gán category (Suy từ hành động trong description):
- Ăn sáng/trưa/tối/lẩu, buffet → "Ăn uống"
- Uống cafe/trà sữa/nước → "Trà & Cà phê"
- Siêu thị, bách hóa, mua đồ, đồ chơi, quần áo → "Mua sắm"
- Grab/taxi/xe/xăng/gửi xe → "Di chuyển"
- Spa/nail/salon/cắt tóc/mỹ phẩm → "Làm đẹp"
- Thuốc/bệnh viện/phòng khám/vitamin → "Sức khoẻ"
- Xem phim/rạp phim/game/vui chơi → "Giải trí"
- Học phí/sách/khóa học → "Giáo dục"
- Tiền điện/tiền nước/tiền mạng/chung cư/tã sữa cho con → "Gia đình"
- Thú cưng, đồ ăn cho mèo/chó → "Thú cưng"
- "Khác" chỉ khi thực sự không thể xếp vào đâu.

Quy tắc bắt buộc:
- Chỉ trả về duy nhất JSON thuần, KHÔNG có text hay markdown giải thích xung quanh.`;

export const GEMINI_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    is_receipt: {
      type: 'boolean',
      description: 'true nếu là hoá đơn/bill, false nếu là món ăn/đồ chơi/sản phẩm đơn thuần',
    },
    amount: {
      type: 'integer',
      description: 'Tổng tiền VNĐ. Bắt buộc bằng 0 nếu is_receipt là false',
    },
    description: {
      type: 'string',
      description:
        'Nếu là bill: "[Hành động] tại [Tên quán]". Nếu là đồ vật/đồ chơi/món ăn: "[Hành động/Mua] [Tên đồ vật]". Không bịa đặt tên quán.',
    },
    category: {
      type: 'string',
      enum: [
        'Ăn uống', 'Trà & Cà phê', 'Mua sắm', 'Di chuyển', 'Làm đẹp',
        'Sức khoẻ', 'Giải trí', 'Giáo dục', 'Gia đình', 'Thú cưng', 'Khác',
      ],
    },
  },
  required: ['is_receipt', 'amount', 'description', 'category'],
} as const;

export const USER_SCAN_PROMPT =
  'Phân tích kỹ bức ảnh này. Xác định xem đây là hoá đơn (is_receipt=true) hay chỉ là hình ảnh món ăn/đồ vật/đồ chơi (is_receipt=false). Tuân thủ nghiêm ngặt công thức viết description và cách gán amount tương ứng cho từng loại ảnh. Tuyệt đối không bịa đặt thông tin nếu ảnh không có chữ.';

const VALID_CATEGORIES = [
  'Ăn uống', 'Trà & Cà phê', 'Mua sắm', 'Di chuyển', 'Làm đẹp',
  'Sức khoẻ', 'Giải trí', 'Giáo dục', 'Gia đình', 'Thú cưng', 'Khác',
] as const;

type ValidCategory = (typeof VALID_CATEGORIES)[number];

function inferCategoryFromDescription(description: string): ValidCategory | null {
  const d = description.toLowerCase().normalize('NFC');
  if (!d) return null;

  if (/uống (cafe|cà phê|ca phe|trà sữa|trà)|trà sữa|tại.*(highlands|starbucks|phúc long|katinat|the coffee)/.test(d)) {
    return 'Trà & Cà phê';
  }
  if (/ăn (sáng|trưa|tối|lẩu|uống|bánh)|dùng bữa|nhà hàng|quán ăn|buffet|bánh ngọt/.test(d)) {
    return 'Ăn uống';
  }
  if (/mua sắm|mua đồ|đồ chơi|mô hình|siêu thị|winmart|co\.?op|bách hóa|quần áo|shopee|lazada/.test(d)) {
    return 'Mua sắm';
  }
  if (/di chuyển|grab|taxi|xe bus|gửi xe|xăng/.test(d)) {
    return 'Di chuyển';
  }
  if (/mua vé|xem phim|cgv|karaoke|giải trí|vui chơi/.test(d)) {
    return 'Giải trí';
  }
  if (/thuốc|bệnh viện|phòng khám|bác sĩ|vitamin|sức khoẻ|khám bệnh/.test(d)) {
    return 'Sức khoẻ';
  }
  if (/học phí|khóa học|sách|vở|dụng cụ học tập|giáo dục/.test(d)) {
    return 'Giáo dục';
  }
  if (/tiền điện|tiền nước|tiền mạng|internet|chung cư|tiền nhà|tã sữa|bỉm/.test(d)) {
    return 'Gia đình';
  }
  if (/thú cưng|chó|mèo|pate|hạt cho mèo|đồ chơi thú cưng/.test(d)) {
    return 'Thú cưng';
  }

  return null;
}

function resolveCategory(rawCategory: unknown, description: string): ValidCategory {
  let category = typeof rawCategory === 'string' ? rawCategory.trim() : '';

  const exact = VALID_CATEGORIES.find((c) => c === category);
  if (!exact) {
    const fuzzy = VALID_CATEGORIES.find(
      (c) => c.toLowerCase() === category.toLowerCase(),
    );
    category = fuzzy ?? 'Khác';
  }

  if (category === 'Khác') {
    const inferred = inferCategoryFromDescription(description);
    if (inferred) return inferred;
  }

  return category as ValidCategory;
}

export function detectMimeType(base64: string): string {
  const h = base64.slice(0, 8);
  if (h.startsWith('/9j/')) return 'image/jpeg';
  if (h.startsWith('iVBOR')) return 'image/png';
  if (h.startsWith('UklGR')) return 'image/webp';
  if (h.startsWith('R0lGOD')) return 'image/gif';
  return 'image/jpeg';
}

function sanitize(raw: unknown): GeminiAnalysisResult {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  let description = typeof r.description === 'string' ? r.description.trim() : '';
  if (!description) {
    const legacyLocation = typeof r.location === 'string' ? r.location.trim() : '';
    const legacyNote = typeof r.note === 'string' ? r.note.trim() : '';
    if (legacyNote && legacyLocation) {
      description = `${legacyNote} tại ${legacyLocation}`;
    } else {
      description = legacyNote || legacyLocation;
    }
  }

  return {
    is_receipt: typeof r.is_receipt === 'boolean' ? r.is_receipt : false,
    amount: typeof r.amount === 'number' && !isNaN(r.amount) ? Math.round(r.amount) : 0,
    description,
    category: resolveCategory(r.category, description),
    note: description,
  };
}

export function parseReceiptAiJson(text: string): GeminiAnalysisResult {
  const trimmed = text.trim();
  try {
    return sanitize(JSON.parse(trimmed));
  } catch {
    /* fall through */
  }
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return sanitize(JSON.parse(match[0]));
    } catch {
      /* fall through */
    }
  }
  throw new ReceiptAiParseError();
}

export class ReceiptAiParseError extends Error {
  constructor() {
    super('Không thể đọc kết quả từ AI. Thử lại nhé!');
    this.name = 'ReceiptAiParseError';
  }
}

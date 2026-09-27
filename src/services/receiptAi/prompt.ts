import type { GeminiAnalysisResult } from '../../types';
import { RECEIPT_AI_MAX_OUTPUT_TOKENS } from './config';

/**
 * Extraction prompt — shared by Groq + Gemini.
 * Category enum also enforced in Gemini responseSchema.
 */
export const SYSTEM_INSTRUCTION = `Đọc ảnh và chỉ trả JSON.

is_receipt: true nếu có giao dịch/số tiền, false nếu không.
amount: số VNĐ thực trả/thực nhận cuối cùng; không lấy tạm tính, tiền đưa, tiền thừa, số dư; không đoán.
description: ≤50 ký tự; tên người/quán và nội dung chuyển khoản chép nguyên văn, giữ đúng dấu, không tự sửa chính tả.
category: chọn đúng 1 nhóm theo mục đích chính:
Ăn uống; Trà & Cà phê; Mua sắm; Di chuyển; Làm đẹp; Sức khoẻ; Giải trí; Giáo dục; Gia đình; Thú cưng; Khác.
Ưu tiên nhóm chuyên biệt; chỉ dùng Khác khi không đủ căn cứ.`;

export const GEMINI_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    is_receipt: { type: 'boolean' },
    amount: { type: 'integer' },
    description: { type: 'string' },
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

/** Short user turn — details live in systemInstruction + schema. */
export const USER_SCAN_PROMPT = 'Đọc ảnh và chỉ trả JSON.';

/** Safe __DEV__ audit sizes (no secrets / no image). */
export function receiptAiPromptAudit(): {
  systemLen: number;
  userLen: number;
  schemaJsonLen: number;
  maxOutputTokens: number;
} {
  return {
    systemLen: SYSTEM_INSTRUCTION.length,
    userLen: USER_SCAN_PROMPT.length,
    schemaJsonLen: JSON.stringify(GEMINI_RESPONSE_SCHEMA).length,
    maxOutputTokens: RECEIPT_AI_MAX_OUTPUT_TOKENS,
  };
}

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

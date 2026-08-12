// ============================================================
// HOOK PHÂN TÍCH ẢNH AI - ĐA NHÀ CUNG CẤP
// Thứ tự thử: Groq (rất nhanh) → Gemini Lite → Gemini Flash
// ============================================================

import { useCallback, useState } from 'react';
import type { GeminiAnalysisResult } from '../types';

const TIMEOUT_MS = 20_000;
const RETRY_DELAY = 3_500;

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'qwen/qwen3.6-27b';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// Thử Lite trước (nhanh hơn), Flash là safety net cuối cùng
const GEMINI_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'] as const;

// ── Sentinel: "provider này không dùng được, thử cái tiếp theo" ──
class SkipProviderError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'SkipProviderError';
  }
}

// ── System instruction (Banking + bill + đồ vật) ──────
const SYSTEM_INSTRUCTION = `Bạn là trợ lý phân tích ảnh chi tiêu cho ứng dụng theo dõi chi tiêu gia đình Việt Nam.

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

// ── Gemini structured output schema (Đã sửa mô tả cho linh hoạt) ─────────────────────────
const GEMINI_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    is_receipt: { type: 'boolean', description: 'true nếu là hoá đơn/bill, false nếu là món ăn/đồ chơi/sản phẩm đơn thuần' },
    amount: { type: 'integer', description: 'Tổng tiền VNĐ. Bắt buộc bằng 0 nếu is_receipt là false' },
    description: {
      type: 'string',
      description:
        'Nếu là bill: "[Hành động] tại [Tên quán]". Nếu là đồ vật/đồ chơi/món ăn: "[Hành động/Mua] [Tên đồ vật]". Không bịa đặt tên quán.',
    },
    category: {
      type: 'string',
      enum: ['Ăn uống', 'Trà & Cà phê', 'Mua sắm', 'Di chuyển', 'Làm đẹp', 'Sức khoẻ', 'Giải trí', 'Giáo dục', 'Gia đình', 'Thú cưng', 'Khác'],
    },
  },
  required: ['is_receipt', 'amount', 'description', 'category'],
} as const;

// ── User Scan Prompt (Làm sạch, không nhồi nhét ví dụ gây ám thị AI) ─────────────────────────
const USER_SCAN_PROMPT =
  'Phân tích kỹ bức ảnh này. Xác định xem đây là hoá đơn (is_receipt=true) hay chỉ là hình ảnh món ăn/đồ vật/đồ chơi (is_receipt=false). Tuân thủ nghiêm ngặt công thức viết description và cách gán amount tương ứng cho từng loại ảnh. Tuyệt đối không bịa đặt thông tin nếu ảnh không có chữ.';

const VALID_CATEGORIES = [
  'Ăn uống', 'Trà & Cà phê', 'Mua sắm', 'Di chuyển', 'Làm đẹp',
  'Sức khoẻ', 'Giải trí', 'Giáo dục', 'Gia đình', 'Thú cưng', 'Khác',
] as const;

type ValidCategory = (typeof VALID_CATEGORIES)[number];

/** Suy luận category từ description khi AI trả "Khác" sai */
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

// ── Detect MIME type từ base64 header ────────────────────────
function detectMimeType(base64: string): string {
  const h = base64.slice(0, 8);
  if (h.startsWith('/9j/')) return 'image/jpeg';
  if (h.startsWith('iVBOR')) return 'image/png';
  if (h.startsWith('UklGR')) return 'image/webp';
  if (h.startsWith('R0lGOD')) return 'image/gif';
  return 'image/jpeg';
}

// ── Fetch với timeout ────────────────────────────────────────
async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ── Đọc message lỗi từ response body ────────────────────────
async function readErrorMsg(res: Response): Promise<string> {
  try {
    const j = await res.json();
    return j?.error?.message ?? j?.error?.error?.message ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

interface GeminiApiError {
  errorCode?: string;
  errorStatus?: string;
  errorMessage: string;
  errorDetails?: unknown;
}

/** Đọc body Gemini đúng một lần; parse JSON an toàn, fallback raw text. */
async function readGeminiApiError(res: Response): Promise<GeminiApiError> {
  let rawText = '';
  try {
    rawText = await res.text();
  } catch {
    return { errorMessage: `HTTP ${res.status}` };
  }

  const trimmed = rawText.trim();
  if (!trimmed) {
    return { errorMessage: `HTTP ${res.status}` };
  }

  try {
    const j = JSON.parse(trimmed) as Record<string, unknown>;
    const err = (j?.error ?? {}) as Record<string, unknown>;
    const nested = (err?.error ?? {}) as Record<string, unknown>;
    const message =
      (typeof err.message === 'string' && err.message) ||
      (typeof nested.message === 'string' && nested.message) ||
      trimmed;

    return {
      errorCode: typeof err.code === 'string' ? err.code : undefined,
      errorStatus: typeof err.status === 'string' ? err.status : undefined,
      errorMessage: message,
      errorDetails: err.details ?? nested.details,
    };
  } catch {
    return { errorMessage: trimmed };
  }
}

function logGeminiFailure(model: string, httpStatus: number, err: GeminiApiError): void {
  if (!__DEV__) return;
  console.warn('[ReceiptAI] Gemini failed', {
    model,
    httpStatus,
    errorCode: err.errorCode,
    errorStatus: err.errorStatus,
    errorMessage: err.errorMessage,
  });
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

// ── Parse JSON từ text (hỗ trợ cả trường hợp có markdown thừa) ──
function parseJSON(text: string): GeminiAnalysisResult {
  const trimmed = text.trim();
  // Trường hợp lý tưởng: JSON thuần
  try { return sanitize(JSON.parse(trimmed)); } catch { /* ignore */ }
  // Fallback: trích xuất {...} đầu tiên
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (match) {
    try { return sanitize(JSON.parse(match[0])); } catch { /* ignore */ }
  }
  throw new Error('Không thể đọc kết quả từ AI. Thử lại nhé!');
}

// ── Sleep helper ─────────────────────────────────────────────
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ============================================================
// PROVIDER 1: GROQ (nhanh nhất, ~1-2s)
// ============================================================
async function callGroq(base64: string, apiKey: string): Promise<GeminiAnalysisResult> {
  const mimeType = detectMimeType(base64);

  const body = JSON.stringify({
    model: GROQ_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_INSTRUCTION },
      {
        role: 'user',
        content: [
          { type: 'text', text: USER_SCAN_PROMPT },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 512,
    reasoning_effort: 'none',
    response_format: { type: 'json_object' },
  });

  let res: Response;
  try {
    res = await fetchWithTimeout(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new SkipProviderError('Groq timeout, thử Gemini...');
    }
    throw new Error('Không có kết nối Internet. Vui lòng kiểm tra lại Wifi/5G nhé! 🌐');
  }

  // Ảnh quá lớn (>4MB base64) → skip sang Gemini
  if (res.status === 413) {
    throw new SkipProviderError('Ảnh quá lớn cho Groq (>4MB), chuyển Gemini...');
  }

  // API Key sai → skip sang Gemini (nếu có); message giữ để debug
  if (res.status === 401 || res.status === 403) {
    throw new SkipProviderError('Groq API Key không hợp lệ (401/403)');
  }

  // Rate limit / overload → thử lại 1 lần, nếu vẫn lỗi thì skip
  if (res.status === 429 || res.status === 503) {
    await sleep(RETRY_DELAY);
    try {
      res = await fetchWithTimeout(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body,
      });
    } catch {
      throw new SkipProviderError('Groq rate limit, chuyển Gemini...');
    }
    if (!res.ok) throw new SkipProviderError('Groq vẫn rate limit, chuyển Gemini...');
  }

  if (!res.ok) {
    const msg = await readErrorMsg(res);
    // Các lỗi không phải lỗi key/ảnh → skip, thử Gemini
    throw new SkipProviderError(`Groq lỗi ${res.status}: ${msg}`);
  }

  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? '';

  if (!text) throw new SkipProviderError('Groq không trả về nội dung');

  return parseJSON(text);
}

// ============================================================
// PROVIDER 2 & 3: GEMINI (chính xác hơn với tiếng Việt)
// ============================================================
function buildGeminiBody(base64: string): string {
  return JSON.stringify({
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents: [{
      role: 'user',
      parts: [
        { inline_data: { mime_type: detectMimeType(base64), data: base64 } },
        { text: USER_SCAN_PROMPT },
      ],
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 256,
      responseMimeType: 'application/json',
      responseSchema: GEMINI_RESPONSE_SCHEMA,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
}

async function callGemini(
  base64: string,
  apiKey: string,
  model: string,
): Promise<GeminiAnalysisResult> {
  const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`;
  const body = buildGeminiBody(base64);

  let res: Response;
  try {
    res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new SkipProviderError(`${model} timeout`);
    }
    throw new Error('Không có kết nối mạng hoặc máy chủ không phản hồi.');
  }

  // Retry 1 lần nếu overloaded
  if (res.status === 503 || res.status === 429) {
    await sleep(RETRY_DELAY);
    try {
      res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
    } catch {
      throw new SkipProviderError(`${model} retry timeout`);
    }
  }

  if (!res.ok) {
    const geminiErr = await readGeminiApiError(res);
    logGeminiFailure(model, res.status, geminiErr);

    if (res.status === 401 || res.status === 403) {
      throw new Error('Gemini API Key không hợp lệ. Kiểm tra EXPO_PUBLIC_GEMINI_API_KEY trong .env nhé! 🔑');
    }

    const msg = geminiErr.errorMessage || `Gemini lỗi ${res.status}`;
    const shouldSkip =
      res.status === 404 || res.status === 429 || res.status === 503 ||
      msg.toLowerCase().includes('quota') ||
      msg.toLowerCase().includes('not found') ||
      msg.toLowerCase().includes('shut down');
    if (shouldSkip) throw new SkipProviderError(`${model}: ${msg}`);
    throw new Error(msg);
  }

  const data = await res.json();
  const candidate = data?.candidates?.[0];
  const finishReason: string = candidate?.finishReason ?? '';
  const text: string = candidate?.content?.parts?.[0]?.text ?? '';

  if (finishReason === 'SAFETY') {
    throw new Error('Ảnh bị bộ lọc an toàn của Gemini từ chối. Thử ảnh khác nhé!');
  }
  if (!text) {
    throw new SkipProviderError(`${model} không trả về text (${finishReason})`);
  }

  return parseJSON(text);
}

// ============================================================
// HOOK CHÍNH
// ============================================================

interface UseGeminiResult {
  analyze: (imageBase64: string) => Promise<GeminiAnalysisResult>;
  isLoading: boolean;
  error: string | null;
}

export function useGemini(): UseGeminiResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (imageBase64: string): Promise<GeminiAnalysisResult> => {
    const effectiveGeminiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim() || '';
    const effectiveGroqKey = process.env.EXPO_PUBLIC_GROQ_API_KEY?.trim() || '';

    if (!effectiveGroqKey && !effectiveGeminiKey) {
      throw new Error('Chưa cài đặt API Key. Thêm EXPO_PUBLIC_GROQ_API_KEY hoặc EXPO_PUBLIC_GEMINI_API_KEY vào .env nhé! 🔑');
    }

    setIsLoading(true);
    setError(null);

    try {
      // ── 1. Thử Groq trước (nhanh nhất) ──
      if (effectiveGroqKey) {
        try {
          const result = await callGroq(imageBase64, effectiveGroqKey);
          return result;
        } catch (err) {
          if (!(err instanceof SkipProviderError)) throw err;
        }
      }

      // ── 2 & 3. Thử Gemini (Lite → Flash) ──
      if (effectiveGeminiKey) {
        for (const model of GEMINI_MODELS) {
          try {
            const result = await callGemini(imageBase64, effectiveGeminiKey, model);
            return result;
          } catch (err) {
            if (!(err instanceof SkipProviderError)) throw err;
          }
        }
      }

      throw new Error('Tất cả provider AI đều bận hoặc hết quota. Thử lại sau nhé! 🔄');

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Có lỗi xảy ra khi phân tích ảnh';
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { analyze, isLoading, error };
}

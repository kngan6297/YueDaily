// ============================================================
// HOOK PHÂN TÍCH ẢNH AI - ĐA NHÀ CUNG CẤP
// Thứ tự thử: Groq (rất nhanh) → Gemini Lite → Gemini Flash
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useState } from 'react';
import type { GeminiAnalysisResult } from '../types';

export const STORAGE_KEY_GEMINI = 'yozakura_gemini_api_key';
export const STORAGE_KEY_GROQ   = 'yozakura_groq_api_key';

const TIMEOUT_MS  = 20_000;
const RETRY_DELAY = 3_500;

const GROQ_URL        = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL      = 'meta-llama/llama-4-scout-17b-16e-instruct';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// Thử Lite trước (nhanh hơn), Flash là safety net cuối cùng
const GEMINI_MODELS   = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'] as const;

// ── Sentinel: "provider này không dùng được, thử cái tiếp theo" ──
class SkipProviderError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'SkipProviderError';
  }
}

// ── System instruction (dùng chung cho tất cả provider) ──────
const SYSTEM_INSTRUCTION = `Bạn là trợ lý phân tích chi tiêu thông minh cho ứng dụng quản lý tài chính gia đình Việt Nam.

Nhiệm vụ: Phân tích ảnh và trả về thông tin giao dịch tài chính dưới dạng JSON.

Nếu đây là hoá đơn/bill/receipt:
- amount: tổng tiền thanh toán cuối (sau thuế, sau giảm giá), đơn vị VNĐ
- location: TÊN QUÁN / CỬA HÀNG ghi ở đầu bill (header). Ví dụ: "Cơm Tấm Bà Năm", "Circle K", "Trà Sữa Gong Cha". Nếu không rõ thì để rỗng.
- note: tên món ăn chính / sản phẩm / dịch vụ trong bill. KHÔNG lặp lại tên quán.
- category: danh mục phù hợp nhất
- type: "chi"

Nếu đây là ảnh món ăn / sản phẩm (không phải bill):
- location: để rỗng
- note: mô tả ngắn món ăn / sản phẩm
- category: danh mục phù hợp nhất
- type: "chi"

Danh mục hợp lệ (chỉ dùng đúng tên này):
"Ăn uống", "Trà & Cà phê", "Mua sắm", "Di chuyển", "Làm đẹp", "Sức khoẻ", "Giải trí", "Giáo dục", "Gia đình", "Thú cưng", "Khác"

Quy tắc bắt buộc:
- amount: số nguyên VNĐ (ví dụ 45000), 0 nếu không đọc được
- type: chỉ "chi" hoặc "thu"
- Nếu không chắc → dùng "Khác" và amount = 0
- Chỉ trả về JSON thuần, KHÔNG có text hay markdown xung quanh`;

// ── Gemini structured output schema ─────────────────────────
const GEMINI_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    amount:   { type: 'integer', description: 'Tổng tiền VNĐ, 0 nếu không đọc được' },
    location: { type: 'string',  description: 'Tên quán/cửa hàng ở đầu bill (header), rỗng nếu không có' },
    category: {
      type: 'string',
      enum: ['Ăn uống','Trà & Cà phê','Mua sắm','Di chuyển','Làm đẹp','Sức khoẻ','Giải trí','Giáo dục','Gia đình','Thú cưng','Khác'],
    },
    note: { type: 'string', description: 'Ghi chú ngắn, rỗng nếu không có' },
    type: { type: 'string', enum: ['chi', 'thu'] },
  },
  required: ['amount', 'location', 'category', 'note', 'type'],
} as const;

// ── Detect MIME type từ base64 header ────────────────────────
function detectMimeType(base64: string): string {
  const h = base64.slice(0, 8);
  if (h.startsWith('/9j/'))    return 'image/jpeg';
  if (h.startsWith('iVBOR'))   return 'image/png';
  if (h.startsWith('UklGR'))   return 'image/webp';
  if (h.startsWith('R0lGOD'))  return 'image/gif';
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

// ── Sanitize & validate result ───────────────────────────────
function sanitize(raw: unknown): GeminiAnalysisResult {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    amount:   typeof r.amount === 'number' && !isNaN(r.amount) ? Math.round(r.amount) : 0,
    location: typeof r.location === 'string' ? r.location : '',
    category: typeof r.category === 'string' ? r.category : 'Khác',
    note:     typeof r.note === 'string' ? r.note : '',
    type:     r.type === 'thu' ? 'thu' : 'chi',
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
          { type: 'text', text: 'Phân tích ảnh này. Trả về đúng JSON schema đã quy định.' },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 256,
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
    throw new SkipProviderError('Lỗi mạng khi gọi Groq');
  }

  // Ảnh quá lớn (>4MB base64) → skip sang Gemini
  if (res.status === 413) {
    throw new SkipProviderError('Ảnh quá lớn cho Groq (>4MB), chuyển Gemini...');
  }

  // API Key sai → lỗi nghiêm trọng (không thử provider khác)
  if (res.status === 401 || res.status === 403) {
    throw new Error('Groq API Key không hợp lệ. Kiểm tra lại trong Cài đặt! 🔑');
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
        { text: 'Phân tích ảnh này và trả về thông tin giao dịch.' },
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
  const url  = `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`;
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

  if (res.status === 401 || res.status === 403) {
    throw new Error('Gemini API Key không hợp lệ. Kiểm tra lại trong Cài đặt! 🔑');
  }

  if (res.status === 400) {
    throw new Error('Ảnh không hợp lệ hoặc quá lớn. Thử ảnh khác nhé!');
  }

  if (!res.ok) {
    const msg = await readErrorMsg(res);
    const shouldSkip =
      res.status === 404 || res.status === 429 || res.status === 503 ||
      msg.toLowerCase().includes('quota') ||
      msg.toLowerCase().includes('not found') ||
      msg.toLowerCase().includes('shut down');
    if (shouldSkip) throw new SkipProviderError(`${model}: ${msg}`);
    throw new Error(msg || `Gemini lỗi ${res.status}`);
  }

  const data       = await res.json();
  const candidate  = data?.candidates?.[0];
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
  const [error, setError]         = useState<string | null>(null);

  const analyze = useCallback(async (imageBase64: string): Promise<GeminiAnalysisResult> => {
    const [groqKey, geminiKey] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEY_GROQ).then((v) => v?.trim() || ''),
      AsyncStorage.getItem(STORAGE_KEY_GEMINI).then((v) => v?.trim() || ''),
    ]);

    // Fallback: đọc từ .env nếu chưa nhập trong Settings
    const effectiveGeminiKey = geminiKey || process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim() || '';
    const effectiveGroqKey   = groqKey   || process.env.EXPO_PUBLIC_GROQ_API_KEY?.trim()   || '';

    console.log('[AI] groqKey:', effectiveGroqKey ? `${effectiveGroqKey.slice(0, 8)}...` : 'EMPTY');
    console.log('[AI] geminiKey:', effectiveGeminiKey ? `${effectiveGeminiKey.slice(0, 8)}...` : 'EMPTY');

    if (!effectiveGroqKey && !effectiveGeminiKey) {
      throw new Error('Chưa cài đặt API Key. Thêm EXPO_PUBLIC_GROQ_API_KEY vào .env nhé! 🔑');
    }

    setIsLoading(true);
    setError(null);

    try {
      // ── 1. Thử Groq trước (nhanh nhất) ──
      if (effectiveGroqKey) {
        try {
          console.log('[AI] Thử Groq...');
          const result = await callGroq(imageBase64, effectiveGroqKey);
          console.log('[AI] Groq thành công:', result);
          return result;
        } catch (err) {
          if (!(err instanceof SkipProviderError)) throw err;
          console.log('[AI] Groq skip:', err.message);
        }
      }

      // ── 2 & 3. Thử Gemini (Lite → Flash) ──
      if (effectiveGeminiKey) {
        for (const model of GEMINI_MODELS) {
          try {
            console.log(`[AI] Thử ${model}...`);
            const result = await callGemini(imageBase64, effectiveGeminiKey, model);
            console.log(`[AI] ${model} thành công:`, result);
            return result;
          } catch (err) {
            if (!(err instanceof SkipProviderError)) throw err;
            console.log(`[AI] ${model} skip:`, err.message);
          }
        }
      }

      throw new Error('Tất cả provider AI đều bận hoặc hết quota. Thử lại sau nhé! 🔄');

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Có lỗi xảy ra khi phân tích ảnh';
      console.error('[AI] Lỗi cuối:', msg);
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { analyze, isLoading, error };
}

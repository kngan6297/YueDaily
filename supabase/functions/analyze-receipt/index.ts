// P2.3 — Authenticated receipt AI proxy (analyze only; never write transactions)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { analyzeReceiptImage } from "../_shared/receiptAi/analyzeReceiptImage.ts";
import { loadReceiptAiEnvFromDenoEnv } from "../_shared/receiptAi/env.ts";
import { ReceiptAiError } from "../_shared/receiptAi/errors.ts";
import {
  ANALYZE_RECEIPT_IMAGE_FIELD,
  EDGE_ERROR_AI_MALFORMED_RESPONSE,
  EDGE_ERROR_AI_UNAVAILABLE,
  EDGE_ERROR_IMAGE_TOO_LARGE,
  EDGE_ERROR_INTERNAL_ERROR,
  EDGE_ERROR_INVALID_IMAGE,
  EDGE_ERROR_RATE_LIMITED,
  EDGE_ERROR_UNAUTHENTICATED,
  type EdgeErrorCode,
} from "../_shared/receiptAi/edgeErrorCodes.ts";
import { corsHeaders, parseAllowedOrigins, resolveCorsOrigin } from "./cors.ts";

/** Match Web client MAX_PROCESSED_JPEG_BYTES. */
const MAX_IMAGE_BYTES = 1_500_000;

function jsonResponse(
  body: unknown,
  status: number,
  cors: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function errorResponse(
  code: EdgeErrorCode,
  status: number,
  cors: Record<string, string>,
  requestId: string,
): Response {
  return jsonResponse({ error: { code }, requestId }, status, cors);
}

function mapReceiptError(err: unknown): { code: EdgeErrorCode; status: number } {
  if (err instanceof ReceiptAiError) {
    switch (err.kind) {
      case "rate_limited":
      case "quota_or_billing":
        return { code: EDGE_ERROR_RATE_LIMITED, status: 429 };
      case "invalid_response":
        return { code: EDGE_ERROR_AI_MALFORMED_RESPONSE, status: 502 };
      case "image_load_failed":
      case "image_decode_failed":
      case "image_processing_failed":
        return { code: EDGE_ERROR_INVALID_IMAGE, status: 400 };
      case "missing_key":
      case "invalid_key":
      case "permission_denied":
      case "model_unavailable":
      case "server_error":
      case "network_error":
      case "timeout":
      case "all_providers_failed":
      default:
        return { code: EDGE_ERROR_AI_UNAVAILABLE, status: 503 };
    }
  }
  return { code: EDGE_ERROR_INTERNAL_ERROR, status: 500 };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function isJpegBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  const allowed = parseAllowedOrigins(Deno.env.get("WEB_ALLOWED_ORIGINS"));
  const origin = resolveCorsOrigin(req.headers.get("Origin"), allowed);
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    if (req.headers.get("Origin") && !origin) {
      return new Response(null, { status: 403, headers: cors });
    }
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return errorResponse(EDGE_ERROR_INTERNAL_ERROR, 405, cors, requestId);
  }

  if (req.headers.get("Origin") && !origin) {
    return errorResponse(EDGE_ERROR_UNAUTHENTICATED, 403, cors, requestId);
  }

  const started = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!supabaseUrl || !supabaseAnon || !authHeader) {
      return errorResponse(EDGE_ERROR_UNAUTHENTICATED, 401, cors, requestId);
    }

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return errorResponse(EDGE_ERROR_UNAUTHENTICATED, 401, cors, requestId);
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return errorResponse(EDGE_ERROR_INVALID_IMAGE, 400, cors, requestId);
    }

    const file = form.get(ANALYZE_RECEIPT_IMAGE_FIELD);
    if (!(file instanceof File)) {
      return errorResponse(EDGE_ERROR_INVALID_IMAGE, 400, cors, requestId);
    }

    const mime = (file.type || "").toLowerCase();
    if (mime && mime !== "image/jpeg" && mime !== "image/jpg") {
      // Client should send JPEG; reject unexpected MIME when present.
      if (!mime.startsWith("image/")) {
        return errorResponse(EDGE_ERROR_INVALID_IMAGE, 400, cors, requestId);
      }
    }

    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
      return errorResponse(EDGE_ERROR_IMAGE_TOO_LARGE, 413, cors, requestId);
    }

    const buffer = await file.arrayBuffer();
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      return errorResponse(EDGE_ERROR_IMAGE_TOO_LARGE, 413, cors, requestId);
    }

    const bytes = new Uint8Array(buffer);
    if (!isJpegBytes(bytes) && mime !== "image/jpeg" && mime !== "image/jpg") {
      // Allow if MIME says jpeg even when magic is odd; otherwise require JPEG magic.
      if (!mime.startsWith("image/jpeg") && !mime.startsWith("image/jpg")) {
        return errorResponse(EDGE_ERROR_INVALID_IMAGE, 400, cors, requestId);
      }
    }

    const base64 = arrayBufferToBase64(buffer);
    const env = loadReceiptAiEnvFromDenoEnv();
    if (!env.groqKey && !env.geminiKey) {
      console.log("[ReceiptAI] missing_secrets", { requestId });
      return errorResponse(EDGE_ERROR_AI_UNAVAILABLE, 503, cors, requestId);
    }

    const aiStarted = Date.now();
    const result = await analyzeReceiptImage(base64, env, {
      fetch: globalThis.fetch,
      dev: false,
    });
    const aiMs = Date.now() - aiStarted;

    console.log("[ReceiptAI] ok", {
      requestId,
      aiMs,
      totalMs: Date.now() - started,
      // no amount / description / image
    });

    return jsonResponse({ result, requestId }, 200, cors);
  } catch (err) {
    const mapped = mapReceiptError(err);
    console.log("[ReceiptAI] fail", {
      requestId,
      code: mapped.code,
      kind: err instanceof ReceiptAiError ? err.kind : "unknown",
      totalMs: Date.now() - started,
    });
    return errorResponse(mapped.code, mapped.status, cors, requestId);
  }
});

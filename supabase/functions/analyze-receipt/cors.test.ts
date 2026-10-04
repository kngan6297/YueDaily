// Note: not wired into npm test — Deno-oriented. Parity covered in Node tests.
import {
  parseAllowedOrigins,
  resolveCorsOrigin,
} from "./cors.ts";

Deno.test("parseAllowedOrigins rejects wildcard", () => {
  const origins = parseAllowedOrigins("http://localhost:8082,*,https://example.com");
  if (origins.includes("*")) throw new Error("wildcard not allowed");
  if (origins.length !== 2) throw new Error("expected 2 origins");
});

Deno.test("parseAllowedOrigins empty uses localhost DEV defaults", () => {
  const origins = parseAllowedOrigins(undefined);
  if (!origins.includes("http://localhost:8082")) {
    throw new Error("expected localhost:8082 default");
  }
});

Deno.test("resolveCorsOrigin exact match only", () => {
  const allowed = ["http://localhost:8082", "https://preview.example.app"];
  if (resolveCorsOrigin("http://localhost:8082", allowed) !== "http://localhost:8082") {
    throw new Error("localhost should match");
  }
  if (resolveCorsOrigin("https://evil.example", allowed) !== null) {
    throw new Error("unknown origin must be rejected");
  }
});

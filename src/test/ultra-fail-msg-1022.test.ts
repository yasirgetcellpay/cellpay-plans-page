import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { loadTextFrom } from "@/lib/loadTextPick";

// ULTRA-FAIL-MSG-1022: exercise the display classifier, not copy or markup.
for (const file of ["src/pages/Checkout.tsx", "src/pages/OrderConfirmation.tsx"]) {
  const source = readFileSync(file, "utf8");
  const start = source.indexOf("function ultraRefundKind(");
  const end = source.indexOf("\n}", start) + 2;
  const code = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const classify = new Function("loadTextFrom", `${code}; return ultraRefundKind;`)(loadTextFrom) as (value: unknown) => string | null;
  describe(file, () => {
    it("recognizes Invalid Amount in nested refill errors", () => {
      expect(classify({ data: { data: { LoadText: "Invalid Amount" } } })).toBe("amount");
    });
    it("recognizes numeric error code 1065", () => {
      expect(classify({ data: { error_code: 1065 } })).toBe("amount");
      expect(classify({ data: { error_code: 1066, message: "Another error" } })).toBeNull();
    });
    it("selects generic for blank errors", () => {
      expect(classify({ data: { message: "", load_text: "" } })).toBe("generic");
    });
    it("selects generic for error during refill", () => {
      expect(classify({ data: { message: "error during refill" } })).toBe("generic");
    });
    it("preserves other specific errors despite the generic wrapper", () => {
      expect(classify({ message: "error during refill", data: { LoadText: "Resource not found" } })).toBeNull();
      expect(classify({ data: { message: "Invalid phone number" } })).toBeNull();
    });
  });
}
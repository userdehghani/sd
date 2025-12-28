/**
 * Result Monad Tests
 */

import { describe, it, expect } from "bun:test";
import {
  ok,
  err,
  isOk,
  isErr,
  fromNullable,
  tryCatch,
  combine,
} from "../../../src/core/types/result";

describe("Result Monad", () => {
  describe("ok", () => {
    it("should create an Ok result", () => {
      const result = ok(42);
      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);
      expect(result.value).toBe(42);
    });
  });

  describe("err", () => {
    it("should create an Err result", () => {
      const result = err("error");
      expect(result.isOk()).toBe(false);
      expect(result.isErr()).toBe(true);
      expect(result.error).toBe("error");
    });
  });

  describe("map", () => {
    it("should map Ok values", () => {
      const result = ok(5).map((x) => x * 2);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(10);
      }
    });

    it("should not map Err values", () => {
      const result = err<number, string>("error").map((x) => x * 2);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBe("error");
      }
    });
  });

  describe("flatMap", () => {
    it("should flatMap Ok values", () => {
      const result = ok(5).flatMap((x) => ok(x * 2));
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(10);
      }
    });

    it("should handle flatMap returning Err", () => {
      const result = ok(5).flatMap(() => err("failed"));
      expect(result.isErr()).toBe(true);
    });
  });

  describe("match", () => {
    it("should match Ok", () => {
      const result = ok(5).match({
        ok: (v) => `value: ${v}`,
        err: (e) => `error: ${e}`,
      });
      expect(result).toBe("value: 5");
    });

    it("should match Err", () => {
      const result = err<number, string>("oops").match({
        ok: (v) => `value: ${v}`,
        err: (e) => `error: ${e}`,
      });
      expect(result).toBe("error: oops");
    });
  });

  describe("unwrap", () => {
    it("should unwrap Ok values", () => {
      expect(ok(42).unwrap()).toBe(42);
    });

    it("should throw on Err unwrap", () => {
      expect(() => err("error").unwrap()).toThrow();
    });
  });

  describe("unwrapOr", () => {
    it("should return value for Ok", () => {
      expect(ok(42).unwrapOr(0)).toBe(42);
    });

    it("should return default for Err", () => {
      expect(err<number, string>("error").unwrapOr(0)).toBe(0);
    });
  });

  describe("fromNullable", () => {
    it("should return Ok for non-null values", () => {
      const result = fromNullable(42, "null");
      expect(result.isOk()).toBe(true);
    });

    it("should return Err for null", () => {
      const result = fromNullable(null, "null");
      expect(result.isErr()).toBe(true);
    });

    it("should return Err for undefined", () => {
      const result = fromNullable(undefined, "undefined");
      expect(result.isErr()).toBe(true);
    });
  });

  describe("tryCatch", () => {
    it("should return Ok for successful function", () => {
      const result = tryCatch(() => 42);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(42);
      }
    });

    it("should return Err for throwing function", () => {
      const result = tryCatch(() => {
        throw new Error("oops");
      });
      expect(result.isErr()).toBe(true);
    });
  });

  describe("combine", () => {
    it("should combine all Ok results", () => {
      const results = [ok(1), ok(2), ok(3)];
      const combined = combine(results);
      expect(combined.isOk()).toBe(true);
      if (combined.isOk()) {
        expect(combined.value).toEqual([1, 2, 3]);
      }
    });

    it("should return first Err", () => {
      const results = [ok(1), err("error"), ok(3)];
      const combined = combine(results);
      expect(combined.isErr()).toBe(true);
    });
  });

  describe("type guards", () => {
    it("isOk should identify Ok results", () => {
      expect(isOk(ok(42))).toBe(true);
      expect(isOk(err("error"))).toBe(false);
    });

    it("isErr should identify Err results", () => {
      expect(isErr(err("error"))).toBe(true);
      expect(isErr(ok(42))).toBe(false);
    });
  });
});

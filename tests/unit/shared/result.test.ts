/**
 * Unit Tests for Result Type
 */

import { describe, it, expect } from "bun:test";
import {
  Ok,
  Err,
  map,
  mapError,
  flatMap,
  unwrap,
  unwrapOr,
  isOk,
  isErr,
} from "../../../src/shared/result";

describe("Result Type", () => {
  describe("Ok", () => {
    it("should create a successful result", () => {
      const result = Ok(42);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe(42);
      }
    });
  });

  describe("Err", () => {
    it("should create an error result", () => {
      const result = Err(new Error("Something went wrong"));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe("Something went wrong");
      }
    });
  });

  describe("map", () => {
    it("should transform the value of a successful result", () => {
      const result = Ok(10);
      const mapped = map(result, (x) => x * 2);

      expect(mapped.success).toBe(true);
      if (mapped.success) {
        expect(mapped.value).toBe(20);
      }
    });

    it("should pass through an error result unchanged", () => {
      const result = Err(new Error("Error"));
      const mapped = map(result, (x: number) => x * 2);

      expect(mapped.success).toBe(false);
      if (!mapped.success) {
        expect(mapped.error.message).toBe("Error");
      }
    });
  });

  describe("mapError", () => {
    it("should transform the error of a failed result", () => {
      const result = Err(new Error("Original error"));
      const mapped = mapError(result, (e) => new Error(`Mapped: ${e.message}`));

      expect(mapped.success).toBe(false);
      if (!mapped.success) {
        expect(mapped.error.message).toBe("Mapped: Original error");
      }
    });

    it("should pass through a successful result unchanged", () => {
      const result = Ok(42);
      const mapped = mapError(result, (e: Error) => new Error("Never called"));

      expect(mapped.success).toBe(true);
      if (mapped.success) {
        expect(mapped.value).toBe(42);
      }
    });
  });

  describe("flatMap", () => {
    it("should chain successful results", () => {
      const result = Ok(10);
      const chained = flatMap(result, (x) => Ok(x * 2));

      expect(chained.success).toBe(true);
      if (chained.success) {
        expect(chained.value).toBe(20);
      }
    });

    it("should short-circuit on error", () => {
      const result = Ok(10);
      const chained = flatMap(result, () => Err(new Error("Chain error")));

      expect(chained.success).toBe(false);
      if (!chained.success) {
        expect(chained.error.message).toBe("Chain error");
      }
    });

    it("should not call fn if result is already an error", () => {
      const result = Err(new Error("Original error"));
      let called = false;
      const chained = flatMap(result, () => {
        called = true;
        return Ok(42);
      });

      expect(called).toBe(false);
      expect(chained.success).toBe(false);
    });
  });

  describe("unwrap", () => {
    it("should return value from successful result", () => {
      const result = Ok(42);
      const value = unwrap(result);

      expect(value).toBe(42);
    });

    it("should throw error from failed result", () => {
      const result = Err(new Error("Test error"));

      expect(() => unwrap(result)).toThrow("Test error");
    });
  });

  describe("unwrapOr", () => {
    it("should return value from successful result", () => {
      const result = Ok(42);
      const value = unwrapOr(result, 0);

      expect(value).toBe(42);
    });

    it("should return default value from failed result", () => {
      const result = Err(new Error("Error"));
      const value = unwrapOr(result, 0);

      expect(value).toBe(0);
    });
  });

  describe("isOk", () => {
    it("should return true for successful result", () => {
      const result = Ok(42);
      expect(isOk(result)).toBe(true);
    });

    it("should return false for error result", () => {
      const result = Err(new Error("Error"));
      expect(isOk(result)).toBe(false);
    });
  });

  describe("isErr", () => {
    it("should return false for successful result", () => {
      const result = Ok(42);
      expect(isErr(result)).toBe(false);
    });

    it("should return true for error result", () => {
      const result = Err(new Error("Error"));
      expect(isErr(result)).toBe(true);
    });
  });
});

/**
 * User Value Objects Tests
 */

import { describe, it, expect } from "bun:test";
import {
  createEmail,
  verifyEmail,
  createPhone,
  verifyPhone,
  createName,
  createAvatar,
} from "../../../../src/domain/user/value-objects";

describe("User Value Objects", () => {
  describe("Email", () => {
    it("should create valid email", () => {
      const result = createEmail("test@example.com");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.value).toBe("test@example.com");
        expect(result.value.isVerified).toBe(false);
      }
    });

    it("should normalize email to lowercase", () => {
      const result = createEmail("TEST@EXAMPLE.COM");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.value).toBe("test@example.com");
      }
    });

    it("should reject invalid email", () => {
      const result = createEmail("invalid-email");
      expect(result.isErr()).toBe(true);
    });

    it("should verify email", () => {
      const emailResult = createEmail("test@example.com");
      expect(emailResult.isOk()).toBe(true);
      if (emailResult.isOk()) {
        const verified = verifyEmail(emailResult.value);
        expect(verified.isVerified).toBe(true);
        expect(verified.verifiedAt).toBeInstanceOf(Date);
      }
    });
  });

  describe("Phone", () => {
    it("should create valid phone", () => {
      const result = createPhone("+989123456789");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.value).toBe("+989123456789");
        expect(result.value.isVerified).toBe(false);
      }
    });

    it("should normalize phone by removing spaces", () => {
      const result = createPhone("+98 912 345 6789");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.value).toBe("+989123456789");
      }
    });

    it("should reject invalid phone", () => {
      const result = createPhone("123");
      expect(result.isErr()).toBe(true);
    });

    it("should verify phone", () => {
      const phoneResult = createPhone("+989123456789");
      expect(phoneResult.isOk()).toBe(true);
      if (phoneResult.isOk()) {
        const verified = verifyPhone(phoneResult.value);
        expect(verified.isVerified).toBe(true);
        expect(verified.verifiedAt).toBeInstanceOf(Date);
      }
    });
  });

  describe("Name", () => {
    it("should create valid name", () => {
      const result = createName("John", "Doe");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.firstName).toBe("John");
        expect(result.value.lastName).toBe("Doe");
        expect(result.value.displayName).toBe("John Doe");
      }
    });

    it("should use custom display name", () => {
      const result = createName("John", "Doe", "Johnny");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.displayName).toBe("Johnny");
      }
    });

    it("should trim whitespace", () => {
      const result = createName("  John  ", "  Doe  ");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.firstName).toBe("John");
        expect(result.value.lastName).toBe("Doe");
      }
    });

    it("should reject empty first name", () => {
      const result = createName("", "Doe");
      expect(result.isErr()).toBe(true);
    });

    it("should reject empty last name", () => {
      const result = createName("John", "");
      expect(result.isErr()).toBe(true);
    });
  });

  describe("Avatar", () => {
    it("should create valid avatar", () => {
      const result = createAvatar(
        "https://example.com/avatar.jpg",
        "avatars/123/avatar.jpg",
        1024,
        "image/jpeg"
      );
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.url).toBe("https://example.com/avatar.jpg");
        expect(result.value.key).toBe("avatars/123/avatar.jpg");
        expect(result.value.size).toBe(1024);
        expect(result.value.mimeType).toBe("image/jpeg");
      }
    });

    it("should reject invalid mime type", () => {
      const result = createAvatar(
        "https://example.com/file.pdf",
        "files/123/file.pdf",
        1024,
        "application/pdf"
      );
      expect(result.isErr()).toBe(true);
    });

    it("should reject file too large", () => {
      const result = createAvatar(
        "https://example.com/avatar.jpg",
        "avatars/123/avatar.jpg",
        10 * 1024 * 1024, // 10MB
        "image/jpeg"
      );
      expect(result.isErr()).toBe(true);
    });
  });
});

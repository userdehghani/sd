/**
 * Unit Tests for User Entity
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { User } from "../../../../src/domain/entities/user.entity";
import { Email } from "../../../../src/domain/value-objects/email.vo";
import { Phone } from "../../../../src/domain/value-objects/phone.vo";
import { AuthProvider } from "../../../../src/shared/types";

describe("User Entity", () => {
  let validEmail: Email;
  let validPhone: Phone;

  beforeEach(() => {
    const emailResult = Email.create("test@example.com");
    if (emailResult.success) {
      validEmail = emailResult.value;
    }

    const phoneResult = Phone.create("+989123456789");
    if (phoneResult.success) {
      validPhone = phoneResult.value;
    }
  });

  describe("create", () => {
    it("should create a new user with valid data", () => {
      const user = User.create({
        email: validEmail,
        firstName: "John",
        lastName: "Doe",
        isEmailVerified: false,
        isPhoneVerified: false,
        authProviders: [AuthProvider.TOTP],
      });

      expect(user).toBeDefined();
      expect(user.email.getValue()).toBe("test@example.com");
      expect(user.firstName).toBe("John");
      expect(user.lastName).toBe("Doe");
      expect(user.fullName).toBe("John Doe");
      expect(user.isEmailVerified).toBe(false);
      expect(user.authProviders).toContain(AuthProvider.TOTP);
    });

    it("should generate a unique ID for new users", () => {
      const user1 = User.create({
        email: validEmail,
        isEmailVerified: false,
        isPhoneVerified: false,
        authProviders: [AuthProvider.TOTP],
      });

      const user2 = User.create({
        email: validEmail,
        isEmailVerified: false,
        isPhoneVerified: false,
        authProviders: [AuthProvider.TOTP],
      });

      expect(user1.id.getValue()).not.toBe(user2.id.getValue());
    });
  });

  describe("updateProfile", () => {
    it("should update user profile data", () => {
      const user = User.create({
        email: validEmail,
        firstName: "John",
        lastName: "Doe",
        isEmailVerified: false,
        isPhoneVerified: false,
        authProviders: [AuthProvider.TOTP],
      });

      user.updateProfile({
        firstName: "Jane",
        lastName: "Smith",
      });

      expect(user.firstName).toBe("Jane");
      expect(user.lastName).toBe("Smith");
      expect(user.fullName).toBe("Jane Smith");
    });

    it("should update timestamp when profile is updated", () => {
      const user = User.create({
        email: validEmail,
        isEmailVerified: false,
        isPhoneVerified: false,
        authProviders: [AuthProvider.TOTP],
      });

      const originalUpdatedAt = user.updatedAt;

      // Wait a bit
      setTimeout(() => {
        user.updateProfile({ firstName: "Jane" });
        expect(user.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
      }, 10);
    });
  });

  describe("verifyEmail", () => {
    it("should mark email as verified", () => {
      const user = User.create({
        email: validEmail,
        isEmailVerified: false,
        isPhoneVerified: false,
        authProviders: [AuthProvider.TOTP],
      });

      expect(user.isEmailVerified).toBe(false);

      user.verifyEmail();

      expect(user.isEmailVerified).toBe(true);
    });
  });

  describe("verifyPhone", () => {
    it("should mark phone as verified", () => {
      const user = User.create({
        email: validEmail,
        phone: validPhone,
        isEmailVerified: false,
        isPhoneVerified: false,
        authProviders: [AuthProvider.TOTP],
      });

      expect(user.isPhoneVerified).toBe(false);

      user.verifyPhone();

      expect(user.isPhoneVerified).toBe(true);
    });
  });

  describe("addAuthProvider", () => {
    it("should add a new auth provider", () => {
      const user = User.create({
        email: validEmail,
        isEmailVerified: false,
        isPhoneVerified: false,
        authProviders: [AuthProvider.TOTP],
      });

      expect(user.hasAuthProvider(AuthProvider.GOOGLE)).toBe(false);

      user.addAuthProvider(AuthProvider.GOOGLE);

      expect(user.hasAuthProvider(AuthProvider.GOOGLE)).toBe(true);
    });

    it("should not add duplicate auth providers", () => {
      const user = User.create({
        email: validEmail,
        isEmailVerified: false,
        isPhoneVerified: false,
        authProviders: [AuthProvider.TOTP],
      });

      user.addAuthProvider(AuthProvider.TOTP);

      const providers = user.authProviders;
      const totpCount = providers.filter((p) => p === AuthProvider.TOTP).length;

      expect(totpCount).toBe(1);
    });
  });

  describe("toJSON", () => {
    it("should serialize user to JSON", () => {
      const user = User.create({
        email: validEmail,
        firstName: "John",
        lastName: "Doe",
        isEmailVerified: true,
        isPhoneVerified: false,
        authProviders: [AuthProvider.TOTP],
      });

      const json = user.toJSON();

      expect(json.email).toBe("test@example.com");
      expect(json.firstName).toBe("John");
      expect(json.lastName).toBe("Doe");
      expect(json.fullName).toBe("John Doe");
      expect(json.isEmailVerified).toBe(true);
      expect(json.authProviders).toContain(AuthProvider.TOTP);
    });
  });
});

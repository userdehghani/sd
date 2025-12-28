/**
 * User Entity Tests
 */

import { describe, it, expect } from "bun:test";
import {
  createUser,
  updateUserName,
  updateUserStatus,
  addAuthProvider,
  enableTotp,
  disableTotp,
  recordLogin,
  toProfile,
} from "../../../../src/domain/user/entity";
import {
  createEmail,
  createName,
  createAuthProvider,
} from "../../../../src/domain/user/value-objects";
import type { UUID } from "../../../../src/core";

describe("User Entity", () => {
  const createTestUser = () => {
    const emailResult = createEmail("test@example.com", true, new Date());
    const nameResult = createName("John", "Doe");

    if (emailResult.isErr() || nameResult.isErr()) {
      throw new Error("Failed to create test data");
    }

    return createUser({
      id: "test-id" as UUID,
      email: emailResult.value,
      name: nameResult.value,
    });
  };

  describe("createUser", () => {
    it("should create user with default values", () => {
      const user = createTestUser();

      expect(user.id).toBe("test-id");
      expect(user.email.value).toBe("test@example.com");
      expect(user.name.firstName).toBe("John");
      expect(user.status).toBe("active");
      expect(user.role).toBe("user");
      expect(user.authProviders).toHaveLength(0);
      expect(user.passkeyCredentials).toHaveLength(0);
      expect(user.totpEnabled).toBe(false);
    });

    it("should create user with auth provider", () => {
      const emailResult = createEmail("test@example.com");
      const nameResult = createName("John", "Doe");

      if (emailResult.isErr() || nameResult.isErr()) {
        throw new Error("Failed to create test data");
      }

      const authProvider = createAuthProvider("google", "google-id-123");

      const user = createUser({
        id: "test-id" as UUID,
        email: emailResult.value,
        name: nameResult.value,
        authProvider,
      });

      expect(user.authProviders).toHaveLength(1);
      expect(user.authProviders[0].type).toBe("google");
    });
  });

  describe("updateUserName", () => {
    it("should update user name", () => {
      const user = createTestUser();
      const newNameResult = createName("Jane", "Smith", "Janey");

      if (newNameResult.isErr()) {
        throw new Error("Failed to create name");
      }

      const updated = updateUserName(user, newNameResult.value);

      expect(updated.name.firstName).toBe("Jane");
      expect(updated.name.lastName).toBe("Smith");
      expect(updated.name.displayName).toBe("Janey");
      expect(updated.updatedAt.getTime()).toBeGreaterThan(user.updatedAt.getTime() - 1000);
    });
  });

  describe("updateUserStatus", () => {
    it("should update user status", () => {
      const user = createTestUser();
      const updated = updateUserStatus(user, "suspended");

      expect(updated.status).toBe("suspended");
    });
  });

  describe("addAuthProvider", () => {
    it("should add auth provider", () => {
      const user = createTestUser();
      const provider = createAuthProvider("apple", "apple-id-456");
      const updated = addAuthProvider(user, provider);

      expect(updated.authProviders).toHaveLength(1);
      expect(updated.authProviders[0].type).toBe("apple");
      expect(updated.authProviders[0].providerId).toBe("apple-id-456");
    });
  });

  describe("TOTP", () => {
    it("should enable TOTP", () => {
      const user = createTestUser();
      const updated = enableTotp(user, "SECRET123");

      expect(updated.totpEnabled).toBe(true);
      expect(updated.totpSecret).toBe("SECRET123");
    });

    it("should disable TOTP", () => {
      const user = createTestUser();
      const withTotp = enableTotp(user, "SECRET123");
      const updated = disableTotp(withTotp);

      expect(updated.totpEnabled).toBe(false);
      expect(updated.totpSecret).toBeUndefined();
    });
  });

  describe("recordLogin", () => {
    it("should record last login", () => {
      const user = createTestUser();
      const updated = recordLogin(user);

      expect(updated.lastLoginAt).toBeInstanceOf(Date);
    });
  });

  describe("toProfile", () => {
    it("should convert user to profile", () => {
      const user = createTestUser();
      const profile = toProfile(user);

      expect(profile.id).toBe(user.id);
      expect(profile.email).toBe(user.email.value);
      expect(profile.emailVerified).toBe(user.email.isVerified);
      expect(profile.firstName).toBe(user.name.firstName);
      expect(profile.lastName).toBe(user.name.lastName);
      expect(profile.role).toBe(user.role);
    });
  });
});

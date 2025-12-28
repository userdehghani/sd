/**
 * Integration Tests for User Repository
 * Note: Requires a test database connection
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { Pool } from "pg";
import { UserRepositoryImpl } from "../../../src/infrastructure/repositories/user.repository.impl";
import { User } from "../../../src/domain/entities/user.entity";
import { Email } from "../../../src/domain/value-objects/email.vo";
import { AuthProvider } from "../../../src/shared/types";

describe("UserRepository Integration Tests", () => {
  let pool: Pool;
  let repository: UserRepositoryImpl;

  beforeAll(async () => {
    // Connect to test database
    pool = new Pool({
      host: process.env.TEST_DATABASE_HOST || "localhost",
      port: parseInt(process.env.TEST_DATABASE_PORT || "5432"),
      database: process.env.TEST_DATABASE_NAME || "myapp_test",
      user: process.env.TEST_DATABASE_USER || "postgres",
      password: process.env.TEST_DATABASE_PASSWORD || "postgres",
    });

    repository = new UserRepositoryImpl(pool);

    // Create tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20) UNIQUE,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        avatar_url TEXT,
        is_email_verified BOOLEAN DEFAULT FALSE,
        is_phone_verified BOOLEAN DEFAULT FALSE,
        auth_providers TEXT[] NOT NULL DEFAULT '{}',
        totp_secret TEXT,
        passkey_credential TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    // Clean up before each test
    await pool.query("DELETE FROM users");
  });

  describe("save", () => {
    it("should save a new user to database", async () => {
      const emailResult = Email.create("test@example.com");
      if (!emailResult.success) throw new Error("Invalid email");

      const user = User.create({
        email: emailResult.value,
        firstName: "John",
        lastName: "Doe",
        isEmailVerified: false,
        isPhoneVerified: false,
        authProviders: [AuthProvider.TOTP],
      });

      const result = await repository.save(user);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.email.getValue()).toBe("test@example.com");
        expect(result.value.firstName).toBe("John");
      }
    });
  });

  describe("findByEmail", () => {
    it("should find user by email", async () => {
      const emailResult = Email.create("find@example.com");
      if (!emailResult.success) throw new Error("Invalid email");

      const user = User.create({
        email: emailResult.value,
        firstName: "Jane",
        isEmailVerified: false,
        isPhoneVerified: false,
        authProviders: [AuthProvider.TOTP],
      });

      await repository.save(user);

      const result = await repository.findByEmail(emailResult.value);

      expect(result.success).toBe(true);
      if (result.success && result.value) {
        expect(result.value.email.getValue()).toBe("find@example.com");
        expect(result.value.firstName).toBe("Jane");
      }
    });

    it("should return null for non-existent email", async () => {
      const emailResult = Email.create("notfound@example.com");
      if (!emailResult.success) throw new Error("Invalid email");

      const result = await repository.findByEmail(emailResult.value);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBeNull();
      }
    });
  });

  describe("exists", () => {
    it("should return true for existing email", async () => {
      const emailResult = Email.create("exists@example.com");
      if (!emailResult.success) throw new Error("Invalid email");

      const user = User.create({
        email: emailResult.value,
        isEmailVerified: false,
        isPhoneVerified: false,
        authProviders: [AuthProvider.TOTP],
      });

      await repository.save(user);

      const result = await repository.exists(emailResult.value);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe(true);
      }
    });

    it("should return false for non-existent email", async () => {
      const emailResult = Email.create("notexists@example.com");
      if (!emailResult.success) throw new Error("Invalid email");

      const result = await repository.exists(emailResult.value);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe(false);
      }
    });
  });
});

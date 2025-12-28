/**
 * Test Setup
 * Global test configuration and utilities
 */

import { beforeAll, afterAll, afterEach } from "bun:test";

// ============================================
// Test Environment Setup
// ============================================

beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = "test";
  process.env.LOG_LEVEL = "ERROR";
  process.env.JWT_SECRET = "test-secret-key";
  process.env.DB_HOST = "localhost";
  process.env.REDIS_HOST = "localhost";
});

afterAll(() => {
  // Cleanup after all tests
});

afterEach(() => {
  // Cleanup after each test
});

// ============================================
// Test Utilities
// ============================================

export const createMockLogger = () => ({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
});

export const createMockCache = () => {
  const store = new Map<string, { value: string; expiresAt?: number }>();

  return {
    async get<T>(key: string) {
      const data = store.get(key);
      if (!data) return { _tag: "Ok" as const, value: null, isOk: () => true, isErr: () => false };
      if (data.expiresAt && data.expiresAt < Date.now()) {
        store.delete(key);
        return { _tag: "Ok" as const, value: null, isOk: () => true, isErr: () => false };
      }
      return { _tag: "Ok" as const, value: JSON.parse(data.value) as T, isOk: () => true, isErr: () => false };
    },
    async set<T>(key: string, value: T, ttl?: number) {
      const expiresAt = ttl ? Date.now() + ttl * 1000 : undefined;
      store.set(key, { value: JSON.stringify(value), expiresAt });
      return { _tag: "Ok" as const, value: undefined, isOk: () => true, isErr: () => false };
    },
    async delete(key: string) {
      store.delete(key);
      return { _tag: "Ok" as const, value: undefined, isOk: () => true, isErr: () => false };
    },
    async exists(key: string) {
      return { _tag: "Ok" as const, value: store.has(key), isOk: () => true, isErr: () => false };
    },
    clear() {
      store.clear();
    },
  };
};

// ============================================
// Test Data Factories
// ============================================

export const createTestUser = (overrides = {}) => ({
  id: "test-user-id",
  email: {
    value: "test@example.com",
    isVerified: true,
    verifiedAt: new Date(),
  },
  name: {
    firstName: "Test",
    lastName: "User",
    displayName: "Test User",
  },
  status: "active" as const,
  role: "user" as const,
  authProviders: [],
  passkeyCredentials: [],
  totpEnabled: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createTestSession = (overrides = {}) => ({
  id: "test-session-id",
  userId: "test-user-id",
  status: "active" as const,
  deviceInfo: {
    userAgent: "Test/1.0",
    ip: "127.0.0.1",
  },
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  lastActivityAt: new Date(),
  ...overrides,
});

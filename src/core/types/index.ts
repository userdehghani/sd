/**
 * Core Types - Shared Kernel
 */

export * from "./result";
export * from "./errors";

// ============================================
// Common Types
// ============================================

export type UUID = string & { readonly __brand: unique symbol };

export type Email = string & { readonly __brand: unique symbol };

export type Phone = string & { readonly __brand: unique symbol };

export type JWT = string & { readonly __brand: unique symbol };

export type Timestamp = number;

export type ISODateString = string;

// ============================================
// Pagination Types
// ============================================

export interface PaginationParams {
  readonly page: number;
  readonly limit: number;
}

export interface PaginatedResult<T> {
  readonly items: T[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
  readonly hasNext: boolean;
  readonly hasPrev: boolean;
}

// ============================================
// Command and Query Types (CQRS pattern support)
// ============================================

export interface Command<TPayload = unknown, TResult = unknown> {
  readonly type: string;
  readonly payload: TPayload;
  readonly metadata: CommandMetadata;
}

export interface CommandMetadata {
  readonly correlationId: string;
  readonly userId?: string;
  readonly timestamp: ISODateString;
  readonly traceId?: string;
}

export interface Query<TParams = unknown, TResult = unknown> {
  readonly type: string;
  readonly params: TParams;
  readonly metadata: QueryMetadata;
}

export interface QueryMetadata {
  readonly correlationId: string;
  readonly userId?: string;
  readonly timestamp: ISODateString;
  readonly traceId?: string;
}

// ============================================
// Event Types (Event Sourcing support)
// ============================================

export interface DomainEvent<TPayload = unknown> {
  readonly id: string;
  readonly type: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly payload: TPayload;
  readonly metadata: EventMetadata;
  readonly occurredAt: ISODateString;
  readonly version: number;
}

export interface EventMetadata {
  readonly correlationId: string;
  readonly causationId?: string;
  readonly userId?: string;
  readonly traceId?: string;
}

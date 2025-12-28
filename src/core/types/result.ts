/**
 * Result Monad for functional error handling
 * Inspired by Rust's Result<T, E> and fp-ts Either
 */

export type Result<T, E> = Ok<T, E> | Err<T, E>;

export class Ok<T, E> {
  readonly _tag = "Ok" as const;
  constructor(readonly value: T) {}

  isOk(): this is Ok<T, E> {
    return true;
  }

  isErr(): this is Err<T, E> {
    return false;
  }

  map<U>(fn: (value: T) => U): Result<U, E> {
    return ok(fn(this.value));
  }

  mapErr<F>(_fn: (error: E) => F): Result<T, F> {
    return ok(this.value);
  }

  flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return fn(this.value);
  }

  unwrap(): T {
    return this.value;
  }

  unwrapOr(_defaultValue: T): T {
    return this.value;
  }

  unwrapErr(): never {
    throw new Error("Called unwrapErr on Ok value");
  }

  match<U>(handlers: { ok: (value: T) => U; err: (error: E) => U }): U {
    return handlers.ok(this.value);
  }
}

export class Err<T, E> {
  readonly _tag = "Err" as const;
  constructor(readonly error: E) {}

  isOk(): this is Ok<T, E> {
    return false;
  }

  isErr(): this is Err<T, E> {
    return true;
  }

  map<U>(_fn: (value: T) => U): Result<U, E> {
    return err(this.error);
  }

  mapErr<F>(fn: (error: E) => F): Result<T, F> {
    return err(fn(this.error));
  }

  flatMap<U>(_fn: (value: T) => Result<U, E>): Result<U, E> {
    return err(this.error);
  }

  unwrap(): never {
    throw new Error(`Called unwrap on Err value: ${String(this.error)}`);
  }

  unwrapOr(defaultValue: T): T {
    return defaultValue;
  }

  unwrapErr(): E {
    return this.error;
  }

  match<U>(handlers: { ok: (value: T) => U; err: (error: E) => U }): U {
    return handlers.err(this.error);
  }
}

// Constructors
export const ok = <T, E = never>(value: T): Result<T, E> => new Ok(value);
export const err = <T = never, E = unknown>(error: E): Result<T, E> => new Err(error);

// Utility functions
export const fromNullable = <T, E>(
  value: T | null | undefined,
  error: E
): Result<T, E> => (value != null ? ok(value) : err(error));

export const fromPromise = async <T, E = Error>(
  promise: Promise<T>,
  mapError?: (e: unknown) => E
): Promise<Result<T, E>> => {
  try {
    const value = await promise;
    return ok(value);
  } catch (e) {
    return err(mapError ? mapError(e) : (e as E));
  }
};

export const tryCatch = <T, E = Error>(
  fn: () => T,
  mapError?: (e: unknown) => E
): Result<T, E> => {
  try {
    return ok(fn());
  } catch (e) {
    return err(mapError ? mapError(e) : (e as E));
  }
};

// Combine multiple Results
export const combine = <T, E>(results: Result<T, E>[]): Result<T[], E> => {
  const values: T[] = [];
  for (const result of results) {
    if (result.isErr()) {
      return err(result.error);
    }
    values.push(result.value);
  }
  return ok(values);
};

// Type guards
export const isOk = <T, E>(result: Result<T, E>): result is Ok<T, E> =>
  result._tag === "Ok";

export const isErr = <T, E>(result: Result<T, E>): result is Err<T, E> =>
  result._tag === "Err";

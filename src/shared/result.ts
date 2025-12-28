/**
 * Result type for functional error handling
 * Eliminates the need for try-catch blocks and provides type-safe error handling
 */

export type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

export const Ok = <T>(value: T): Result<T, never> => ({
  success: true,
  value,
});

export const Err = <E>(error: E): Result<never, E> => ({
  success: false,
  error,
});

/**
 * Async Result type for asynchronous operations
 */
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

/**
 * Map the value of a Result if it's Ok
 */
export const map = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> => {
  return result.success ? Ok(fn(result.value)) : result;
};

/**
 * Map the error of a Result if it's Err
 */
export const mapError = <T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> => {
  return result.success ? result : Err(fn(result.error));
};

/**
 * Chain multiple Result operations
 */
export const flatMap = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> => {
  return result.success ? fn(result.value) : result;
};

/**
 * Async version of flatMap
 */
export const flatMapAsync = async <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => AsyncResult<U, E>
): AsyncResult<U, E> => {
  return result.success ? fn(result.value) : result;
};

/**
 * Unwrap a Result or throw an error
 */
export const unwrap = <T, E>(result: Result<T, E>): T => {
  if (result.success) {
    return result.value;
  }
  throw result.error;
};

/**
 * Unwrap a Result or return a default value
 */
export const unwrapOr = <T, E>(result: Result<T, E>, defaultValue: T): T => {
  return result.success ? result.value : defaultValue;
};

/**
 * Check if a Result is Ok
 */
export const isOk = <T, E>(result: Result<T, E>): result is { success: true; value: T } => {
  return result.success;
};

/**
 * Check if a Result is Err
 */
export const isErr = <T, E>(result: Result<T, E>): result is { success: false; error: E } => {
  return !result.success;
};

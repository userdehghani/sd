/**
 * Email Value Object
 * Ensures email validity through domain logic
 */

import { Result, Ok, Err } from "../../shared/result";
import { ValidationError, ErrorCode } from "../../shared/errors";

export class Email {
  private constructor(private readonly value: string) {}

  static create(email: string): Result<Email, ValidationError> {
    const trimmed = email.trim().toLowerCase();
    
    if (!this.isValid(trimmed)) {
      return Err(
        new ValidationError("Invalid email format", {
          field: "email",
          value: email,
        })
      );
    }

    return Ok(new Email(trimmed));
  }

  private static isValid(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

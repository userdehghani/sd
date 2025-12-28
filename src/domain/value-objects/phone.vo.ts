/**
 * Phone Value Object
 * Ensures phone number validity
 */

import { Result, Ok, Err } from "../../shared/result";
import { ValidationError } from "../../shared/errors";

export class Phone {
  private constructor(private readonly value: string) {}

  static create(phone: string): Result<Phone, ValidationError> {
    const normalized = this.normalize(phone);
    
    if (!this.isValid(normalized)) {
      return Err(
        new ValidationError("Invalid phone number format", {
          field: "phone",
          value: phone,
        })
      );
    }

    return Ok(new Phone(normalized));
  }

  private static normalize(phone: string): string {
    // Remove all non-digit characters except +
    return phone.replace(/[^\d+]/g, "");
  }

  private static isValid(phone: string): boolean {
    // International format: starts with + and has 10-15 digits
    const phoneRegex = /^\+\d{10,15}$/;
    return phoneRegex.test(phone);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: Phone): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

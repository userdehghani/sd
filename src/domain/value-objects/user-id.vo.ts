/**
 * UserId Value Object
 * Represents a unique user identifier
 */

import { UUID } from "../../shared/types";

export class UserId {
  private constructor(private readonly value: UUID) {}

  static create(id?: UUID): UserId {
    return new UserId(id || crypto.randomUUID());
  }

  static fromString(id: string): UserId {
    return new UserId(id);
  }

  getValue(): UUID {
    return this.value;
  }

  equals(other: UserId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

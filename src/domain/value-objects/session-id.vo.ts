/**
 * SessionId Value Object
 * Represents a unique session identifier
 */

import { UUID } from "../../shared/types";

export class SessionId {
  private constructor(private readonly value: UUID) {}

  static create(id?: UUID): SessionId {
    return new SessionId(id || crypto.randomUUID());
  }

  static fromString(id: string): SessionId {
    return new SessionId(id);
  }

  getValue(): UUID {
    return this.value;
  }

  equals(other: SessionId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

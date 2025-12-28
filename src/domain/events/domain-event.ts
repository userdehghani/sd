/**
 * Base Domain Event
 * All domain events extend from this
 */

import { Timestamp, UUID } from "../../shared/types";

export abstract class DomainEvent {
  public readonly occurredAt: Timestamp;
  public readonly eventId: UUID;

  constructor(
    public readonly eventType: string,
    public readonly aggregateId: string
  ) {
    this.occurredAt = new Date();
    this.eventId = crypto.randomUUID();
  }

  abstract toJSON(): Record<string, unknown>;
}

export class UserRegisteredEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly provider: string
  ) {
    super("UserRegistered", userId);
  }

  toJSON() {
    return {
      eventId: this.eventId,
      eventType: this.eventType,
      occurredAt: this.occurredAt,
      userId: this.userId,
      email: this.email,
      provider: this.provider,
    };
  }
}

export class UserLoggedInEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly sessionId: string,
    public readonly provider: string
  ) {
    super("UserLoggedIn", userId);
  }

  toJSON() {
    return {
      eventId: this.eventId,
      eventType: this.eventType,
      occurredAt: this.occurredAt,
      userId: this.userId,
      sessionId: this.sessionId,
      provider: this.provider,
    };
  }
}

export class SessionRevokedEvent extends DomainEvent {
  constructor(
    public readonly sessionId: string,
    public readonly userId: string
  ) {
    super("SessionRevoked", sessionId);
  }

  toJSON() {
    return {
      eventId: this.eventId,
      eventType: this.eventType,
      occurredAt: this.occurredAt,
      sessionId: this.sessionId,
      userId: this.userId,
    };
  }
}

export class UserProfileUpdatedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly updatedFields: string[]
  ) {
    super("UserProfileUpdated", userId);
  }

  toJSON() {
    return {
      eventId: this.eventId,
      eventType: this.eventType,
      occurredAt: this.occurredAt,
      userId: this.userId,
      updatedFields: this.updatedFields,
    };
  }
}

export class EmailVerifiedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string
  ) {
    super("EmailVerified", userId);
  }

  toJSON() {
    return {
      eventId: this.eventId,
      eventType: this.eventType,
      occurredAt: this.occurredAt,
      userId: this.userId,
      email: this.email,
    };
  }
}

export class PhoneVerifiedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly phone: string
  ) {
    super("PhoneVerified", userId);
  }

  toJSON() {
    return {
      eventId: this.eventId,
      eventType: this.eventType,
      occurredAt: this.occurredAt,
      userId: this.userId,
      phone: this.phone,
    };
  }
}

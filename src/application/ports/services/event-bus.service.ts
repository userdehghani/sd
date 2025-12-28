/**
 * Event Bus Service Port (Interface)
 * Defines the contract for pub/sub operations (Redis)
 */

import { DomainEvent } from "../../../domain/events/domain-event";
import { AsyncResult } from "../../../shared/result";
import { DomainError } from "../../../shared/errors";

export interface IEventBusService {
  publish(event: DomainEvent): AsyncResult<void, DomainError>;
  subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): AsyncResult<void, DomainError>;
}

/**
 * Event Bus Service Implementation (Redis Pub/Sub)
 */

import Redis from "ioredis";
import { IEventBusService } from "../../application/ports/services/event-bus.service";
import { DomainEvent } from "../../domain/events/domain-event";
import { AsyncResult, Ok, Err } from "../../shared/result";
import { DomainError, InfrastructureError, ErrorCode } from "../../shared/errors";
import { logger } from "../../logger";

export class EventBusServiceImpl implements IEventBusService {
  private handlers: Map<string, Array<(event: DomainEvent) => Promise<void>>> = new Map();

  constructor(
    private readonly publisher: Redis,
    private readonly subscriber: Redis
  ) {
    this.setupSubscriber();
  }

  private setupSubscriber(): void {
    this.subscriber.on("message", async (channel: string, message: string) => {
      try {
        const event = JSON.parse(message) as DomainEvent;
        const handlers = this.handlers.get(channel) || [];

        for (const handler of handlers) {
          try {
            await handler(event);
          } catch (error) {
            logger.error("Error in event handler", { error, event });
          }
        }
      } catch (error) {
        logger.error("Error processing event message", { error, message });
      }
    });
  }

  async publish(event: DomainEvent): AsyncResult<void, DomainError> {
    try {
      const channel = event.eventType;
      const message = JSON.stringify(event.toJSON());

      await this.publisher.publish(channel, message);

      logger.info("Event published", {
        eventType: event.eventType,
        eventId: event.eventId,
      });

      return Ok(undefined);
    } catch (error) {
      logger.error("Error publishing event", { error, event });
      return Err(
        new InfrastructureError(
          "Failed to publish event",
          ErrorCode.EXTERNAL_SERVICE_ERROR,
          { error }
        )
      );
    }
  }

  async subscribe(
    eventType: string,
    handler: (event: DomainEvent) => Promise<void>
  ): AsyncResult<void, DomainError> {
    try {
      // Add handler to map
      const handlers = this.handlers.get(eventType) || [];
      handlers.push(handler);
      this.handlers.set(eventType, handlers);

      // Subscribe to channel if first handler
      if (handlers.length === 1) {
        await this.subscriber.subscribe(eventType);
        logger.info("Subscribed to event", { eventType });
      }

      return Ok(undefined);
    } catch (error) {
      logger.error("Error subscribing to event", { error, eventType });
      return Err(
        new InfrastructureError(
          "Failed to subscribe to event",
          ErrorCode.EXTERNAL_SERVICE_ERROR,
          { error }
        )
      );
    }
  }

  async unsubscribeAll(): Promise<void> {
    try {
      await this.subscriber.unsubscribe();
      this.handlers.clear();
      logger.info("Unsubscribed from all events");
    } catch (error) {
      logger.error("Error unsubscribing from events", { error });
    }
  }
}

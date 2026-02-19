import { Entity } from './entity.js';
import type { DomainEvent } from '../events/domain-event.js';

export abstract class AggregateRoot<TProps> extends Entity<TProps> {
  private domainEvents: DomainEvent[] = [];

  protected addDomainEvent(event: DomainEvent): void {
    this.domainEvents.push(event);
  }

  public getDomainEvents(): DomainEvent[] {
    return [...this.domainEvents];
  }

  public pullDomainEvents(): DomainEvent[] {
    const events = [...this.domainEvents];
    this.domainEvents = [];
    return events;
  }

  public clearDomainEvents(): void {
    this.domainEvents = [];
  }
}

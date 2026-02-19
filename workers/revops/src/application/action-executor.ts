import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { ActionExecutor, WorkflowAction, WorkflowContext } from '@mauntic/revops-domain';
import { updateDeal } from '../infrastructure/repositories/deal-repository.js';
import { enrollContact } from '../infrastructure/repositories/sequence-repository.js';

/**
 * Bridges WorkflowEngine actions to concrete operations.
 * Executes side-effects for each WorkflowActionType.
 */
export class RevOpsActionExecutor implements ActionExecutor {
  constructor(
    private readonly db: NeonHttpDatabase,
    private readonly events: Queue,
  ) {}

  async execute(action: WorkflowAction, context: WorkflowContext): Promise<void> {
    switch (action.type) {
      case 'send_email':
        return this.sendEmail(action, context);
      case 'create_task':
        return this.createTask(action, context);
      case 'update_field':
        return this.updateField(action, context);
      case 'assign_owner':
        return this.assignOwner(action, context);
      case 'notify':
        return this.notify(action, context);
      case 'call_webhook':
        return this.callWebhook(action, context);
      case 'add_to_sequence':
        return this.addToSequence(action, context);
      case 'move_stage':
        return this.moveStage(action, context);
      default:
        console.warn(`Unknown workflow action type: ${action.type}`, { context });
    }
  }

  /**
   * Enqueue an email send event for async delivery.
   */
  private async sendEmail(action: WorkflowAction, context: WorkflowContext): Promise<void> {
    await this.events.send({
      type: 'revops.SendEmail',
      data: {
        organizationId: context.organizationId,
        dealId: context.dealId,
        contactId: context.contactId,
        templateId: action.config.templateId,
        subject: action.config.subject,
        body: action.config.body,
        ...context.data,
      },
    });
    console.info('Enqueued send_email action', {
      organizationId: context.organizationId,
      dealId: context.dealId,
    });
  }

  /**
   * Log task creation (placeholder -- could persist to a tasks table in the future).
   */
  private async createTask(action: WorkflowAction, context: WorkflowContext): Promise<void> {
    console.info('Workflow create_task action', {
      organizationId: context.organizationId,
      dealId: context.dealId,
      contactId: context.contactId,
      title: action.config.title,
      assignee: action.config.assignee,
      dueDate: action.config.dueDate,
    });
  }

  /**
   * Update a field on the deal record.
   */
  private async updateField(action: WorkflowAction, context: WorkflowContext): Promise<void> {
    if (!context.dealId) {
      console.warn('update_field action skipped: no dealId in context');
      return;
    }

    const field = action.config.field as string | undefined;
    const value = action.config.value;
    if (!field) {
      console.warn('update_field action skipped: no field specified');
      return;
    }

    await updateDeal(this.db, context.organizationId, context.dealId, {
      [field]: value,
    });
    console.info('Updated deal field', {
      organizationId: context.organizationId,
      dealId: context.dealId,
      field,
    });
  }

  /**
   * Assign a new owner/rep to the deal.
   */
  private async assignOwner(action: WorkflowAction, context: WorkflowContext): Promise<void> {
    if (!context.dealId) {
      console.warn('assign_owner action skipped: no dealId in context');
      return;
    }

    const repId = action.config.repId as string | undefined;
    if (!repId) {
      console.warn('assign_owner action skipped: no repId specified');
      return;
    }

    await updateDeal(this.db, context.organizationId, context.dealId, {
      assigned_rep: repId,
    });
    console.info('Assigned deal owner', {
      organizationId: context.organizationId,
      dealId: context.dealId,
      repId,
    });
  }

  /**
   * Log notification (could be enqueued to a notification service in the future).
   */
  private async notify(action: WorkflowAction, context: WorkflowContext): Promise<void> {
    console.info('Workflow notify action', {
      organizationId: context.organizationId,
      dealId: context.dealId,
      contactId: context.contactId,
      channel: action.config.channel ?? 'in_app',
      message: action.config.message,
      recipients: action.config.recipients,
    });
  }

  /**
   * Make an outbound HTTP call to a webhook URL.
   */
  private async callWebhook(action: WorkflowAction, context: WorkflowContext): Promise<void> {
    const url = action.config.url as string | undefined;
    if (!url) {
      console.warn('call_webhook action skipped: no url specified');
      return;
    }

    try {
      const response = await fetch(url, {
        method: (action.config.method as string) ?? 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(action.config.headers as Record<string, string> ?? {}),
        },
        body: JSON.stringify({
          trigger: context.trigger,
          organizationId: context.organizationId,
          dealId: context.dealId,
          contactId: context.contactId,
          data: context.data,
          actionConfig: action.config,
        }),
      });

      console.info('Webhook called', {
        url,
        status: response.status,
        organizationId: context.organizationId,
      });
    } catch (error) {
      console.error('Webhook call failed', {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Enroll a contact into a sequence.
   */
  private async addToSequence(action: WorkflowAction, context: WorkflowContext): Promise<void> {
    const sequenceId = action.config.sequenceId as string | undefined;
    const contactId = context.contactId ?? (action.config.contactId as string | undefined);

    if (!sequenceId || !contactId) {
      console.warn('add_to_sequence action skipped: missing sequenceId or contactId', {
        sequenceId,
        contactId,
      });
      return;
    }

    await enrollContact(this.db, context.organizationId, {
      sequence_id: sequenceId,
      contact_id: contactId,
    });
    console.info('Enrolled contact in sequence', {
      organizationId: context.organizationId,
      sequenceId,
      contactId,
    });
  }

  /**
   * Move a deal to a new stage.
   */
  private async moveStage(action: WorkflowAction, context: WorkflowContext): Promise<void> {
    if (!context.dealId) {
      console.warn('move_stage action skipped: no dealId in context');
      return;
    }

    const newStage = action.config.stage as string | undefined;
    if (!newStage) {
      console.warn('move_stage action skipped: no stage specified');
      return;
    }

    await updateDeal(this.db, context.organizationId, context.dealId, {
      stage: newStage,
    });
    console.info('Moved deal stage', {
      organizationId: context.organizationId,
      dealId: context.dealId,
      newStage,
    });
  }
}

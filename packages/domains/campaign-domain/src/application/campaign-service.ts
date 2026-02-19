import { NotFoundError } from '@mauntic/domain-kernel';
import { Campaign } from '../entities/campaign.js';
import type { CampaignRepository } from '../repositories/campaign-repository.js';
import {
  type CreateCampaignCommand,
  createCampaignCommand,
  type UpdateCampaignCommand,
  updateCampaignCommand,
  type ScheduleCampaignCommand,
  scheduleCampaignCommand,
  type SendCampaignCommand,
  sendCampaignCommand,
  type PauseCampaignCommand,
  pauseCampaignCommand,
  type ResumeCampaignCommand,
  resumeCampaignCommand,
  type DeleteCampaignCommand,
  deleteCampaignCommand,
} from '../commands/index.js';
import type { CampaignEventPublisher } from './ports.js';

export class CampaignApplicationService {
  constructor(
    private readonly repository: CampaignRepository,
    private readonly events: CampaignEventPublisher,
  ) {}

  async create(input: CreateCampaignCommand): Promise<Campaign> {
    const command = createCampaignCommand(input);
    const campaign = Campaign.create({
      organizationId: command.organizationId,
      createdBy: command.createdBy,
      name: command.name,
      description: command.description,
      type: command.type,
      subject: command.subject,
      templateId: command.templateId,
      segmentId: command.segmentId,
    });

    await this.repository.save(campaign);
    await this.events.publish({
      type: 'campaign.CampaignCreated',
      data: {
        organizationId: command.organizationId,
        campaignId: campaign.id,
        name: campaign.name,
        createdBy: command.createdBy,
      },
    });

    return campaign;
  }

  async update(input: UpdateCampaignCommand): Promise<Campaign> {
    const command = updateCampaignCommand(input);
    const campaign = await this.requireCampaign(
      command.organizationId,
      command.campaignId,
    );

    campaign.update({
      name: command.name,
      description: command.description,
      subject: command.subject,
      templateId: command.templateId ?? undefined,
      segmentId: command.segmentId ?? undefined,
    });

    await this.repository.save(campaign);
    return campaign;
  }

  async schedule(input: ScheduleCampaignCommand): Promise<Campaign> {
    const command = scheduleCampaignCommand(input);
    const campaign = await this.requireCampaign(
      command.organizationId,
      command.campaignId,
    );

    campaign.schedule(command.scheduledAt);
    await this.repository.save(campaign);
    await this.events.publish({
      type: 'campaign.CampaignScheduled',
      data: {
        organizationId: command.organizationId,
        campaignId: command.campaignId,
        scheduledFor: command.scheduledAt.toISOString(),
        scheduledBy: command.scheduledBy,
      },
    });

    return campaign;
  }

  async send(input: SendCampaignCommand): Promise<Campaign> {
    const command = sendCampaignCommand(input);
    const campaign = await this.requireCampaign(
      command.organizationId,
      command.campaignId,
    );

    campaign.send();
    await this.repository.save(campaign);
    await this.events.publish({
      type: 'campaign.CampaignSent',
      data: {
        organizationId: command.organizationId,
        campaignId: command.campaignId,
        contactCount: campaign.recipientCount,
      },
    });

    return campaign;
  }

  async pause(input: PauseCampaignCommand): Promise<Campaign> {
    const command = pauseCampaignCommand(input);
    const campaign = await this.requireCampaign(
      command.organizationId,
      command.campaignId,
    );

    campaign.pause();
    await this.repository.save(campaign);
    await this.events.publish({
      type: 'campaign.CampaignPaused',
      data: {
        organizationId: command.organizationId,
        campaignId: command.campaignId,
        pausedBy: command.pausedBy,
      },
    });

    return campaign;
  }

  async resume(input: ResumeCampaignCommand): Promise<Campaign> {
    const command = resumeCampaignCommand(input);
    const campaign = await this.requireCampaign(
      command.organizationId,
      command.campaignId,
    );

    campaign.resume();
    await this.repository.save(campaign);
    return campaign;
  }

  async delete(input: DeleteCampaignCommand): Promise<void> {
    const command = deleteCampaignCommand(input);
    await this.requireCampaign(command.organizationId, command.campaignId);
    await this.repository.delete(command.organizationId, command.campaignId);
  }

  private async requireCampaign(orgId: string, campaignId: string): Promise<Campaign> {
    const campaign = await this.repository.findById(orgId, campaignId);
    if (!campaign) {
      throw new NotFoundError('Campaign', campaignId);
    }
    return campaign;
  }
}

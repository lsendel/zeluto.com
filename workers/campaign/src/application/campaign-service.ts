import { Campaign, type CampaignRepository, type CampaignType } from '@mauntic/campaign-domain';

export class CampaignService {
    constructor(
        private readonly campaignRepo: CampaignRepository,
        private readonly events: any // We'll type this properly based on usage
    ) { }

    async create(input: {
        organizationId: string;
        userId: string;
        name: string;
        type: string;
        description?: string;
        subject?: string;
        templateId?: string;
        segmentId?: string;
    }): Promise<Campaign> {
        const campaign = Campaign.create({
            organizationId: input.organizationId,
            createdBy: input.userId,
            name: input.name,
            type: input.type as CampaignType,
            description: input.description,
            subject: input.subject,
            templateId: input.templateId,
            segmentId: input.segmentId,
        });

        await this.campaignRepo.save(campaign);

        await this.publishEvent('campaign.CampaignCreated', {
            organizationId: input.organizationId,
            campaignId: campaign.id,
            name: campaign.name,
            createdBy: input.userId,
        });

        return campaign;
    }

    async update(
        orgId: string,
        campaignId: string,
        input: {
            name?: string;
            description?: string | null;
            subject?: string | null;
            templateId?: string | null;
            segmentId?: string | null;
        }
    ): Promise<Campaign> {
        const campaign = await this.campaignRepo.findById(orgId, campaignId);
        if (!campaign) {
            throw new Error('Campaign not found'); // Should be a domain error
        }

        campaign.update(input);
        await this.campaignRepo.save(campaign);

        return campaign;
    }

    async schedule(orgId: string, campaignId: string, date: Date, userId: string): Promise<Campaign> {
        const campaign = await this.campaignRepo.findById(orgId, campaignId);
        if (!campaign) {
            throw new Error('Campaign not found');
        }

        campaign.schedule(date);
        await this.campaignRepo.save(campaign);

        await this.publishEvent('campaign.CampaignScheduled', {
            organizationId: orgId,
            campaignId: campaignId,
            scheduledFor: date.toISOString(),
            scheduledBy: userId,
        });

        return campaign;
    }

    async send(orgId: string, campaignId: string): Promise<Campaign> {
        const campaign = await this.campaignRepo.findById(orgId, campaignId);
        if (!campaign) {
            throw new Error('Campaign not found');
        }

        campaign.send();
        await this.campaignRepo.save(campaign);

        await this.publishEvent('campaign.CampaignSent', {
            organizationId: orgId,
            campaignId: campaignId,
            contactCount: 0,
        });

        return campaign;
    }

    async pause(orgId: string, campaignId: string, userId: string): Promise<Campaign> {
        const campaign = await this.campaignRepo.findById(orgId, campaignId);
        if (!campaign) {
            throw new Error('Campaign not found');
        }

        campaign.pause();
        await this.campaignRepo.save(campaign);

        await this.publishEvent('campaign.CampaignPaused', {
            organizationId: orgId,
            campaignId: campaignId,
            pausedBy: userId,
        });

        return campaign;
    }

    async resume(orgId: string, campaignId: string): Promise<Campaign> {
        const campaign = await this.campaignRepo.findById(orgId, campaignId);
        if (!campaign) {
            throw new Error('Campaign not found');
        }

        campaign.resume();
        await this.campaignRepo.save(campaign);

        return campaign;
    }

    async delete(orgId: string, campaignId: string): Promise<void> {
        // Verify existence?
        await this.campaignRepo.delete(orgId, campaignId);
    }

    // Helper to abstract event publishing
    private async publishEvent(type: string, data: any) {
        try {
            if (this.events && typeof this.events.send === 'function') {
                await this.events.send({
                    type,
                    data,
                    metadata: {
                        id: crypto.randomUUID(),
                        version: 1,
                        sourceContext: 'campaign',
                        timestamp: new Date().toISOString(),
                        correlationId: data.campaignId,
                        tenantContext: { organizationId: data.organizationId },
                    },
                });
            }
        } catch (err) {
            console.error(`Failed to publish ${type} event:`, err);
        }
    }
}

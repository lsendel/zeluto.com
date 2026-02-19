export type CampaignEventPayload =
  | {
      type: 'campaign.CampaignCreated';
      data: {
        organizationId: string;
        campaignId: string;
        name: string;
        createdBy: string;
      };
    }
  | {
      type: 'campaign.CampaignScheduled';
      data: {
        organizationId: string;
        campaignId: string;
        scheduledFor: string;
        scheduledBy: string;
      };
    }
  | {
      type: 'campaign.CampaignSent';
      data: {
        organizationId: string;
        campaignId: string;
        contactCount: number;
      };
    }
  | {
      type: 'campaign.CampaignPaused';
      data: {
        organizationId: string;
        campaignId: string;
        pausedBy: string;
      };
    };

export interface CampaignEventPublisher {
  publish(event: CampaignEventPayload): Promise<void>;
}

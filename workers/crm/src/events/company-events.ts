import type {
  CompanyCreatedEvent,
  CompanyUpdatedEvent,
  CompanyDeletedEvent,
  DomainEventMetadata,
} from '@mauntic/domain-kernel';

function meta(organizationId: string): DomainEventMetadata {
  return {
    id: crypto.randomUUID(),
    version: 1,
    sourceContext: 'crm',
    timestamp: new Date().toISOString(),
    correlationId: crypto.randomUUID(),
    tenantContext: {
      organizationId: organizationId as unknown as number,
    },
  };
}

export function companyCreated(company: {
  id: string;
  organizationId: string;
  name: string;
}): CompanyCreatedEvent {
  return {
    type: 'crm.CompanyCreated',
    data: {
      organizationId: company.organizationId as unknown as number,
      companyId: company.id as unknown as number,
      name: company.name,
    },
    metadata: meta(company.organizationId),
  };
}

export function companyUpdated(company: {
  id: string;
  organizationId: string;
  fields: string[];
}): CompanyUpdatedEvent {
  return {
    type: 'crm.CompanyUpdated',
    data: {
      organizationId: company.organizationId as unknown as number,
      companyId: company.id as unknown as number,
      fields: company.fields,
    },
    metadata: meta(company.organizationId),
  };
}

export function companyDeleted(input: {
  companyId: string;
  organizationId: string;
  deletedBy: string;
}): CompanyDeletedEvent {
  return {
    type: 'crm.CompanyDeleted',
    data: {
      organizationId: input.organizationId as unknown as number,
      companyId: input.companyId as unknown as number,
      deletedBy: input.deletedBy as unknown as number,
    },
    metadata: meta(input.organizationId),
  };
}

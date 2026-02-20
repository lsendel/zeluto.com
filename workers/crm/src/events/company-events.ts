import {
  asCompanyId,
  asOrganizationId,
  asUserId,
} from '@mauntic/domain-kernel';
import type {
  CompanyCreatedEvent,
  CompanyDeletedEvent,
  CompanyUpdatedEvent,
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
      organizationId: asOrganizationId(organizationId),
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
      organizationId: asOrganizationId(company.organizationId),
      companyId: asCompanyId(company.id),
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
      organizationId: asOrganizationId(company.organizationId),
      companyId: asCompanyId(company.id),
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
      organizationId: asOrganizationId(input.organizationId),
      companyId: asCompanyId(input.companyId),
      deletedBy: asUserId(input.deletedBy),
    },
    metadata: meta(input.organizationId),
  };
}

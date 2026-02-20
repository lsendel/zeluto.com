import type { Sequence } from '../entities/sequence.js';

export interface SequenceEnrollment {
  id: string;
  sequenceId: string;
  contactId: string;
  currentStep: number;
  status: string;
  enrolledAt: Date;
  lastStepAt?: Date;
  completedAt?: Date;
}

export interface SequenceRepository {
  findById(orgId: string, id: string): Promise<Sequence | null>;
  findByOrganization(
    orgId: string,
    options?: { status?: string; limit?: number },
  ): Promise<Sequence[]>;
  save(sequence: Sequence): Promise<void>;
  delete(orgId: string, id: string): Promise<void>;
  findEnrollment(
    orgId: string,
    sequenceId: string,
    contactId: string,
  ): Promise<SequenceEnrollment | null>;
  findEnrollmentsBySequence(
    orgId: string,
    sequenceId: string,
    status?: string,
  ): Promise<SequenceEnrollment[]>;
  saveEnrollment(orgId: string, enrollment: SequenceEnrollment): Promise<void>;
}

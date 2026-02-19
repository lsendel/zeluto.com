import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JourneyService } from './journey-service.js';
import type { IJourneyRepository } from '../infrastructure/repositories/drizzle-journey-repository.js';
import { JourneyExecution, JourneyStep, StepExecution } from '@mauntic/journey-domain';
import { Result } from '@mauntic/domain-kernel';
import type { Queue } from 'bullmq';

describe('JourneyService', () => {
    let service: JourneyService;
    let repo: IJourneyRepository;
    let emailQueue: Queue;
    let delayedStepQueue: Queue;
    let stepQueue: Queue;
    let redis: any;

    beforeEach(() => {
        repo = {
            findExecutionById: vi.fn(),
            saveExecution: vi.fn(),
            findStepById: vi.fn(),
            findConnectionsFrom: vi.fn(),
            createStepExecution: vi.fn(),
            updateStepExecution: vi.fn(),
            findTriggersByType: vi.fn(),
            findActiveJourneysWithSegmentTriggers: vi.fn(),
            findStaleExecutions: vi.fn(),
            logExecution: vi.fn(),
        };
        emailQueue = { add: vi.fn() } as any;
        delayedStepQueue = { add: vi.fn() } as any;
        stepQueue = { add: vi.fn() } as any;
        redis = { get: vi.fn(), setex: vi.fn() };

        service = new JourneyService(
            repo,
            emailQueue,
            delayedStepQueue,
            stepQueue,
            redis,
        );
    });

    describe('executeStep', () => {
        it('should complete active execution if no next step', async () => {
            const executionId = crypto.randomUUID();
            const stepId = crypto.randomUUID();
            const orgId = crypto.randomUUID();

            const execution = JourneyExecution.create({
                journeyId: crypto.randomUUID(),
                journeyVersionId: crypto.randomUUID(),
                organizationId: orgId,
                contactId: crypto.randomUUID(),
            }).getValue();
            // Need to overwrite private ID or create with specific/mock logic?
            // Since create generates random UUID, we mock repo to return it.
            // But we need executionId to match.
            // Let's rely on repo returning the obj.

            // Actually, we can just spy on repo to return a mock execution that WE created
            // But executeStep takes ID.
            // So allow random ID but capture it.

            (repo.findExecutionById as any).mockResolvedValue(execution);

            const step = JourneyStep.create({
                journeyVersionId: execution.journeyVersionId,
                organizationId: orgId,
                type: 'exit',
                config: {},
                positionX: 0,
                positionY: 0
            }).getValue();
            (repo.findStepById as any).mockResolvedValue(step);

            // Assume idempotency check passes (returns null)
            (redis.get as any).mockResolvedValue(null);

            const result = await service.executeStep({
                executionId: execution.executionId,
                stepId: step.stepId,
                journeyId: execution.journeyId,
                contactId: execution.contactId,
                organizationId: orgId,
                versionId: execution.journeyVersionId,
            });

            expect(result.isSuccess).toBe(true);
            expect(repo.saveExecution).toHaveBeenCalled();
            expect(execution.status).toBe('completed');
        });

        it('should fail if execution not found', async () => {
            (repo.findExecutionById as any).mockResolvedValue(null);
            (redis.get as any).mockResolvedValue(null);

            const result = await service.executeStep({
                executionId: 'exec-id',
                stepId: 'step-id',
                journeyId: 'j-id',
                contactId: 'c-id',
                organizationId: 'org-id',
                versionId: 'v-id',
            });

            expect(result.isFailure).toBe(true);
            expect(result.getError()).toContain('Execution not found');
        });

        it('should skip if idempotent', async () => {
            (redis.get as any).mockResolvedValue('1');

            const result = await service.executeStep({
                executionId: 'exec-id',
                stepId: 'step-id',
                journeyId: 'j-id',
                contactId: 'c-id',
                organizationId: 'org-id',
                versionId: 'v-id',
            });

            expect(result.isSuccess).toBe(true);
            expect(repo.findExecutionById).not.toHaveBeenCalled();
        });
    });
});

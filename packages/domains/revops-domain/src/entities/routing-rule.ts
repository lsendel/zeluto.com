import { z } from 'zod';

export const RoutingStrategySchema = z.enum([
  'round_robin',
  'weighted',
  'territory',
  'skill_based',
  'load_balanced',
]);
export type RoutingStrategy = z.infer<typeof RoutingStrategySchema>;

export const RoutingRulePropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string(),
  strategy: RoutingStrategySchema,
  conditions: z.record(z.string(), z.unknown()).optional(),
  targetReps: z.array(z.string()),
  priority: z.number().int().min(0),
  enabled: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type RoutingRuleProps = z.infer<typeof RoutingRulePropsSchema>;

export class RoutingRule {
  private constructor(private props: RoutingRuleProps) {}

  static create(input: {
    id: string;
    organizationId: string;
    name: string;
    strategy: RoutingStrategy;
    targetReps: string[];
    conditions?: Record<string, unknown>;
    priority?: number;
    enabled?: boolean;
  }): RoutingRule {
    return new RoutingRule(
      RoutingRulePropsSchema.parse({
        ...input,
        priority: input.priority ?? 0,
        enabled: input.enabled ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  static reconstitute(props: RoutingRuleProps): RoutingRule {
    return new RoutingRule(RoutingRulePropsSchema.parse(props));
  }

  get id() {
    return this.props.id;
  }
  get organizationId() {
    return this.props.organizationId;
  }
  get name() {
    return this.props.name;
  }
  get strategy() {
    return this.props.strategy;
  }
  get conditions() {
    return this.props.conditions;
  }
  get targetReps() {
    return this.props.targetReps;
  }
  get priority() {
    return this.props.priority;
  }
  get enabled() {
    return this.props.enabled;
  }

  // Round-robin: select next rep based on a counter
  selectRep(counter: number): string {
    if (this.props.targetReps.length === 0)
      throw new Error('No target reps configured');
    return this.props.targetReps[counter % this.props.targetReps.length];
  }

  update(input: {
    name?: string;
    strategy?: RoutingStrategy;
    conditions?: Record<string, unknown>;
    targetReps?: string[];
    priority?: number;
    enabled?: boolean;
  }): void {
    if (input.name !== undefined) this.props.name = input.name;
    if (input.strategy !== undefined) this.props.strategy = input.strategy;
    if (input.conditions !== undefined)
      this.props.conditions = input.conditions;
    if (input.targetReps !== undefined)
      this.props.targetReps = input.targetReps;
    if (input.priority !== undefined) this.props.priority = input.priority;
    if (input.enabled !== undefined) this.props.enabled = input.enabled;
    this.props.updatedAt = new Date();
  }

  toProps(): Readonly<RoutingRuleProps> {
    return Object.freeze({ ...this.props });
  }
}

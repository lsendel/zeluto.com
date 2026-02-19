import { z } from 'zod';

export const ForecastPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  period: z.string(), // e.g. "2026-Q1"
  repId: z.string().uuid().optional(),
  pipelineValue: z.number().min(0),
  bestCaseValue: z.number().min(0),
  commitValue: z.number().min(0),
  closedValue: z.number().min(0),
  weightedValue: z.number().min(0),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type ForecastProps = z.infer<typeof ForecastPropsSchema>;

export class Forecast {
  private constructor(private props: ForecastProps) {}

  static create(input: {
    id: string;
    organizationId: string;
    period: string;
    repId?: string;
    pipelineValue?: number;
    bestCaseValue?: number;
    commitValue?: number;
    closedValue?: number;
  }): Forecast {
    const pipelineValue = input.pipelineValue ?? 0;
    const bestCaseValue = input.bestCaseValue ?? 0;
    const commitValue = input.commitValue ?? 0;
    const closedValue = input.closedValue ?? 0;

    return new Forecast(
      ForecastPropsSchema.parse({
        ...input,
        pipelineValue,
        bestCaseValue,
        commitValue,
        closedValue,
        weightedValue: Forecast.calculateWeighted(closedValue, commitValue, bestCaseValue, pipelineValue),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  static reconstitute(props: ForecastProps): Forecast {
    return new Forecast(ForecastPropsSchema.parse(props));
  }

  // Weighted calculation: closed×1.0 + commit×1.0 + best_case×0.5 + pipeline×0.25
  static calculateWeighted(closed: number, commit: number, bestCase: number, pipeline: number): number {
    return closed * 1.0 + commit * 1.0 + bestCase * 0.5 + pipeline * 0.25;
  }

  get id() { return this.props.id; }
  get organizationId() { return this.props.organizationId; }
  get period() { return this.props.period; }
  get repId() { return this.props.repId; }
  get pipelineValue() { return this.props.pipelineValue; }
  get bestCaseValue() { return this.props.bestCaseValue; }
  get commitValue() { return this.props.commitValue; }
  get closedValue() { return this.props.closedValue; }
  get weightedValue() { return this.props.weightedValue; }

  updateValues(input: {
    pipelineValue?: number;
    bestCaseValue?: number;
    commitValue?: number;
    closedValue?: number;
  }): void {
    if (input.pipelineValue !== undefined) this.props.pipelineValue = input.pipelineValue;
    if (input.bestCaseValue !== undefined) this.props.bestCaseValue = input.bestCaseValue;
    if (input.commitValue !== undefined) this.props.commitValue = input.commitValue;
    if (input.closedValue !== undefined) this.props.closedValue = input.closedValue;
    this.props.weightedValue = Forecast.calculateWeighted(
      this.props.closedValue, this.props.commitValue, this.props.bestCaseValue, this.props.pipelineValue,
    );
    this.props.updatedAt = new Date();
  }

  toProps(): Readonly<ForecastProps> {
    return Object.freeze({ ...this.props });
  }
}

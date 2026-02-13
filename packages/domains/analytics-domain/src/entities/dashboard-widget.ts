import { z } from 'zod';

export const WidgetTypeSchema = z.enum(['metric', 'chart', 'table', 'list']);
export type WidgetType = z.infer<typeof WidgetTypeSchema>;

export const WidgetPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const WidgetSizeSchema = z.object({
  w: z.number(),
  h: z.number(),
});

export const DashboardWidgetPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  dashboardId: z.string().uuid(),
  widgetType: WidgetTypeSchema,
  config: z.record(z.string(), z.unknown()),
  position: WidgetPositionSchema,
  size: WidgetSizeSchema,
  createdAt: z.coerce.date(),
});

export type DashboardWidgetProps = z.infer<typeof DashboardWidgetPropsSchema>;

export class DashboardWidget {
  private constructor(private props: DashboardWidgetProps) {}

  static create(input: {
    organizationId: string;
    dashboardId: string;
    widgetType: WidgetType;
    config?: Record<string, unknown>;
    position?: { x: number; y: number };
    size?: { w: number; h: number };
  }): DashboardWidget {
    return new DashboardWidget(
      DashboardWidgetPropsSchema.parse({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        dashboardId: input.dashboardId,
        widgetType: input.widgetType,
        config: input.config ?? {},
        position: input.position ?? { x: 0, y: 0 },
        size: input.size ?? { w: 4, h: 3 },
        createdAt: new Date(),
      }),
    );
  }

  static reconstitute(props: DashboardWidgetProps): DashboardWidget {
    return new DashboardWidget(DashboardWidgetPropsSchema.parse(props));
  }

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get dashboardId(): string {
    return this.props.dashboardId;
  }
  get widgetType(): WidgetType {
    return this.props.widgetType;
  }
  get config(): Record<string, unknown> {
    return this.props.config;
  }
  get position(): { x: number; y: number } {
    return this.props.position;
  }
  get size(): { w: number; h: number } {
    return this.props.size;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  updateConfig(config: Record<string, unknown>): void {
    this.props.config = config;
  }

  updatePosition(position: { x: number; y: number }): void {
    this.props.position = position;
  }

  updateSize(size: { w: number; h: number }): void {
    this.props.size = size;
  }

  toProps(): Readonly<DashboardWidgetProps> {
    return Object.freeze({ ...this.props });
  }
}

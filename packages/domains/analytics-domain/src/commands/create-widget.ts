import { z } from 'zod';
import { WidgetTypeSchema } from '../entities/dashboard-widget.js';

export const CreateWidgetCommandSchema = z.object({
  organizationId: z.string().uuid(),
  dashboardId: z.string().uuid(),
  widgetType: WidgetTypeSchema,
  config: z.record(z.string(), z.unknown()).optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  size: z.object({ w: z.number(), h: z.number() }).optional(),
});

export type CreateWidgetCommand = z.infer<typeof CreateWidgetCommandSchema>;

export function createWidgetCommand(
  input: CreateWidgetCommand,
): CreateWidgetCommand {
  return CreateWidgetCommandSchema.parse(input);
}

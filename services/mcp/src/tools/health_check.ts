import { z } from 'zod';

const HealthCheckInputSchema = z.object({
  include_details: z.boolean().optional().default(false),
});

type HealthCheckInput = z.infer<typeof HealthCheckInputSchema>;

export async function healthCheckMCP(
  input: unknown,
  dbManager: any
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const params: HealthCheckInput = HealthCheckInputSchema.parse(input ?? {});

  const status = await dbManager.getTaskStatus({
    includeDetails: params.include_details,
  });

  const result = {
    success: true,
    status,
    timestamp: new Date().toISOString(),
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result),
      },
    ],
  };
}

export const HEALTH_CHECK_TOOL = {
  name: 'health_check',
  description: 'Return MCP server health and queue statistics',
  inputSchema: {
    type: 'object',
    properties: {
      include_details: {
        type: 'boolean',
        description: 'Include detailed task breakdown',
        default: false,
      },
    },
  },
} as const;

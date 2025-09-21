import { z } from 'zod';

const TransparencyLogInputSchema = z.object({
  session_id: z.string().optional(),
  limit: z.number().int().positive().max(500).optional().default(50),
});

type TransparencyLogInput = z.infer<typeof TransparencyLogInputSchema>;

export async function getTransparencyLogMCP(
  input: unknown,
  dbManager: any
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const params: TransparencyLogInput = TransparencyLogInputSchema.parse(input ?? {});

  const events = await dbManager.getTransparencyEvents({
    sessionId: params.session_id,
    limit: params.limit,
  });

  const payload = {
    success: true,
    count: events.length,
    events: events.map((event: any) => ({
      id: event.id,
      sessionId: event.sessionId,
      eventTime: event.eventTime?.toISOString(),
      source: event.source,
      level: event.level,
      eventType: event.eventType,
      message: event.message,
      metadata: event.metadata,
    })),
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload),
      },
    ],
  };
}

export const GET_TRANSPARENCY_LOG_TOOL = {
  name: 'get_transparency_log',
  description: 'Fetch recent transparency events from the coordination database',
  inputSchema: {
    type: 'object',
    properties: {
      session_id: {
        type: 'string',
        description: 'Filter events for a specific session',
      },
      limit: {
        type: 'integer',
        description: 'Maximum number of events to return (default 50)',
        maximum: 500,
      },
    },
  },
} as const;

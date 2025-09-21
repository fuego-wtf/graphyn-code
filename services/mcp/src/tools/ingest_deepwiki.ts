import fetch from 'node-fetch';
import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

const DeepwikiInputSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  session_id: z.string().optional(),
});

interface DeepwikiConfig {
  serverUrl: string;
  apiKey?: string;
}

export function createDeepwikiTool(config?: DeepwikiConfig) {
  if (!config?.serverUrl) {
    return null;
  }

  async function handler(input: unknown, dbManager: any) {
    const params = DeepwikiInputSchema.parse(input ?? {});

    const url = new URL(config!.serverUrl);
    url.searchParams.set('q', params.query);

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        ...(config!.apiKey ? { Authorization: `Bearer ${config!.apiKey}` } : {}),
      },
    });

    if (!response.ok) {
      throw new McpError(
        ErrorCode.InternalError,
        `Deepwiki request failed with status ${response.status}`,
      );
    }

    const raw = await response.text();

    let payload: any;
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = { content: raw };
    }

    const entry = {
      source: 'deepwiki',
      sourceId: payload?.id,
      sessionId: params.session_id,
      title: payload?.title || params.query,
      content: payload?.content || payload?.summary || raw,
      metadata: {
        endpoint: config!.serverUrl,
        query: params.query,
      },
    };

    if (typeof dbManager.upsertKnowledgeEntry !== 'function') {
      throw new McpError(ErrorCode.InternalError, 'Knowledge store not available');
    }

    await dbManager.upsertKnowledgeEntry(entry);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, entry }),
        },
      ],
    };
  }

  const definition = {
    name: 'ingest_deepwiki',
    description: 'Fetch documentation from Deepwiki and store it in the local knowledge base',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Query string to search for',
        },
        session_id: {
          type: 'string',
          description: 'Optional session identifier associated with the knowledge entry',
        },
      },
      required: ['query'],
    },
  } as const;

  return { definition, handler };
}

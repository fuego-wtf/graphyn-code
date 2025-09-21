import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase } from '../../packages/db/src/index';

describe('Transparency and Knowledge Store', () => {
  const sessionId = 'session-test';
  let store: ReturnType<typeof createDatabase>;

  beforeEach(() => {
    store = createDatabase({ type: 'mock' });
  });

  it('records and retrieves transparency events', async () => {
    await store.recordTransparencyEvent({
      sessionId,
      source: 'test',
      level: 'info',
      eventType: 'unit_test_event',
      message: 'Testing transparency logging',
      metadata: { foo: 'bar' },
    });

    const events = await store.getTransparencyEvents({ sessionId, limit: 10 });
    expect(events).toHaveLength(1);
    expect(events[0].message).toContain('Testing transparency logging');
  });

  it('upserts and fetches knowledge entries', async () => {
    await store.upsertKnowledgeEntry({
      id: 'kb-1',
      source: 'deepwiki',
      sessionId,
      title: 'Test Article',
      content: 'Example knowledge content',
      metadata: { rating: 5 },
    });

    const entries = await store.getKnowledgeEntries({ sessionId });
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe('Test Article');

    await store.upsertKnowledgeEntry({
      id: 'kb-1',
      source: 'deepwiki',
      sessionId,
      title: 'Updated Article',
      content: 'Updated content',
    });

    const updated = await store.getKnowledgeEntries({ sessionId });
    expect(updated[0].title).toBe('Updated Article');
    expect(updated[0].content).toBe('Updated content');
  });
});

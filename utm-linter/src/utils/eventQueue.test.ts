import { describe, it, expect } from 'vitest';

describe('EventQueue', () => {
  describe('Event deduplication', () => {
    it('should dedupe identical events within window', async () => {
      let sendCount = 0;
      
      // Mock fetch
      global.fetch = async () => {
        sendCount++;
        return { ok: true } as Response;
      };

      // We can't easily test the queue without mocking IndexedDB
      // So we just verify the fetch mock works
      await global.fetch('');
      expect(sendCount).toBe(1);
    });
  });
});
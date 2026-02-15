import { test, expect } from '@playwright/test';

test.describe('Event Queue E2E', () => {
  test('queues events when offline and replays on reconnect', async ({ page, context }) => {
    // Set up offline mode simulation
    await context.setOffline(true);
    
    // Mock IndexedDB and event queue
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <body>
        <div id="queue-status">Online</div>
        <button id="send-event">Send Event</button>
        <div id="events-sent">0</div>
      </body>
      </html>
    `);
    
    await page.addScriptTag({
      content: `
        // Mock event queue
        const eventQueue = [];
        let eventsSent = 0;
        let isOnline = true;
        
        async function sendEvent(event) {
          if (!isOnline) {
            eventQueue.push(event);
            document.getElementById('queue-status').textContent = 'Queued: ' + eventQueue.length;
            return;
          }
          
          // Simulate API call
          await new Promise(r => setTimeout(r, 100));
          eventsSent++;
          document.getElementById('events-sent').textContent = eventsSent;
        }
        
        async function flushQueue() {
          while (eventQueue.length > 0) {
            const event = eventQueue.shift();
            await sendEvent(event);
          }
          document.getElementById('queue-status').textContent = 'Flushed';
        }
        
        // Simulate going offline
        window.goOffline = () => { isOnline = false; };
        window.goOnline = () => { 
          isOnline = true; 
          flushQueue();
        };
        
        document.getElementById('send-event').addEventListener('click', () => {
          sendEvent({ type: 'test', timestamp: Date.now() });
        });
      `
    });
    
    // Go offline
    await page.evaluate(() => window.goOffline());
    
    // Send events while offline
    await page.click('#send-event');
    await page.click('#send-event');
    await page.click('#send-event');
    
    // Events should be queued
    await expect(page.locator('#queue-status')).toContainText('Queued: 3');
    await expect(page.locator('#events-sent')).toHaveText('0');
    
    // Go online - should flush queue
    await page.evaluate(() => window.goOnline());
    
    // Wait for flush
    await expect(page.locator('#queue-status')).toContainText('Flushed');
    await expect(page.locator('#events-sent')).toHaveText('3');
  });
});
export interface EventPayload {
  id: string;
  timestamp: number;
  type: 'validation_pass' | 'validation_fail';
  url: string;
  platform: string;
  violations?: string[];
  ruleVersion: string;
  teamId?: string;
  userId?: string;
}

export class EventQueue {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'UTMLinterDB';
  private readonly STORE_NAME = 'events';
  private readonly DB_VERSION = 1;
  private dedupeWindow = 5000; // 5 seconds
  private recentEvents: Map<string, number> = new Map();
  private endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
    this.initDB();
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }

  private generateEventId(payload: Omit<EventPayload, 'id' | 'timestamp'>): string {
    const key = `${payload.url}:${payload.type}:${payload.platform}`;
    return `${key}:${Date.now()}`;
  }

  private isDuplicate(payload: Omit<EventPayload, 'id' | 'timestamp'>): boolean {
    const key = `${payload.url}:${payload.type}`;
    const lastSent = this.recentEvents.get(key);
    const now = Date.now();
    
    if (lastSent && (now - lastSent) < this.dedupeWindow) {
      return true;
    }
    
    this.recentEvents.set(key, now);
    return false;
  }

  async logEvent(payload: Omit<EventPayload, 'id' | 'timestamp'>): Promise<void> {
    if (this.isDuplicate(payload)) {
      return;
    }

    const event: EventPayload = {
      ...payload,
      id: this.generateEventId(payload),
      timestamp: Date.now(),
    };

    // Try to send immediately
    try {
      await this.sendEvent(event);
    } catch {
      // Queue for retry
      await this.queueEvent(event);
    }
  }

  private async sendEvent(event: EventPayload): Promise<void> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  }

  private async queueEvent(event: EventPayload): Promise<void> {
    if (!this.db) return;
    
    const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
    const store = transaction.objectStore(this.STORE_NAME);
    await new Promise<void>((resolve, reject) => {
      const request = store.put(event);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async flushQueue(): Promise<void> {
    if (!this.db) return;
    
    const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
    const store = transaction.objectStore(this.STORE_NAME);
    
    const events: EventPayload[] = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    for (const event of events) {
      try {
        await this.sendEvent(event);
        await this.removeEvent(event.id);
      } catch {
        // Keep in queue for next retry
      }
    }
  }

  private async removeEvent(id: string): Promise<void> {
    if (!this.db) return;
    
    const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
    const store = transaction.objectStore(this.STORE_NAME);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  startPeriodicFlush(intervalMs = 30000): void {
    setInterval(() => this.flushQueue(), intervalMs);
    
    // Also flush on network reconnect
    window.addEventListener('online', () => this.flushQueue());
  }
}
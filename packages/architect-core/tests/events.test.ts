import { EventBus, architectEvents } from '../src/core/events.js';

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it('should subscribe and receive events', async () => {
    const received: string[] = [];
    bus.on('analysis.completed', (e) => { received.push(e.projectPath); });

    await bus.emit({
      type: 'analysis.completed',
      timestamp: new Date().toISOString(),
      projectPath: '/test',
      score: 80,
      antiPatternCount: 2,
    });

    expect(received).toEqual(['/test']);
  });

  it('should support multiple listeners', async () => {
    let count = 0;
    bus.on('analysis.completed', () => { count++; });
    bus.on('analysis.completed', () => { count++; });

    await bus.emit({
      type: 'analysis.completed',
      timestamp: new Date().toISOString(),
      projectPath: '/test',
      score: 80,
      antiPatternCount: 0,
    });

    expect(count).toBe(2);
  });

  it('should unsubscribe correctly', async () => {
    let count = 0;
    const unsub = bus.on('analysis.completed', () => { count++; });
    unsub();

    await bus.emit({
      type: 'analysis.completed',
      timestamp: new Date().toISOString(),
      projectPath: '/test',
      score: 80,
      antiPatternCount: 0,
    });

    expect(count).toBe(0);
  });

  it('should support once() for single-fire listeners', async () => {
    let count = 0;
    bus.once('analysis.completed', () => { count++; });

    await bus.emit({
      type: 'analysis.completed',
      timestamp: new Date().toISOString(),
      projectPath: '/test',
      score: 80,
      antiPatternCount: 0,
    });
    await bus.emit({
      type: 'analysis.completed',
      timestamp: new Date().toISOString(),
      projectPath: '/test2',
      score: 70,
      antiPatternCount: 1,
    });

    expect(count).toBe(1);
  });

  it('should not cross-fire between event types', async () => {
    const violations: string[] = [];
    const analyses: string[] = [];

    bus.on('violation.detected', (e) => { violations.push(e.violation.rule); });
    bus.on('analysis.completed', (e) => { analyses.push(e.projectPath); });

    await bus.emit({
      type: 'violation.detected',
      timestamp: new Date().toISOString(),
      projectPath: '/test',
      violation: { level: 'error', rule: 'min_score', message: 'too low' },
      context: { score: 40, antiPatternCount: 5 },
    });

    expect(violations).toEqual(['min_score']);
    expect(analyses).toEqual([]);
  });

  it('should handle async listeners', async () => {
    let resolved = false;
    bus.on('analysis.completed', async () => {
      await new Promise(r => setTimeout(r, 10));
      resolved = true;
    });

    await bus.emit({
      type: 'analysis.completed',
      timestamp: new Date().toISOString(),
      projectPath: '/test',
      score: 80,
      antiPatternCount: 0,
    });

    expect(resolved).toBe(true);
  });

  it('should catch sync listener errors without crashing', async () => {
    const originalError = console.error;
    const captured: any[] = [];
    console.error = (...args: any[]) => { captured.push(args); };

    bus.on('analysis.completed', () => { throw new Error('boom'); });

    await bus.emit({
      type: 'analysis.completed',
      timestamp: new Date().toISOString(),
      projectPath: '/test',
      score: 80,
      antiPatternCount: 0,
    });

    console.error = originalError;
    expect(captured.length).toBeGreaterThan(0);
    expect(captured[0][0]).toContain('[EventBus]');
    expect(captured[0][1]).toContain('boom');
  });

  it('should report listener count', () => {
    expect(bus.listenerCount('analysis.completed')).toBe(0);
    const unsub = bus.on('analysis.completed', () => {});
    expect(bus.listenerCount('analysis.completed')).toBe(1);
    unsub();
    expect(bus.listenerCount('analysis.completed')).toBe(0);
  });

  it('should clear all listeners', () => {
    bus.on('analysis.completed', () => {});
    bus.on('violation.detected', () => {});
    bus.clear();
    expect(bus.listenerCount('analysis.completed')).toBe(0);
    expect(bus.listenerCount('violation.detected')).toBe(0);
  });

  it('should clear listeners for a specific type', () => {
    bus.on('analysis.completed', () => {});
    bus.on('violation.detected', () => {});
    bus.clear('analysis.completed');
    expect(bus.listenerCount('analysis.completed')).toBe(0);
    expect(bus.listenerCount('violation.detected')).toBe(1);
  });
});

describe('architectEvents singleton', () => {
  afterEach(() => {
    architectEvents.clear();
  });

  it('should be a global EventBus instance', () => {
    expect(architectEvents).toBeInstanceOf(EventBus);
  });

  it('should persist across imports', async () => {
    let received = false;
    architectEvents.on('analysis.completed', () => { received = true; });

    await architectEvents.emit({
      type: 'analysis.completed',
      timestamp: new Date().toISOString(),
      projectPath: '/test',
      score: 85,
      antiPatternCount: 0,
    });

    expect(received).toBe(true);
  });
});

import pino from 'pino';

const logger = pino({ name: 'ip-manager' });

export interface IpEntry {
  address: string;
  weight: number;
  enabled: boolean;
  warmupDaysSinceStart: number;
  warmupStartDate: string;
  dailySendCount: number;
  dailyFailCount: number;
  lastSendAt: string | null;
  lastFailAt: string | null;
  lastResetDate: string;
}

export interface IpStats {
  address: string;
  weight: number;
  enabled: boolean;
  warmupDay: number;
  dailyLimit: number;
  dailySendCount: number;
  dailyFailCount: number;
  failureRate: number;
}

/**
 * Warmup schedule: maps day number to maximum daily sends.
 * After the ramp-up period, the IP is considered fully warmed.
 */
const WARMUP_SCHEDULE: Record<number, number> = {
  1: 50,
  2: 100,
  3: 200,
  4: 400,
  5: 800,
  6: 1500,
  7: 3000,
  8: 5000,
  9: 8000,
  10: 12000,
  11: 18000,
  12: 25000,
  13: 35000,
  14: 50000,
};

const FULLY_WARMED_DAY = 15;
const FAILURE_RATE_THRESHOLD = 0.15; // 15% failure rate triggers auto-failover

export class IpManager {
  private ips: Map<string, IpEntry> = new Map();
  private roundRobinIndex = 0;

  constructor(initialIps?: Array<{ address: string; weight?: number }>) {
    if (initialIps) {
      for (const ip of initialIps) {
        this.addIp(ip.address, ip.weight);
      }
    }

    // Load IPs from environment if available
    const envIps = process.env.SENDING_IPS;
    if (envIps && this.ips.size === 0) {
      for (const addr of envIps
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)) {
        this.addIp(addr);
      }
    }
  }

  /**
   * Add an IP address to the pool.
   */
  addIp(address: string, weight = 1): void {
    const today = new Date().toISOString().split('T')[0]!;

    this.ips.set(address, {
      address,
      weight,
      enabled: true,
      warmupDaysSinceStart: 1,
      warmupStartDate: today,
      dailySendCount: 0,
      dailyFailCount: 0,
      lastSendAt: null,
      lastFailAt: null,
      lastResetDate: today,
    });

    logger.info({ address, weight }, 'IP added to pool');
  }

  /**
   * Remove an IP address from the pool.
   */
  removeIp(address: string): boolean {
    const removed = this.ips.delete(address);
    if (removed) {
      logger.info({ address }, 'IP removed from pool');
    }
    return removed;
  }

  /**
   * Get the next IP address using weighted round-robin.
   * Skips disabled IPs and IPs that have exceeded their warmup daily limit.
   * Returns null if no IPs are available.
   */
  getNextIp(): string | null {
    const enabledIps = this.getEnabledIps();
    if (enabledIps.length === 0) {
      return null;
    }

    // Reset daily counters if needed
    this.resetDailyCountersIfNeeded();

    // Build weighted list
    const weightedList: string[] = [];
    for (const ip of enabledIps) {
      const dailyLimit = this.getDailyLimit(ip);
      if (ip.dailySendCount < dailyLimit) {
        for (let i = 0; i < ip.weight; i++) {
          weightedList.push(ip.address);
        }
      }
    }

    if (weightedList.length === 0) {
      logger.warn('All IPs have reached their daily warmup limit');
      return null;
    }

    const selected = weightedList[this.roundRobinIndex % weightedList.length]!;
    this.roundRobinIndex = (this.roundRobinIndex + 1) % weightedList.length;

    return selected;
  }

  /**
   * Record a send attempt for an IP (success or failure).
   */
  recordSend(address: string, success: boolean): void {
    const ip = this.ips.get(address);
    if (!ip) return;

    ip.dailySendCount++;
    ip.lastSendAt = new Date().toISOString();

    if (!success) {
      ip.dailyFailCount++;
      ip.lastFailAt = new Date().toISOString();

      // Check failure rate for auto-failover
      const failureRate =
        ip.dailySendCount > 0 ? ip.dailyFailCount / ip.dailySendCount : 0;
      if (failureRate > FAILURE_RATE_THRESHOLD && ip.dailySendCount >= 10) {
        logger.warn(
          {
            address,
            failureRate,
            sends: ip.dailySendCount,
            fails: ip.dailyFailCount,
          },
          'IP failure rate exceeded threshold, disabling',
        );
        ip.enabled = false;
      }
    }
  }

  /**
   * Re-enable a previously disabled IP.
   */
  enableIp(address: string): boolean {
    const ip = this.ips.get(address);
    if (!ip) return false;

    ip.enabled = true;
    ip.dailyFailCount = 0;
    logger.info({ address }, 'IP re-enabled');
    return true;
  }

  /**
   * List all IPs with their current stats.
   */
  listIps(): IpStats[] {
    this.resetDailyCountersIfNeeded();

    return Array.from(this.ips.values()).map((ip) => ({
      address: ip.address,
      weight: ip.weight,
      enabled: ip.enabled,
      warmupDay: this.getWarmupDay(ip),
      dailyLimit: this.getDailyLimit(ip),
      dailySendCount: ip.dailySendCount,
      dailyFailCount: ip.dailyFailCount,
      failureRate:
        ip.dailySendCount > 0 ? ip.dailyFailCount / ip.dailySendCount : 0,
    }));
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private getEnabledIps(): IpEntry[] {
    return Array.from(this.ips.values()).filter((ip) => ip.enabled);
  }

  private getWarmupDay(ip: IpEntry): number {
    const startDate = new Date(ip.warmupStartDate);
    const now = new Date();
    const diffMs = now.getTime() - startDate.getTime();
    return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  private getDailyLimit(ip: IpEntry): number {
    const day = this.getWarmupDay(ip);
    if (day >= FULLY_WARMED_DAY) {
      return Infinity;
    }
    return WARMUP_SCHEDULE[day] ?? 50;
  }

  private resetDailyCountersIfNeeded(): void {
    const today = new Date().toISOString().split('T')[0]!;

    for (const ip of this.ips.values()) {
      if (ip.lastResetDate !== today) {
        ip.dailySendCount = 0;
        ip.dailyFailCount = 0;
        ip.lastResetDate = today;
        ip.warmupDaysSinceStart = this.getWarmupDay(ip);
      }
    }
  }
}

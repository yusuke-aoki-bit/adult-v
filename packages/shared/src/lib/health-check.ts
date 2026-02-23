const startTime = Date.now();

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  version: string;
  site: string;
  checks: {
    database: { status: 'ok' | 'error'; latencyMs?: number; error?: string };
    memory: { status: 'ok' | 'warning'; usedMB: number; totalMB: number; percentage: number };
  };
}

export async function performHealthCheck(
  siteMode: string,
  checkDatabase: () => Promise<{ ok: boolean; latencyMs: number }>,
): Promise<HealthCheckResult> {
  const memUsage = process.memoryUsage();
  const totalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  const usedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const percentage = Math.round((usedMB / totalMB) * 100);

  let dbCheck: HealthCheckResult['checks']['database'];
  try {
    const result = await checkDatabase();
    dbCheck = result.ok
      ? { status: 'ok', latencyMs: result.latencyMs }
      : { status: 'error', error: 'Connection failed' };
  } catch (e) {
    dbCheck = { status: 'error', error: e instanceof Error ? e.message : 'Unknown error' };
  }

  const memoryStatus = percentage > 90 ? 'warning' : 'ok';
  const overallStatus: HealthStatus =
    dbCheck.status === 'error' ? 'unhealthy' : memoryStatus === 'warning' ? 'degraded' : 'healthy';

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.round((Date.now() - startTime) / 1000),
    version: '0.1.0',
    site: siteMode,
    checks: {
      database: dbCheck,
      memory: { status: memoryStatus, usedMB, totalMB, percentage },
    },
  };
}

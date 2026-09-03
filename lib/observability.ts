export type LifecycleLogLevel = "info" | "warn" | "error";

export function logLifecycle(
  level: LifecycleLogLevel,
  event: string,
  stage: string,
  network: string,
  errorClass?: string,
): void {
  const payload = JSON.stringify({
    event,
    stage,
    network,
    ...(errorClass ? { errorClass } : {}),
  });
  console[level](payload);
}
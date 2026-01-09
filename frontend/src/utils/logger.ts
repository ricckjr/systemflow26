export const logInfo = (scope: string, message: string, extra?: any) => {
  const ts = new Date().toISOString()
  if (extra !== undefined) console.info(`[${ts}] [${scope}] ${message}`, extra)
  else console.info(`[${ts}] [${scope}] ${message}`)
}

export const logWarn = (scope: string, message: string, extra?: any) => {
  const ts = new Date().toISOString()
  if (extra !== undefined) console.warn(`[${ts}] [${scope}] ${message}`, extra)
  else console.warn(`[${ts}] [${scope}] ${message}`)
}

export const logError = (scope: string, message: string, extra?: any) => {
  const ts = new Date().toISOString()
  if (extra !== undefined) console.error(`[${ts}] [${scope}] ${message}`, extra)
  else console.error(`[${ts}] [${scope}] ${message}`)
}

export const withTiming = async <T>(scope: string, label: string, fn: () => Promise<T>) => {
  const start = performance.now()
  try {
    const result = await fn()
    const end = performance.now()
    logInfo(scope, `${label} ok in ${(end - start).toFixed(0)}ms`)
    return result
  } catch (e: any) {
    const end = performance.now()
    logError(scope, `${label} failed in ${(end - start).toFixed(0)}ms`, e)
    throw e
  }
}

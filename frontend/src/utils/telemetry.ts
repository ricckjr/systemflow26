import { supabase } from '@/services/supabase';

/**
 * Wraps a Supabase query with performance logging.
 * Logs warnings to console if query execution time exceeds threshold.
 * 
 * @param name Query identifier (e.g., 'fetchOportunidades')
 * @param queryPromise The promise returned by supabase.from(...).select(...)
 * @param thresholdMs Time in ms to consider a query "slow" (default: 500ms)
 */
export async function traceQuery<T>(
  name: string,
  queryPromise: PromiseLike<{ data: T | null; error: any }>,
  thresholdMs = 500
): Promise<{ data: T | null; error: any }> {
  const start = performance.now();
  
  try {
    const result = await queryPromise;
    const end = performance.now();
    const duration = end - start;

    if (duration > thresholdMs) {
      console.warn(
        `%c[Slow Query] ${name} took ${duration.toFixed(2)}ms`, 
        'color: #f59e0b; font-weight: bold;'
      );
      // Future: Insert into system_logs table
    } else {
        // Optional: Debug log for all queries
        // console.debug(`[Query] ${name} took ${duration.toFixed(2)}ms`);
    }

    return result;
  } catch (err) {
    const end = performance.now();
    console.error(`[Query Error] ${name} failed after ${(end - start).toFixed(2)}ms`, err);
    throw err;
  }
}

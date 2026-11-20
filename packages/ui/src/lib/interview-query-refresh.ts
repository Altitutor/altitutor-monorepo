/** The small QueryClient surface needed by interview read coordination. */
interface InterviewQuery {
  queryKey: readonly unknown[];
  state: { fetchStatus: string };
  isActive(): boolean;
}
interface InterviewQueryClient {
  getQueryCache(): { findAll(filters: { queryKey: readonly unknown[]; exact?: boolean }): InterviewQuery[] };
  invalidateQueries(filters: { queryKey: readonly unknown[]; exact: true }, options: { cancelRefetch: false }): Promise<void>;
}
interface Waiter {
  revision: number;
  resolve(): void;
  reject(error: unknown): void;
}
interface Refresh {
  requested: number;
  completed: number;
  waiters: Waiter[];
}
const owners = new WeakMap<object, Map<InterviewQuery, Refresh>>();

/**
 * Keep one HTTP read running per actual cache entry, then read again for changes
 * received after that read began. Each caller awaits its own freshness barrier,
 * not every later broadcast, so continuous activity cannot hold a saved action.
 * Query identity includes the actor key and is invalidated by cache removal.
 */
export function refreshInterviewQueries(client: InterviewQueryClient, prefix: readonly unknown[]): Promise<void> {
  let entries = owners.get(client);
  if (!entries) { entries = new Map(); owners.set(client, entries); }
  const refreshes = entries;
  return Promise.all(client.getQueryCache().findAll({ queryKey: prefix }).map((query) => {
    let entry = refreshes.get(query);
    if (entry) {
      const pending = entry;
      const revision = ++pending.requested;
      return new Promise<void>((resolve, reject) => pending.waiters.push({ revision, resolve, reject }));
    }
    entry = { requested: 1, completed: 0, waiters: [] };
    const pending = entry;
    const result = new Promise<void>((resolve, reject) => pending.waiters.push({ revision: 1, resolve, reject }));
    refreshes.set(query, pending);
    const present = () => client.getQueryCache().findAll({ queryKey: query.queryKey, exact: true }).includes(query);
    const drain = async () => {
      try {
        // A fetch already underway started before this request's freshness
        // barrier. Join it without cancelling, then take a fresh trailing read.
        let joining = query.state.fetchStatus === "fetching";
        while (pending.completed < pending.requested) {
          if (!present()) break;
          const revision = joining && query.isActive() ? pending.completed : pending.requested;
          await client.invalidateQueries({ queryKey: query.queryKey, exact: true }, { cancelRefetch: false });
          joining = false;
          pending.completed = revision;
          const completed = pending.waiters.filter((waiter) => waiter.revision <= revision);
          pending.waiters = pending.waiters.filter((waiter) => waiter.revision > revision);
          completed.forEach((waiter) => waiter.resolve());
        }
        pending.waiters.forEach((waiter) => waiter.resolve());
      } catch (error) {
        pending.waiters.forEach((waiter) => waiter.reject(error));
      } finally {
        refreshes.delete(query);
      }
    };
    void drain();
    return result;
  })).then(() => undefined);
}

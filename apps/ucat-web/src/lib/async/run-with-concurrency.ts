type AsyncTask = () => PromiseLike<unknown>;
type TaskResults<Tasks extends readonly AsyncTask[]> = {
  -readonly [Index in keyof Tasks]: Awaited<ReturnType<Tasks[Index]>>;
};

export async function runWithConcurrency<
  const Tasks extends readonly AsyncTask[],
>(tasks: Tasks, concurrency: number): Promise<TaskResults<Tasks>> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("Concurrency must be a positive integer");
  }

  const results: unknown[] = new Array(tasks.length);
  let nextIndex = 0;
  let failed = false;
  let failure: unknown;
  const worker = async () => {
    while (!failed && nextIndex < tasks.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = await tasks[index]!();
      } catch (error) {
        failed = true;
        failure = error;
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, worker),
  );
  if (failed) {
    throw failure;
  }
  return results as TaskResults<Tasks>;
}

/** Fisher–Yates sample of up to `limit` items without replacement. */
export function sampleWithoutReplacement<T>(items: T[], limit: number): T[] {
  if (items.length === 0 || limit <= 0) return []
  const copy = [...items]
  const sampleSize = Math.min(limit, copy.length)
  for (let index = 0; index < sampleSize; index += 1) {
    const swapIndex = index + Math.floor(Math.random() * (copy.length - index))
    const current = copy[index]
    copy[index] = copy[swapIndex] as T
    copy[swapIndex] = current as T
  }
  return copy.slice(0, sampleSize)
}

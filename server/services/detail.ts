import type { SourceID } from "@shared/types"
import { getCacheTable } from "#/database/cache"
import { detailGetters } from "#/getters-detail"
import { runWithSourceRequestContext } from "#/utils/source-context"

const FAILED_DETAIL_RETRY_MS = 30 * 60 * 1000
const failedDetailAt = new Map<string, number>()

export async function fetchSourceDetails(id: SourceID, _force = false) {
  if (!sources[id]?.detail) return { success: false, reason: "detail disabled" }

  const cacheTable = await getCacheTable()
  if (!cacheTable) return { success: false, reason: "cache disabled" }

  const cache = await cacheTable.get(id)
  if (!cache?.items?.length) return { success: false, reason: "cache not found" }

  const getter = detailGetters[id]
  if (!getter) {
    await cacheTable.setDetail(id, cache.items)
    return { success: false, reason: "detail getter not found" }
  }

  let hasUpdate = false
  const items = [...cache.items]
  const pending = items.filter((item) => {
    if (item.content?.trim()) return false
    if (_force) return true
    const failedAt = failedDetailAt.get(`${id}:${item.id}`)
    return !failedAt || Date.now() - failedAt >= FAILED_DETAIL_RETRY_MS
  })
  let next = 0
  await Promise.all(Array.from({ length: Math.min(4, pending.length) }, async () => {
    while (next < pending.length) {
      const item = pending[next++]
      const key = `${id}:${item.id}`
      try {
        const content = (await runWithSourceRequestContext({
          id,
          robots: sources[id]?.robots,
        }, () => getter(item, id)))?.trim()
        if (content) {
          item.content = content
          hasUpdate = true
          failedDetailAt.delete(key)
        } else {
          failedDetailAt.set(key, Date.now())
        }
      } catch (e) {
        failedDetailAt.set(key, Date.now())
        logger.error(`detail fetch failed for ${id}`, e)
      }
    }
  }))

  await cacheTable.setDetail(id, items)
  return { success: true, updated: hasUpdate, items }
}

import type { SourceID } from "@shared/types"
import { getCacheTable } from "#/database/cache"
import { detailGetters } from "#/getters-detail"

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
  for (const item of items) {
    if (item.content?.trim()) continue
    try {
      const content = (await getter(item, id))?.trim()
      if (content) {
        item.content = content
        hasUpdate = true
      }
    } catch (e) {
      logger.error(`detail fetch failed for ${id}`, e)
    }
  }

  await cacheTable.setDetail(id, items)
  return { success: true, updated: hasUpdate, items }
}

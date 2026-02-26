import type { SourceID, SourceResponse } from "@shared/types"
import { getters } from "#/getters"
import { getCacheTable } from "#/database/cache"
import { detailGetters } from "#/getters-detail"
import { fetchSourceDetails } from "#/services/detail"
import type { CacheInfo } from "#/types"

export default defineEventHandler(async (event): Promise<SourceResponse> => {
  try {
    const query = getQuery(event)
    const latest = query.latest !== undefined && query.latest !== "false"
    const withDetail = query.withDetail !== undefined && query.withDetail !== "false"
    let id = query.id as SourceID
    const isValid = (id: SourceID) => !id || !sources[id] || !getters[id]

    if (isValid(id)) {
      const redirectID = sources?.[id]?.redirect
      if (redirectID) id = redirectID
      if (isValid(id)) throw new Error("Invalid source id")
    }

    const triggerDetailFetch = () => {
      if (!sources[id]?.detail) return
      if (!detailGetters[id]) return
      const task = fetchSourceDetails(id).catch(e => logger.error(`detail fetch task failed: ${id}`, e))
      if (event.context.waitUntil) event.context.waitUntil(task)
      else void task
    }

    const maybeAttachDetail = async (items: CacheInfo["items"]) => {
      if (!withDetail || !sources[id]?.detail || !items?.length) return items
      if (!items.some(item => !item.content?.trim())) return items
      try {
        const result = await fetchSourceDetails(id)
        if (result.success && result.items) return result.items
      } catch (err) {
        logger.error(`detail fetch immediate failed: ${id}`, err)
      }
      return items
    }

    let cache: CacheInfo | undefined

    const reuseCachedContent = (items: CacheInfo["items"]) => {
      if (!cache?.items?.length) return items
      const cachedWithContent = cache.items.filter(item => item.content?.trim())
      if (!cachedWithContent.length) return items
      const cachedById = new Map<string, string>()
      const cachedByUrl = new Map<string, string>()
      for (const cachedItem of cachedWithContent) {
        const content = cachedItem.content!
        if (cachedItem.id !== undefined) cachedById.set(String(cachedItem.id), content)
        if (cachedItem.url) cachedByUrl.set(cachedItem.url, content)
      }
      return items.map((item) => {
        if (item.content?.trim()) return item
        const content = (item.id !== undefined ? cachedById.get(String(item.id)) : undefined) || (item.url ? cachedByUrl.get(item.url) : undefined)
        return content ? { ...item, content } : item
      })
    }

    const cacheTable = await getCacheTable()
    // Date.now() in Cloudflare Worker will not update throughout the entire runtime.
    const now = Date.now()
    if (cacheTable) {
      cache = await cacheTable.get(id)
      if (cache) {
      // if (cache) {
        // interval 刷新间隔，对于缓存失效也要执行的。本质上表示本来内容更新就很慢，这个间隔内可能内容压根不会更新。
        // 默认 10 分钟，是低于 TTL 的，但部分 Source 的更新间隔会超过 TTL，甚至有的一天更新一次。
        if (now - cache.updated < sources[id].interval) {
          if (!withDetail) triggerDetailFetch()
          return {
            status: "success",
            id,
            updatedTime: now,
            items: await maybeAttachDetail(cache.items),
          }
        }

        // 而 TTL 缓存失效时间，在时间范围内，就算内容更新了也要用这个缓存。
        // 复用缓存是不会更新时间的。
        if (now - cache.updated < TTL) {
          // 有 latest
          // 没有 latest，但服务器禁止登录

          // 没有 latest
          // 有 latest，服务器可以登录但没有登录
          if (!latest || (!event.context.disabledLogin && !event.context.user)) {
            if (!withDetail) triggerDetailFetch()
            return {
              status: "cache",
              id,
              updatedTime: cache.updated,
              items: await maybeAttachDetail(cache.items),
            }
          }
        }
      }
    }

    try {
      const newData = reuseCachedContent((await getters[id]()).slice(0, 30))
      if (cacheTable && newData.length) {
        if (withDetail || !event.context.waitUntil) await cacheTable.set(id, newData)
        else event.context.waitUntil(cacheTable.set(id, newData))
      }
      if (!withDetail) triggerDetailFetch()
      logger.success(`fetch ${id} latest`)
      return {
        status: "success",
        id,
        updatedTime: now,
        items: await maybeAttachDetail(newData),
      }
    } catch (e) {
      if (cache) {
        if (!withDetail) triggerDetailFetch()
        return {
          status: "cache",
          id,
          updatedTime: cache.updated,
          items: await maybeAttachDetail(cache.items),
        }
      } else {
        throw e
      }
    }
  } catch (e: any) {
    logger.error(e)
    throw createError({
      statusCode: 500,
      message: e instanceof Error ? e.message : "Internal Server Error",
    })
  }
})

import { createError, defineEventHandler, getQuery, setResponseHeader } from "h3"
import type { SourceID, SourceResponse } from "@shared/types"
import { sources } from "@shared/sources"
import { TTL } from "#/consts"
import { getters } from "#/getters"
import { getCacheTable } from "#/database/cache"
import { detailGetters } from "#/getters-detail"
import { fetchSourceDetails } from "#/services/detail"
import type { CacheInfo } from "#/types"
import { jsonToAtom, jsonToRSS } from "#/utils/feed"
import { logger } from "#/utils/logger"
import { runWithSourceRequestContext } from "#/utils/source-context"

const info = {
  LICENCE: "MIT",
  Github: "https://github.com/ourongxing/newsnow",
  Sponsorship: "If you rely on this service, sponsorship is welcome to help it run for the long term. Scan the QR code https://raw.githubusercontent.com/ourongxing/newsnow/main/screenshots/reward.gif",
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const latest = query.latest !== undefined && query.latest !== "false"
    const withDetail = query.withDetail !== undefined && query.withDetail !== "false"
    const format = query.format || "json"
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
      // 同时复用 content 与 pubDate (detail getter 可能只写入其中一个)
      const cachedWithContent = cache.items.filter(item => item.content?.trim() || item.pubDate)
      if (!cachedWithContent.length) return items
      const cachedById = new Map<string, { content?: string, pubDate?: number | string }>()
      const cachedByUrl = new Map<string, { content?: string, pubDate?: number | string }>()
      for (const cachedItem of cachedWithContent) {
        const fields: { content?: string, pubDate?: number | string } = {}
        if (cachedItem.content?.trim()) fields.content = cachedItem.content
        if (cachedItem.pubDate) fields.pubDate = cachedItem.pubDate
        if (!fields.content && !fields.pubDate) continue
        if (cachedItem.id !== undefined) cachedById.set(String(cachedItem.id), fields)
        if (cachedItem.url) cachedByUrl.set(cachedItem.url, fields)
      }
      return items.map((item) => {
        if (item.content?.trim() && item.pubDate) return item
        const cached = (item.id !== undefined ? cachedById.get(String(item.id)) : undefined)
          || (item.url ? cachedByUrl.get(item.url) : undefined)
        if (!cached) return item
        return {
          ...item,
          ...(cached.content && !item.content?.trim() ? { content: cached.content } : {}),
          ...(cached.pubDate && !item.pubDate ? { pubDate: cached.pubDate } : {}),
        }
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
          // latest=true (前端手动刷新) 时强制重新抓取, 不复用缓存
          if (!latest) {
            if (!withDetail) triggerDetailFetch()

            if (format === "rss") {
              setResponseHeader(event, "Content-Type", "application/rss+xml; charset=utf-8")
              return jsonToRSS({
                status: "success",
                id,
                updatedTime: cache.updated,
                items: cache.items,
              })
            } else if (format === "atom") {
              setResponseHeader(event, "Content-Type", "application/atom+xml; charset=utf-8")
              return jsonToAtom({
                status: "success",
                id,
                updatedTime: cache.updated,
                items: cache.items,
              })
            }
            return {
              status: "success",
              id,
              updatedTime: cache.updated,
              items: await maybeAttachDetail(cache.items),
              info,
            }
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
            if (format === "rss") {
              setResponseHeader(event, "Content-Type", "application/rss+xml; charset=utf-8")
              return jsonToRSS({
                status: "cache",
                id,
                updatedTime: cache.updated,
                items: cache.items,
              })
            } else if (format === "atom") {
              setResponseHeader(event, "Content-Type", "application/atom+xml; charset=utf-8")
              return jsonToAtom({
                status: "cache",
                id,
                updatedTime: cache.updated,
                items: cache.items,
              })
            }
            return {
              status: "cache",
              id,
              updatedTime: cache.updated,
              items: await maybeAttachDetail(cache.items),
              info,
            }
          }
        }
      }
    }

    try {
      const newData = reuseCachedContent((await runWithSourceRequestContext({
        id,
        robots: sources[id]?.robots,
      }, () => getters[id]())).slice(0, 30))
      if (cacheTable && newData.length) {
        if (withDetail || !event.context.waitUntil) await cacheTable.set(id, newData)
        else event.context.waitUntil(cacheTable.set(id, newData))
      }
      if (!withDetail) triggerDetailFetch()
      const items = withDetail ? await maybeAttachDetail(newData) : newData
      logger.success(`fetch ${id} latest`)
      const response: SourceResponse = {
        status: "success",
        id,
        updatedTime: now,
        items,
        info,
      }
      if (format === "rss") {
        setResponseHeader(event, "Content-Type", "application/rss+xml; charset=utf-8")
        return jsonToRSS(response)
      } else if (format === "atom") {
        setResponseHeader(event, "Content-Type", "application/atom+xml; charset=utf-8")
        return jsonToAtom(response)
      }
      return response
    } catch (e) {
      if (cache) {
        if (!withDetail) triggerDetailFetch()
        if (format === "rss") {
          setResponseHeader(event, "Content-Type", "application/rss+xml; charset=utf-8")
          return jsonToRSS({
            status: "cache",
            id,
            updatedTime: cache.updated,
            items: cache.items,
          })
        } else if (format === "atom") {
          setResponseHeader(event, "Content-Type", "application/atom+xml; charset=utf-8")
          return jsonToAtom({
            status: "cache",
            id,
            updatedTime: cache.updated,
            items: cache.items,
          })
        }
        return {
          status: "cache",
          id,
          updatedTime: cache.updated,
          items: await maybeAttachDetail(cache.items),
          info,
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

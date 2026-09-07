import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { flareFetch } from "#/utils/flaresolverr"
import { googleNewsFallback } from "#/utils/gnews"
import { normalizeText } from "#/utils/banner"

const PAGE_URL = "https://ffc.fr/ressources/"

interface WordPressPost {
  id: number
  date: string
  link: string
  title: { rendered: string }
  excerpt: { rendered: string }
}

function textFromHtml(html?: string) {
  return normalizeText(load(html || "").text())
}

// CloakBrowser 渲染的纯 JSON/XML 响应会被 Chromium 包在 <pre> 里, 先提取出来
function extractPayload(content: string) {
  if (/^\s*<(?:!doctype html|html)/i.test(content)) {
    const pre = load(content)("body pre").first().text()
    if (pre.trim()) return pre
  }
  return content
}

// FFC 多站点(WordPress multisite), 子站各自有 wp-json
// 部分网络环境直连子站超时(疑似地域限制), 失败依次回退 Google News RSS / CloakBrowser
function makeFfcNewsSource(baseUrl: string, gnewsSite: string) {
  return defineSource(async () => {
    const api = `${baseUrl}/wp-json/wp/v2/posts?per_page=30&_fields=id,date,link,title,excerpt`
    let posts: WordPressPost[]
    try {
      posts = await myFetch(api)
    } catch {
      try {
        return await googleNewsFallback(gnewsSite, {
          locale: { hl: "fr", gl: "FR", ceid: "FR:fr" },
          when: "90d",
          maxAgeDays: 120,
          exclude: /^nos actualit/i,
        })
      } catch {
        const html: string = await flareFetch(api)
        posts = JSON.parse(extractPayload(html))
      }
    }
    return posts.map(post => ({
      id: post.id,
      title: textFromHtml(post.title?.rendered),
      url: post.link,
      pubDate: new Date(post.date).getTime(),
      extra: {
        hover: textFromHtml(post.excerpt?.rendered) || undefined,
      },
    }))
  })
}

const resources = defineSource(async () => {
  const html: string = await myFetch(PAGE_URL)
  const $ = load(html)

  return $("a.card-resource[href]").map((_, element): NewsItem | null => {
    const card = $(element)
    const href = card.attr("href")?.trim()
    const title = normalizeText(card.find("h3").first().text())
    if (!href || !title) return null
    const date = card.find("time[datetime]").attr("datetime")
    const pubDate = date ? new Date(`${date.replace(" ", "T")}+02:00`).getTime() : undefined
    const info = normalizeText(card.find(".category").first().text())
    const url = new URL(href, PAGE_URL).toString()

    return {
      id: url,
      title,
      url,
      pubDate: Number.isFinite(pubDate) ? pubDate : undefined,
      extra: { info: info || undefined },
    }
  }).get().filter((item): item is NewsItem => Boolean(item))
})

export default defineSource({
  "ffc-resources": resources,
  "ffc-structures": makeFfcNewsSource("https://structures.ffc.fr", "structures.ffc.fr"),
  "ffc-velo": makeFfcNewsSource("https://velo.ffc.fr", "velo.ffc.fr"),
})

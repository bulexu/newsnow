import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"
import { normalizeText } from "#/utils/banner"

const BASE_URL = "https://www.sport.gov.cn"

interface Attachment {
  name: string
  url: string
}

// 站内链接多为 ../ 相对路径, toAbsoluteUrl 不处理 ../, 用 new URL 解析
function resolveUrl(href: string, base: string) {
  try {
    return new URL(href, base).href
  } catch {
    return toAbsoluteUrl(href, BASE_URL, base)
  }
}

function makeSportSource(path: string) {
  return defineSource(async () => {
    const listUrl = `${BASE_URL}${path}`
    const html: string = await myFetch(listUrl)
    const $ = load(html)
    const news: NewsItem[] = []
    const seen = new Set<string>()

    // 对应 XPath: //ul[@class='newslist']//li
    $("ul.newslist li").each((_, el) => {
      const $li = $(el)
      const $a = $li.find("a[href]").first()
      const href = $a.attr("href") || ""
      if (!href) return

      // href 形如 "../../n315/n20001395/c29789799/content.html", 相对列表页解析
      const url = resolveUrl(href, listUrl)
      if (seen.has(url)) return
      seen.add(url)

      const title = normalizeText($a.attr("title") || $a.text())
      if (!title) return

      // 列表日期仅 "07-22" 无年份, 不写入; 精确日期由 detail getter 从详情页写入
      const idMatch = url.match(/c(\d+)\/content\.html$/)
      const id = idMatch ? idMatch[1] : url

      news.push({
        id,
        title,
        url,
      })
    })

    return news
  })
}

function makeSportSourceDetail() {
  return async (item: NewsItem) => {
    if (!item?.url) return undefined
    const html: string = await myFetch(item.url)
    const $ = load(html)

    // 发布时间: <meta name="PubDate" content="2026-07-22">
    const pubDateStr = normalizeText($("meta[name='PubDate']").attr("content"))
    if (/^\d{4}-\d{2}-\d{2}$/.test(pubDateStr)) {
      const ts = new Date(`${pubDateStr}T00:00:00+08:00`).getTime()
      if (Number.isFinite(ts)) {
        item.pubDate = ts
      }
    }

    // 对应 XPath: //div[@id='zoom']
    const body = $("#zoom").first()
    if (!body.length) return undefined

    // 附件: 对应 XPath //div[@id='zoom']//a[@target='_blank'], 按 URL 去重
    // href 形如 "../../../n315/n20001395/c29767745/part/29767755.docx", 相对文章页解析
    const attachments: Attachment[] = []
    const seenUrl = new Set<string>()
    body.find("a[target='_blank'][href]").each((_, el) => {
      const $a = $(el)
      const href = $a.attr("href") || ""
      if (!href || href.startsWith("javascript")) return
      const abs = resolveUrl(href, item.url)
      if (seenUrl.has(abs)) return
      seenUrl.add(abs)
      const name = normalizeText($a.text())
      attachments.push({
        name: name || abs.split("/").pop() || abs,
        url: abs,
      })
    })

    // 移除含附件锚点的整段, 附件单独列出
    body.find("a[target='_blank']").each((_, el) => {
      const $p = $(el).closest("p")
      if ($p.length) $p.remove()
      else $(el).remove()
    })
    // 移除 打印/关闭 等 javascript 工具链接
    body.find("a[href^='javascript']").remove()
    body.find("script,style").remove()
    body.find("[href]").each((_, el) => {
      const href = $(el).attr("href")
      if (href) $(el).attr("href", resolveUrl(href, item.url))
    })
    body.find("img[src]").each((_, el) => {
      const src = $(el).attr("src")
      if (src) $(el).attr("src", resolveUrl(src, item.url))
    })

    let markdown = html2md(body.html() || "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()

    if (!markdown) return undefined

    if (attachments.length) {
      const attachMd = attachments
        .map(att => `- [${att.name}](${att.url})`)
        .join("\n")
      markdown += `\n\n**附件：**\n${attachMd}`
    }

    return item.title ? `## ${item.title}\n\n${markdown}` : markdown
  }
}

const tzgg = makeSportSource("/n315/n20001395/index.html")
const tzggDetail = makeSportSourceDetail()

export const details = defineSourceDetail({
  "sport-tzgg": tzggDetail,
})

export default defineSource({
  "sport-tzgg": tzgg,
})

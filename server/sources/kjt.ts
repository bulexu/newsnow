import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"
import { normalizeText } from "#/utils/banner"

const BASE_URL = "https://cloud.kjt.shandong.gov.cn"

interface Attachment {
  name: string
  url: string
}

function makeKjtSource(path: string) {
  return defineSource(async () => {
    const html: string = await myFetch(`${BASE_URL}${path}`)
    const $ = load(html)
    const news: NewsItem[] = []
    const seen = new Set<string>()

    // 对应 XPath: //div[@class='notice_main']//div[@class='tzggList']//div[@class='listItems']
    $("div.notice_main div.tzggList div.listItems").each((_, el) => {
      const $item = $(el)
      const $a = $item.find("div.listItemsR a[href]").first()
      const href = $a.attr("href") || ""
      if (!href) return

      const url = href.startsWith("http") ? href : toAbsoluteUrl(href, BASE_URL)
      if (seen.has(url)) return
      seen.add(url)

      // 标题优先取 title 属性, 回退到锚文本
      const title = normalizeText($a.attr("title") || $a.text())
      if (!title) return

      const desc = normalizeText($item.find("p.listItemsContent").text())
      const author = normalizeText($item.find("div.pageAuthor").text())

      // URL 形如 /newportal/articles/ch00018/202412/{uuid}.shtml
      const idMatch = url.match(/\/([0-9a-f-]{36})\.shtml$/)
      const id = idMatch ? idMatch[1] : url

      news.push({
        id,
        title,
        url,
        // 列表日期分散在多个元素中; 精确发布时间由 detail getter 从详情页写入
        extra: {
          hover: desc || undefined,
          info: author || undefined,
        },
      })
    })

    return news
  })
}

function makeKjtSourceDetail() {
  return async (item: NewsItem) => {
    if (!item?.url) return undefined
    const html: string = await myFetch(item.url)
    const $ = load(html)

    // 发布时间: 对应 XPath //div[@class='wzMain']//div[@class='conDetail1']//span[@class='detail_info'][1]
    // 形如 "2024-12-19 15:52", 站点为北京时间 (UTC+8)
    const timeText = normalizeText($("div.wzMain div.conDetail1 span.detail_info").first().text())
    const timeMatch = timeText.match(/(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2})/)
    if (timeMatch) {
      const iso = `${timeMatch[1]}-${timeMatch[2].padStart(2, "0")}-${timeMatch[3].padStart(2, "0")}`
        + `T${timeMatch[4].padStart(2, "0")}:${timeMatch[5].padStart(2, "0")}:00+08:00`
      const ts = new Date(iso).getTime()
      if (Number.isFinite(ts)) {
        item.pubDate = ts
      }
    }

    // 正文: 对应 XPath //div[@class='wzMain']//div[@class='conContent']
    const body = $("div.wzMain div.conContent").first()
    if (!body.length) return undefined

    // 附件: 对应 XPath ...//div[@class='conContent']//a[contains(@href, '/resource')], 按 URL 去重
    // a[title] 固定为 "点击下载附件", 文件名取锚文本
    const attachments: Attachment[] = []
    const seenUrl = new Set<string>()
    body.find("a[href*='/resource']").each((_, el) => {
      const $a = $(el)
      const href = $a.attr("href") || ""
      if (!href) return
      const abs = toAbsoluteUrl(href, BASE_URL, item.url)
      if (seenUrl.has(abs)) return
      seenUrl.add(abs)
      const name = normalizeText($a.text())
      attachments.push({
        name: name || abs.split("/").pop() || abs,
        url: abs,
      })
    })

    body.find("a[href*='/resource']").remove()
    body.find("script,style").remove()
    body.find("[href]").each((_, el) => {
      const href = $(el).attr("href")
      if (href) $(el).attr("href", toAbsoluteUrl(href, BASE_URL, item.url))
    })
    body.find("img[src]").each((_, el) => {
      const src = $(el).attr("src")
      if (src) $(el).attr("src", toAbsoluteUrl(src, BASE_URL, item.url))
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

const tzgg = makeKjtSource("/newportal/channels/ch00018/")
const tzggDetail = makeKjtSourceDetail()

export const details = defineSourceDetail({
  "kjt-tzgg": tzggDetail,
})

export default defineSource({
  "kjt-tzgg": tzgg,
})

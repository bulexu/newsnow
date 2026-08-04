import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"
import { normalizeText } from "#/utils/banner"

const BASE_URL = "https://www.csia.org.cn"

interface Attachment {
  name: string
  url: string
}

interface ListItem {
  id: number | string
  name: string
  createTime: string
}

interface ListRes {
  code: number
  data: {
    content: ListItem[]
    totalElements?: number
    totalPages?: number
  }
}

// 列表为前端 JS 渲染, 真实数据来自 POST /content/list (仅接受 form-urlencoded),
// 对应渲染后的 XPath: //ul[@id='dataContainer']//li
function makeCsiaSource(categoryId: string) {
  return defineSource(async () => {
    const body = new URLSearchParams({ pageNo: "1", categoryId })
    const res: ListRes = await myFetch(`${BASE_URL}/content/list`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    })
    if (res?.code !== 0 || !res.data?.content?.length) {
      throw new TypeError("Empty csia content list")
    }

    const news: NewsItem[] = []
    const seen = new Set<string>()
    for (const item of res.data.content) {
      const id = String(item.id)
      const url = `${BASE_URL}/content/${id}.html`
      if (seen.has(url)) continue
      seen.add(url)

      const title = normalizeText(item.name)
      if (!title) continue

      // createTime 形如 "2026-07-25 09:50:37"
      const pubDate = item.createTime
        ? new Date(`${item.createTime.replace(" ", "T")}+08:00`).getTime()
        : undefined

      news.push({
        id,
        title,
        url,
        pubDate,
      })
    }

    return news
  })
}

function makeCsiaSourceDetail() {
  return async (item: NewsItem) => {
    if (!item?.url) return undefined
    const html: string = await myFetch(item.url)
    const $ = load(html)

    // 对应 XPath: //div[@class='article']//div[@class='content']
    const body = $("div.article div.content").first()
    if (!body.length) return undefined

    // 附件: 对应 XPath //div[@class='article']//div[@class='card']//ul[@class='list-group file-list']//a[@download]
    // 按 URL 去重; href 为域根相对路径 "/files/...", 文件名取 download 属性
    const attachments: Attachment[] = []
    const seenUrl = new Set<string>()
    $("div.article div.card ul.file-list a[download]").each((_, el) => {
      const $a = $(el)
      const href = $a.attr("href") || ""
      if (!href) return
      const abs = toAbsoluteUrl(href, BASE_URL, item.url)
      if (seenUrl.has(abs)) return
      seenUrl.add(abs)
      const name = normalizeText($a.attr("download") || $a.text())
      attachments.push({
        name: name || abs.split("/").pop() || abs,
        url: abs,
      })
    })

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

const tzgg = makeCsiaSource("10")
const tzggDetail = makeCsiaSourceDetail()

export const details = defineSourceDetail({
  "csia-tzgg": tzggDetail,
})

export default defineSource({
  "csia-tzgg": tzgg,
})

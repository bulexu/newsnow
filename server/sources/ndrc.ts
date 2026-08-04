import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"
import { normalizeText } from "#/utils/banner"

const BASE_URL = "https://www.ndrc.gov.cn"

interface Attachment {
  name: string
  url: string
}

function makeNdrcSource(path: string) {
  return defineSource(async () => {
    const listUrl = `${BASE_URL}${path}`
    const html: string = await myFetch(listUrl)
    const $ = load(html)
    const news: NewsItem[] = []
    const seen = new Set<string>()

    // 对应 XPath: //ul[@class='u-list']//li
    $("ul.u-list li").each((_, el) => {
      const $li = $(el)
      const $a = $li.find("a[href]").first()
      const href = $a.attr("href") || ""
      if (!href) return

      // href 形如 "./202608/t20260803_1406881.html", 相对列表页解析
      const url = href.startsWith("http") ? href : toAbsoluteUrl(href, BASE_URL, listUrl)
      if (seen.has(url)) return
      seen.add(url)

      // 标题优先取 title 属性, 回退到锚文本
      const title = normalizeText($a.attr("title") || $a.text())
      if (!title) return

      // 列表自带发布日期, 形如 <span>2026-08-03</span>
      const dateText = normalizeText($li.find("span").first().text())
      const pubDate = dateText
        ? new Date(`${dateText.replace(/\//g, "-")}T00:00:00+08:00`).getTime()
        : undefined

      // URL 形如 /xwdt/tzgg/202608/t20260803_1406881.html
      const idMatch = url.match(/_(\d+)\.html$/)
      const id = idMatch ? idMatch[1] : url

      news.push({
        id,
        title,
        url,
        pubDate,
      })
    })

    return news
  })
}

function makeNdrcSourceDetail() {
  return async (item: NewsItem) => {
    if (!item?.url) return undefined
    const html: string = await myFetch(item.url)
    const $ = load(html)

    // 对应 XPath: //div[@class='article']//div[contains(@class, 'article_con')]
    const body = $("div.article div[class*='article_con']").first()
    if (!body.length) return undefined

    // 附件: 对应 XPath //div[@class='article']//div[@class='attachment']//a, 按 URL 去重
    // 附件区独立于正文 (article_con 之外), href 形如 "./Pxxx.pdf"/"./Pxxx.ofd", 相对文章页解析
    const attachments: Attachment[] = []
    const seenUrl = new Set<string>()
    $("div.article div.attachment a[href]").each((_, el) => {
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

const tzgg = makeNdrcSource("/xwdt/tzgg/")
const tzggDetail = makeNdrcSourceDetail()

export const details = defineSourceDetail({
  "ndrc-tzgg": tzggDetail,
})

export default defineSource({
  "ndrc-tzgg": tzgg,
})

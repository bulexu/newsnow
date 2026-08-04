import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"
import { normalizeText } from "#/utils/banner"

const BASE_URL = "http://gxj.qingdao.gov.cn"

interface Attachment {
  name: string
  url: string
}

function makeGxjSource(path: string) {
  return defineSource(async () => {
    const html: string = await myFetch(`${BASE_URL}${path}`)
    const $ = load(html)
    const news: NewsItem[] = []
    const seen = new Set<string>()

    // 对应 XPath: //div[@class='listChangeDiv']//li
    $("div.listChangeDiv li").each((_, el) => {
      const $li = $(el)
      const $a = $li.find("a[href]").first()
      const href = $a.attr("href") || ""
      if (!href) return

      const url = href.startsWith("http") ? href : toAbsoluteUrl(href, BASE_URL)
      if (seen.has(url)) return
      seen.add(url)

      // 标题优先取 title 属性, 回退到去掉日期 span 后的文本
      const title = normalizeText(
        $a.attr("title")
        || $a.clone().children("span").remove().end().text(),
      )
      if (!title) return

      // 列表自带发布日期, 形如 "2026-05-25", 位于 a 内 span
      const dateText = normalizeText($a.find("span").first().text())
      const pubDate = dateText
        ? new Date(`${dateText}T00:00:00+08:00`).getTime()
        : undefined

      // URL 末尾形如 _10602481.shtml 或 t_7968577.shtml
      const idMatch = url.match(/_(\d+)\.shtml$/)
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

function makeGxjSourceDetail() {
  return async (item: NewsItem) => {
    if (!item?.url) return undefined
    const html: string = await myFetch(item.url)
    const $ = load(html)

    // 对应 XPath: //div[@class='con']//div[@class='wz']
    const body = $("div.con div.wz").first()
    if (!body.length) return undefined

    // 附件: //div[@class='con']//div[@class='wz']//p[@class='insertfileTag'] 下的 a
    const attachments: Attachment[] = []
    body.find("p.insertfileTag a[href]").each((_, el) => {
      const $a = $(el)
      const href = $a.attr("href") || ""
      if (!href) return
      const name = normalizeText($a.attr("title") || $a.attr("download") || $a.text())
      attachments.push({
        name: name || href.split("/").pop() || href,
        url: toAbsoluteUrl(href, BASE_URL, item.url),
      })
    })

    // 清理正文: h1 标题与 b(发布时间/来源) 已单独提取, 附件单独收集, 均从正文移除
    body.find("h1,b").remove()
    body.find("p.insertfileTag").remove()
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

const tzgg = makeGxjSource("/tzgg/")
const tzggDetail = makeGxjSourceDetail()

export const details = defineSourceDetail({
  "gxj-tzgg": tzggDetail,
})

export default defineSource({
  "gxj-tzgg": tzgg,
})

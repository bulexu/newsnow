import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"
import { normalizeText } from "#/utils/banner"

const BASE_URL = "http://www.china-bicycle.com"

interface Attachment {
  name: string
  url: string
}

// 附件链接特征: /Content/Files/ 路径或常见文件扩展名, 避免把正文内联外链误判为附件
function isFileHref(href: string) {
  return /\/Content\/Files\//i.test(href)
    || /\.(?:pdf|docx?|xlsx?|pptx?|zip|rar)(?:\?|$)/i.test(href)
}

function makeChinabicycleSource(path: string) {
  return defineSource(async () => {
    const html: string = await myFetch(`${BASE_URL}${path}`)
    const $ = load(html)
    const news: NewsItem[] = []
    const seen = new Set<string>()

    // 对应 XPath: //div[@class='news_list']//dl//dd
    $("div.news_list dl dd").each((_, el) => {
      const $dd = $(el)
      const $a = $dd.find("a[href]").first()
      const href = $a.attr("href") || ""
      if (!href) return

      // href 形如 "/News/View/{uuid}", 相对域根解析
      const url = href.startsWith("http") ? href : toAbsoluteUrl(href, BASE_URL)
      if (seen.has(url)) return
      seen.add(url)

      // 标题优先取 title 属性, 回退到锚文本
      const title = normalizeText($a.attr("title") || $a.text())
      if (!title) return

      // 列表自带发布日期, 形如 <span class="date">20260707</span>, 转为 2026-07-07
      const raw = normalizeText($dd.find("span.date").first().text())
      let pubDate: number | undefined
      const m = raw.match(/^(\d{4})(\d{2})(\d{2})$/)
      if (m) {
        const ts = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00+08:00`).getTime()
        if (Number.isFinite(ts)) pubDate = ts
      }

      const idMatch = url.match(/\/News\/View\/([0-9a-f-]+)/)
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

function makeChinabicycleSourceDetail() {
  return async (item: NewsItem) => {
    if (!item?.url) return undefined
    const html: string = await myFetch(item.url)
    const $ = load(html)

    // 对应 XPath: //div[@class='con_info']//div[@class='news_content']
    const body = $("div.con_info div.news_content").first()
    if (!body.length) return undefined

    // 附件: 对应 XPath ...//div[@class='news_content']//a, 仅取文件类链接, 按 URL 去重
    const attachments: Attachment[] = []
    const seenUrl = new Set<string>()
    body.find("a[href]").each((_, el) => {
      const $a = $(el)
      const href = $a.attr("href") || ""
      if (!href || !isFileHref(href)) return
      const abs = toAbsoluteUrl(href, BASE_URL, item.url)
      if (seenUrl.has(abs)) return
      seenUrl.add(abs)
      const name = normalizeText($a.attr("title") || $a.text())
      attachments.push({
        name: name || abs.split("/").pop() || abs,
        url: abs,
      })
    })

    // 仅移除文件类附件锚点, 保留正文内联外链
    body.find("a[href]").each((_, el) => {
      const href = $(el).attr("href") || ""
      if (isFileHref(href)) $(el).remove()
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

const js = makeChinabicycleSource("/news/index/30?cid=15")
const bz = makeChinabicycleSource("/news/index/31?cid=16")
const zcfg = makeChinabicycleSource("/news/index/41?cid=51")
const xgb = makeChinabicycleSource("/news/index/47/?cid=58")
const wh = makeChinabicycleSource("/news/index/33?cid=3")
const tz = makeChinabicycleSource("/news/index/1?cid=12")

const jsDetail = makeChinabicycleSourceDetail()
const bzDetail = makeChinabicycleSourceDetail()
const zcfgDetail = makeChinabicycleSourceDetail()
const xgbDetail = makeChinabicycleSourceDetail()
const whDetail = makeChinabicycleSourceDetail()
const tzDetail = makeChinabicycleSourceDetail()

export const details = defineSourceDetail({
  "chinabicycle-js": jsDetail,
  "chinabicycle-bz": bzDetail,
  "chinabicycle-zcfg": zcfgDetail,
  "chinabicycle-xgb": xgbDetail,
  "chinabicycle-wh": whDetail,
  "chinabicycle-tz": tzDetail,
})

export default defineSource({
  "chinabicycle-js": js,
  "chinabicycle-bz": bz,
  "chinabicycle-zcfg": zcfg,
  "chinabicycle-xgb": xgb,
  "chinabicycle-wh": wh,
  "chinabicycle-tz": tz,
  "chinabicycle-imp": makeChinabicycleSource("/news/important?cid=2"),
  "chinabicycle-zg": makeChinabicycleSource("/news/index/24?cid=18"),
  "chinabicycle-dfz": makeChinabicycleSource("/news/index/25?cid=19"),
})

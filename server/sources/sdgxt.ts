import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"
import { normalizeText } from "#/utils/banner"

const BASE_URL = "http://gxt.shandong.gov.cn"

interface Attachment {
  name: string
  url: string
}

function makeSdgxtSource(path: string) {
  return defineSource(async () => {
    const html: string = await myFetch(`${BASE_URL}${path}`)
    const $ = load(html)

    // 列表项以 CDATA 形式内嵌在 #second1 的 <script type="text/xml"> 数据源中,
    // 对应 XPath: //div[@id='second1']//div[@class='default_pgContainer']
    // 服务端渲染无 default_pgContainer, 需提取 CDATA 后二次解析
    const scope = $("#second1").html() || html
    const cdataBlocks = [...scope.matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g)].map(m => m[1])
    const $list = load(cdataBlocks.join("\n"))

    const news: NewsItem[] = []
    const seen = new Set<string>()

    $list("li").each((_, el) => {
      const $li = $list(el)
      const $a = $li.find("div.text h3 a[href]").first()
      const href = $a.attr("href") || ""
      if (!href) return

      const url = href.startsWith("http") ? href : toAbsoluteUrl(href, BASE_URL)
      if (seen.has(url)) return
      seen.add(url)

      // 标题优先取 title 属性, 回退到锚文本
      const title = normalizeText($a.attr("title") || $a.text())
      if (!title) return

      const desc = normalizeText($li.find("div.text > p").first().text())
      // div.bottom 两个 span: 发布时间 "2026-07-21 09:17" 与来源处室
      const $bottom = $li.find("div.bottom span")
      const dateText = normalizeText($bottom.eq(0).text())
      const author = normalizeText($bottom.eq(1).text())

      // 站点为北京时间 (UTC+8)
      let pubDate: number | undefined
      const m = dateText.match(/(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2})/)
      if (m) {
        const iso = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`
          + `T${m[4].padStart(2, "0")}:${m[5].padStart(2, "0")}:00+08:00`
        const ts = new Date(iso).getTime()
        if (Number.isFinite(ts)) pubDate = ts
      }

      // URL 形如 /art/2026/7/21/art_15201_10358291.html
      const idMatch = url.match(/art_\d+_(\d+)\.html$/)
      const id = idMatch ? idMatch[1] : url

      news.push({
        id,
        title,
        url,
        pubDate,
        extra: {
          hover: desc || undefined,
          info: author || undefined,
        },
      })
    })

    return news
  })
}

function makeSdgxtSourceDetail() {
  return async (item: NewsItem) => {
    if (!item?.url) return undefined
    const html: string = await myFetch(item.url)
    const $ = load(html)

    // 对应 XPath: //div[@id='second1']//div[@class='s17']//div[@class='news-body']
    const body = $("#second1 div.s17 div.news-body").first()
    if (!body.length) return undefined

    // 附件: 对应 XPath ...//div[@class='news-body']//a[contains(@href, '/module/download')], 按 URL 去重
    // 锚文本含文件名 (<img> 图标会被 .text() 忽略)
    const attachments: Attachment[] = []
    const seenUrl = new Set<string>()
    body.find("a[href*='/module/download']").each((_, el) => {
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

    body.find("a[href*='/module/download']").remove()
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

const tz = makeSdgxtSource("/col/col15201/index.html")
const gg = makeSdgxtSource("/col/col15202/index.html")
const gs = makeSdgxtSource("/col/col15203/index.html")

const tzDetail = makeSdgxtSourceDetail()
const ggDetail = makeSdgxtSourceDetail()
const gsDetail = makeSdgxtSourceDetail()

export const details = defineSourceDetail({
  "sdgxt-tz": tzDetail,
  "sdgxt-gg": ggDetail,
  "sdgxt-gs": gsDetail,
})

export default defineSource({
  "sdgxt-tz": tz,
  "sdgxt-gg": gg,
  "sdgxt-gs": gs,
})

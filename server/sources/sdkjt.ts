import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"
import { normalizeText } from "#/utils/banner"

const BASE_URL = "http://kjt.shandong.gov.cn"

interface Attachment {
  name: string
  url: string
}

function makeSdkjtSource(path: string) {
  return defineSource(async () => {
    const html: string = await myFetch(`${BASE_URL}${path}`)
    const $ = load(html)

    // 列表项以 CDATA 形式内嵌在 #informationList 的 <script type="text/xml"> 数据源中,
    // 对应 XPath: //div[@id='informationList']//div[@class='default_pgContainer']//ul
    // 服务端渲染无 default_pgContainer, 需提取 CDATA 后二次解析
    const scope = $("#informationList").html() || html
    const cdataBlocks = [...scope.matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g)].map(m => m[1])
    const $list = load(cdataBlocks.join("\n"))

    const news: NewsItem[] = []
    const seen = new Set<string>()

    $list("li").each((_, el) => {
      const $li = $list(el)
      const $a = $li.find("a[href]").first()
      const href = $a.attr("href") || ""
      if (!href) return

      const url = href.startsWith("http") ? href : toAbsoluteUrl(href, BASE_URL)
      if (seen.has(url)) return
      seen.add(url)

      // 标题优先取 title 属性, 回退到去掉 <s> 标记后的文本
      const title = normalizeText($a.attr("title") || $a.text())
      if (!title) return

      // 列表自带发布日期, 形如 <span class="pull-right">2026-07-27</span>
      const dateText = normalizeText($li.find("span.pull-right").first().text())
      const pubDate = dateText
        ? new Date(`${dateText}T00:00:00+08:00`).getTime()
        : undefined

      // URL 形如 /art/2026/7/27/art_13360_10326323.html
      const idMatch = url.match(/art_\d+_(\d+)\.html$/)
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

function makeSdkjtSourceDetail() {
  return async (item: NewsItem) => {
    if (!item?.url) return undefined
    const html: string = await myFetch(item.url)
    const $ = load(html)

    // 对应 XPath: //div[@id='detaiText']
    const wrapper = $("#detaiText").first()
    if (!wrapper.length) return undefined

    // 附件: 对应 XPath //div[@id='detaiText']//a[contains(@href, '/module/download')], 按 URL 去重
    const attachments: Attachment[] = []
    const seenUrl = new Set<string>()
    wrapper.find("a[href*='/module/download']").each((_, el) => {
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

    // 正文取 #detaiText 内的 .detail-text (#zoom), 避免标题/浏览次数/分享栏噪音; 回退整个 #detaiText
    const body = wrapper.find(".detail-text").first().length
      ? wrapper.find(".detail-text").first()
      : wrapper

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

const tzgg = makeSdkjtSource("/col/col13360/index.html")
const tzggDetail = makeSdkjtSourceDetail()

export const details = defineSourceDetail({
  "sdkjt-tzgg": tzggDetail,
})

export default defineSource({
  "sdkjt-tzgg": tzgg,
})

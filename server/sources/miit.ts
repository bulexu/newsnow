import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"
import { normalizeText } from "#/utils/banner"

const BASE_URL = "https://www.miit.gov.cn"
const SEARCH_BASE = `${BASE_URL}/search-front-server`
// 政策文件库-文件发布分类 iid (category=183 对应的实际搜索分类)
const CATE_ID = 196

interface Attachment {
  name: string
  url: string
}

// 搜索结果高亮会包裹 <em>, 需去除
function stripHighlight(value?: string) {
  return (value || "").replace(/<\/?em[^>]*>/g, "")
}

async function searchDocuments(cateId: number | string, pageSize = 15) {
  const selectFields = "title,content,deploytime,_index,url,cdate,infoextends,infocontentattribute,columnname,filenumbername,publishgroupname,publishtime,metaid,bexxgk,columnid,xxgkextend1,xxgkextend2,themename,typename,indexcode,createdate"
  const highlightConfigs = `[{"field":"infocontent","numberOfFragments":2,"fragmentOffset":0,"fragmentSize":30,"noMatchSize":145}]`
  const sortFields = `[{"name":"deploytime","type":"desc"}]`
  const params = new URLSearchParams({
    websiteid: "",
    scope: "basic",
    q: "",
    pg: String(pageSize),
    cateid: String(cateId),
    pos: "title_text,infocontent,titlepy",
    _cus_eq_typename: "",
    _cus_eq_publishgroupname: "",
    _cus_eq_themename: "",
    begin: "",
    end: "",
    dateField: "deploytime",
    selectFields,
    group: "distinct",
    highlightConfigs,
    highlightFields: "title_text,infocontent,webid",
    level: "6",
    sortFields,
    p: "1",
  })
  const url = `${SEARCH_BASE}/api/search/info?${params.toString()}`
  const res = await myFetch(url)
  // 接口返回 Content-Type: text/html, ofetch 不会自动按 JSON 解析, 需手动 parse
  const data = typeof res === "string" ? JSON.parse(res) : res
  return data?.data?.searchResult?.dataResults || []
}

const wjfb = defineSource(async () => {
  const results = await searchDocuments(CATE_ID)

  const news: NewsItem[] = []
  const seen = new Set<string>()

  for (const r of results) {
    // group=distinct 时结果包裹在 groupData 中
    const groupData = Array.isArray(r?.groupData) && r.groupData.length ? r.groupData[0] : r
    const doc = groupData?.data || {}

    const title = normalizeText(stripHighlight(doc.title || doc.title_text))
    const href = doc.url || ""
    if (!title || !href) continue

    const url = href.startsWith("http") ? href : toAbsoluteUrl(href, BASE_URL)
    if (seen.has(url)) continue
    seen.add(url)

    // deploytime 为字符串毫秒时间戳, 转数字
    const deploytime = Number(doc.deploytime)
    const pubDate = Number.isFinite(deploytime) && deploytime > 0 ? deploytime : undefined

    const idMatch = href.match(/art_([0-9a-f]+)\.html$/)
    const id = idMatch ? idMatch[1] : (doc.metaid || url)

    const summary = normalizeText(stripHighlight(doc.infocontent))
    const docNumber = normalizeText(stripHighlight(doc.filenumbername))

    news.push({
      id,
      title,
      url,
      pubDate,
      extra: {
        hover: summary || undefined,
        info: docNumber || undefined,
      },
    })
  }

  if (!news.length) {
    throw new TypeError("Cannot parse miit policy document list")
  }

  return news
})

const zxzc = defineSource(async () => {
  const html: string = await myFetch(`${BASE_URL}/xwfb/zxzc/index.html`)
  const $page = load(html)
  const loader = $page(".clist_con script[url][querydata]").first()
  const requestPath = loader.attr("url") || ""
  const queryText = loader.attr("querydata") || ""
  if (!requestPath || !queryText) {
    throw new TypeError("Cannot locate miit latest policy loader")
  }

  let queryData: Record<string, string>
  try {
    queryData = JSON.parse(queryText.replace(/'/g, "\""))
  } catch {
    throw new TypeError("Cannot parse miit latest policy loader parameters")
  }

  const requestUrl = toAbsoluteUrl(requestPath, BASE_URL)
  const response = await myFetch<{ data?: { html?: string } }>(`${requestUrl}?${new URLSearchParams(queryData).toString()}`)
  const listHtml = response.data?.html || ""
  const $ = load(listHtml)
  const news: NewsItem[] = []
  const seen = new Set<string>()

  $("li").each((_, el) => {
    const item = $(el)
    const link = item.find("a[href]").first()
    const href = link.attr("href") || ""
    const title = normalizeText(link.attr("title") || link.text())
    if (!href || !title) return

    const url = toAbsoluteUrl(href, BASE_URL)
    if (seen.has(url)) return
    seen.add(url)

    const dateText = normalizeText(item.find("span.fr").first().text())
    const timestamp = dateText
      ? new Date(`${dateText}T00:00:00+08:00`).getTime()
      : Number.NaN
    const id = href.match(/art_([0-9a-f]+)\.html$/i)?.[1] || url

    news.push({
      id,
      title,
      url,
      pubDate: Number.isFinite(timestamp) ? timestamp : undefined,
    })
  })

  if (!news.length) {
    throw new TypeError("Cannot parse miit latest policy list")
  }

  return news
})

async function detail(item: NewsItem) {
  if (!item?.url) return undefined

  const html: string = await myFetch(item.url)
  const $ = load(html)

  // 正文容器 #con_con
  const body = $("#con_con").first()
  if (!body.length) return undefined

  // 附件: #con_con 内 ul.fileArry 下的 iframe, 真实文件地址在 fileurl 属性
  const attachments: Attachment[] = []
  const seenUrl = new Set<string>()
  body.find("ul.fileArry iframe").each((_, el) => {
    const fileurl = $(el).attr("fileurl") || ""
    if (!fileurl) return
    const abs = toAbsoluteUrl(fileurl, BASE_URL, item.url)
    if (seenUrl.has(abs)) return
    seenUrl.add(abs)
    attachments.push({
      name: abs.split("/").pop() || abs,
      url: abs,
    })
  })

  // 附件单独列出, 从正文移除
  body.find("ul.fileArry").remove()
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

export const details = defineSourceDetail({
  "miit-wjfb": detail,
  "miit-zxzc": detail,
})

export default defineSource({
  "miit-wjfb": wjfb,
  "miit-zxzc": zxzc,
})

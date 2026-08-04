import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"
import { normalizeText } from "#/utils/banner"

const BASE_URL = "https://zccx.qingdao.gov.cn"
const API_BASE = `${BASE_URL}/api`

interface Attachment {
  name: string
  url: string
}

interface ListItem {
  baseId: string
  title?: string | null
  baseCreateTime?: string | null
  declarationStartTime?: string | null
  declarationEndTime?: string | null
  amount?: number | string | null
  leadDeptName?: string | null
}

interface ListRes {
  code: number
  data?: {
    list?: ListItem[]
    total?: number
  }
}

interface PayFile {
  title?: string | null
  url?: string | null
}

interface DetailItem {
  title?: string | null
  describeText?: string | null
  applyCondition?: string | null
  process?: string | null
  contact?: string | null
  reportLink?: string | null
  cashwayName?: string | null
  payFileData?: PayFile[] | null
}

interface DetailRes {
  code: number
  data?: DetailItem
}

function formatAmount(amount?: number | string | null) {
  if (amount === null || amount === undefined || amount === "") return ""
  const value = Number(amount)
  if (!Number.isFinite(value) || value <= 0) return ""
  return `${value}万元`
}

// 列表无服务端页面, 数据来自 POST findBizProjectPunishListPage (不加筛选条件),
// 对应渲染后的 XPath: //div[@id='mainList']//ul//li
const zcsx = defineSource(async () => {
  const res: ListRes = await myFetch(`${API_BASE}/bizProjectPunishFront/findBizProjectPunishListPage`, {
    method: "POST",
    body: {
      pageSize: 30,
      pageNum: 1,
      title: "",
      projectType: "",
      cashAreaCode: "",
      hierarchy: [],
      leadDeptId: [],
      suitableCode: [],
      cashway: [],
      typeCode: [],
      support: [],
      status: ["1"],
      CreateTime: 0,
      startTimeStr: "",
      endTimeStr: "",
      industryCategoryOne: "",
      industryCategoryTwo: [],
    },
  })
  if (res?.code !== 0 || !res.data?.list?.length) {
    throw new TypeError("Empty qdzct policy list")
  }

  const news: NewsItem[] = []
  const seen = new Set<string>()
  for (const item of res.data.list) {
    const id = item.baseId
    if (!id || seen.has(id)) continue
    seen.add(id)

    const title = normalizeText(item.title ?? undefined)
    if (!title) continue

    // baseCreateTime 形如 "2026-07-28 12:03:23", 站点为北京时间 (UTC+8)
    const pubDate = item.baseCreateTime
      ? new Date(`${item.baseCreateTime.replace(" ", "T")}+08:00`).getTime()
      : undefined

    // 申报周期与金额放入 hover, 牵头单位放入 info
    const hoverParts: string[] = []
    if (item.declarationStartTime && item.declarationEndTime) {
      hoverParts.push(`申报周期：${item.declarationStartTime}至${item.declarationEndTime}`)
    }
    const amount = formatAmount(item.amount)
    if (amount) hoverParts.push(`金额：${amount}`)

    const leadDept = normalizeText(item.leadDeptName ?? undefined)

    news.push({
      id,
      title,
      url: `${BASE_URL}/policy/itemDetail.html?id=${id}`,
      pubDate,
      extra: {
        hover: hoverParts.join("；") || undefined,
        info: leadDept || undefined,
      },
    })
  }

  return news
})

// 详情页为 knockout 前端渲染 (itemDetail.html?id=), 正文数据来自 GET bizProjectPunishFront/{baseId},
// 按页面模板顺序还原 //div[contains(@class, 'mainCons')]//div[@class='mainConsBottom'] 各区块
function makeQdzctSourceDetail() {
  return async (item: NewsItem) => {
    if (!item?.url) return undefined
    const idMatch = item.url.match(/[?&]id=([\w-]+)/)
    const id = idMatch ? idMatch[1] : undefined
    if (!id) return undefined

    const res: DetailRes = await myFetch(`${API_BASE}/bizProjectPunishFront/${id}`)
    const data = res?.code === 0 ? res.data : undefined
    if (!data) return undefined

    const attachments: Attachment[] = []
    const seenUrl = new Set<string>()
    const addAttachment = (name: string, url: string) => {
      if (!url || seenUrl.has(url)) return
      seenUrl.add(url)
      attachments.push({
        name: name || url.split("/").pop() || url,
        url,
      })
    }

    // 渲染内容字段 (describeText/applyCondition/process 等):
    // 纯文本直接保留换行; HTML 则收集其中的 file/download 附件链接并从正文移除
    function renderHtmlField(html?: string | null) {
      const raw = (html || "").trim()
      if (!raw) return ""
      if (!/<[a-z][^>]*>/i.test(raw)) return raw.replace(/[ \t]+/g, " ")
      const $ = load(raw)
      $("a[href*='file/download']").each((_, el) => {
        const $a = $(el)
        const href = $a.attr("href") || ""
        if (href) addAttachment(normalizeText($a.text()), toAbsoluteUrl(href, BASE_URL, item.url))
        $a.remove()
      })
      $("script,style").remove()
      $("[href]").each((_, el) => {
        const href = $(el).attr("href")
        if (href) $(el).attr("href", toAbsoluteUrl(href, BASE_URL, item.url))
      })
      $("img[src]").each((_, el) => {
        const src = $(el).attr("src")
        if (src) $(el).attr("src", toAbsoluteUrl(src, BASE_URL, item.url))
      })
      return html2md($("body").html() || raw)
        .replace(/\n{3,}/g, "\n\n")
        .trim()
    }

    const sections: string[] = []
    const pushSection = (label: string, content: string) => {
      if (content) sections.push(`**${label}**\n\n${content}`)
    }

    pushSection("政策事项", renderHtmlField(data.describeText))
    pushSection("申报（享受）条件", renderHtmlField(data.applyCondition))

    // 所需申报材料: 对应渲染后的 clTable 表格; 兑现方式为"免申即享"时页面不展示
    if (data.payFileData?.length && data.cashwayName !== "免申即享") {
      const rows: string[] = []
      data.payFileData.forEach((file, index) => {
        const name = normalizeText(file.title ?? undefined) || `附件${index + 1}`
        if (file.url) addAttachment(name, file.url)
        rows.push(`- ${name}`)
      })
      if (rows.length) pushSection("所需申报材料", rows.join("\n"))
    }

    if (data.cashwayName !== "免申即享") {
      pushSection("申报审核流程", renderHtmlField(data.process))
    }
    pushSection("联系人及联系方式", renderHtmlField(data.contact))

    const reportLink = (data.reportLink || "").trim()
    if (reportLink) {
      pushSection("办理地址", `[${reportLink}](${toAbsoluteUrl(reportLink, BASE_URL, item.url)})`)
    }

    if (!sections.length && !attachments.length) return undefined

    let markdown = sections.join("\n\n")

    if (attachments.length) {
      const attachMd = attachments
        .map(att => `- [${att.name}](${att.url})`)
        .join("\n")
      markdown += `\n\n**附件：**\n${attachMd}`
    }

    return item.title ? `## ${item.title}\n\n${markdown}` : markdown
  }
}

const zcsxDetail = makeQdzctSourceDetail()

export const details = defineSourceDetail({
  "qdzct-zcsx": zcsxDetail,
})

export default defineSource({
  "qdzct-zcsx": zcsx,
})

import type { NewsItem } from "@shared/types"
import { normalizeText } from "#/utils/banner"

const BASE_URL = "https://sousuo.www.gov.cn"

interface GovPolicyItem {
  id: string
  title: string
  url: string
  pubtime?: number
  summary?: string
}

interface GovPolicyGroup {
  listVO?: GovPolicyItem[]
}

interface GovPolicyResponse {
  code: number | string
  searchVO?: {
    catMap?: Record<string, GovPolicyGroup>
  }
}

const groupNames: Record<string, string> = {
  gongwen: "国务院文件",
  bumenfile: "国务院部门文件",
  otherfile: "政策解读",
  gongbao: "国务院公报",
}

function stripHtml(value?: string) {
  return normalizeText((value || "").replace(/<[^>]+>/g, " "))
}

export default defineSource(async () => {
  const params = new URLSearchParams({
    t: "zhengcelibrary",
    q: "",
    sort: "pubtime",
    sortType: "1",
    searchfield: "title:content:summary",
    p: "1",
    n: "30",
  })

  const response = await myFetch<GovPolicyResponse>(`${BASE_URL}/search-gov/data?${params.toString()}`)
  if (String(response.code) !== "200") {
    throw new TypeError("Cannot fetch State Council policy library")
  }

  const groups = response.searchVO?.catMap || {}
  const news = Object.entries(groups)
    .flatMap(([groupId, group]) => (group.listVO || []).map((item): NewsItem => ({
      id: `${groupId}-${item.id}`,
      title: stripHtml(item.title),
      url: item.url,
      pubDate: item.pubtime,
      extra: {
        info: groupNames[groupId] || groupId,
        hover: stripHtml(item.summary) || undefined,
      },
    })))
    .filter(item => item.title && item.url)
    .sort((a, b) => Number(b.pubDate || 0) - Number(a.pubDate || 0))
    .slice(0, 30)

  if (!news.length) {
    throw new TypeError("Cannot parse State Council policy library")
  }

  return news
})

import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { normalizeText } from "#/utils/banner"

const NEWS_URL = "https://www.peopleforbikes.org/news"
const BUSINESS_URL = "https://www.peopleforbikes.org/topics/bike-business"
const RESEARCH_URL = "https://www.peopleforbikes.org/research"
const BASE_URL = "https://www.peopleforbikes.org"

function readNextData(html: string) {
  const $ = load(html)
  const json = $("#__NEXT_DATA__").text()
  if (!json) throw new Error("PeopleForBikes __NEXT_DATA__ not found")
  return JSON.parse(json)
}

function richText(value: unknown) {
  if (!Array.isArray(value)) return ""
  return normalizeText(value.map((item: any) => item?.text || "").join(" "))
}

function timestamp(value?: string | null) {
  if (!value) return undefined
  const result = new Date(value).getTime()
  return Number.isFinite(result) ? result : undefined
}

// deck 在 /news 页面是纯字符串, 在其他页面是富文本数组
function deckText(value: unknown) {
  if (typeof value === "string") return normalizeText(value)
  return richText(value)
}

// https://www.peopleforbikes.org/news
// Next.js 页面, 文章列表在 pageProps.page.landing_page.data[].node
const news = defineSource(async () => {
  const html: string = await myFetch(NEWS_URL)
  const data = readNextData(html)
  const nodes: any[] = Array.isArray(data?.props?.pageProps?.page?.landing_page?.data)
    ? data.props.pageProps.page.landing_page.data
    : []

  return nodes.slice(0, 60).map(({ node }): NewsItem => {
    const title = richText(node?.title)
    return {
      id: node?._meta?.id || node?._meta?.uid,
      title,
      url: `${BASE_URL}/news/${node?._meta?.uid}`,
      pubDate: timestamp(node?.publication_date || node?._meta?.lastPublicationDate),
      extra: {
        hover: deckText(node?.deck) || undefined,
        info: normalizeText(node?.byline) || undefined,
      },
    }
  }).filter(item => item.id && item.title)
})

const business = defineSource(async () => {
  const html: string = await myFetch(BUSINESS_URL)
  const data = readNextData(html)
  const posts: any[] = Array.isArray(data?.props?.pageProps?.page?.[1])
    ? data.props.pageProps.page[1]
    : []

  return posts.map((post): NewsItem => {
    const title = richText(post?.data?.title)
    const pubDate = timestamp(post?.data?.publication_date || post?.first_publication_date)
    return {
      id: post?.id || post?.uid,
      title,
      url: `${BASE_URL}/news/${post.uid}`,
      pubDate,
      extra: {
        hover: normalizeText(post?.data?.deck) || undefined,
      },
    }
  }).filter(item => item.id && item.title)
})

const research = defineSource(async () => {
  const html: string = await myFetch(RESEARCH_URL)
  const data = readNextData(html)
  const reports: any[] = Array.isArray(data?.props?.pageProps?.rawReports)
    ? data.props.pageProps.rawReports
    : []

  return reports.slice(0, 50).map(({ node }): NewsItem => {
    const reportType = node?.report_type?.[0]?.type?.type
    const year = node?.year
    const info = [reportType, year].filter(Boolean).join(" · ")
    return {
      id: node?._meta?.id || node?._meta?.uid,
      title: richText(node?.title),
      url: `${BASE_URL}/reports/${node?._meta?.uid}`,
      pubDate: timestamp(node?.exact_date || node?._meta?.lastPublicationDate),
      extra: {
        hover: richText(node?.summary) || undefined,
        info: info || undefined,
      },
    }
  }).filter(item => item.id && item.title)
})

export default defineSource({
  "peopleforbikes-news": news,
  "peopleforbikes-business": business,
  "peopleforbikes-research": research,
})

import { load } from "cheerio"
import { escapeHtml, normalizeText, toAbsoluteUrl } from "#/utils/banner"

const HOME_URL = "https://www.xcadey.com/"

const GENERIC_TITLE_RE = /^(?:slider\s*\d+|slide\s*\d+|mask\s*group|untitled)$/i

function titleFromFilename(url: string): string {
  const filename = url.split("/").pop()?.replace(/\.[^.]+$/, "") ?? ""
  return filename
    .replace(/^\d+/, "")
    .replace(/banner/gi, "")
    .replace(/^[-_\s]+|[-_\s]+$/g, "")
    .replace(/[-_]+/g, " ")
    .trim()
}

const banner = defineSource(async () => {
  const html: string = await flareFetch(HOME_URL)
  const $ = load(html)

  // Build map: public-id → slide title from .n2-ss-slide[data-slide-public-id]
  const titleMap = new Map<string, string>()
  $(".n2-ss-slide[data-slide-public-id]").each((_, el) => {
    const pid = $(el).attr("data-slide-public-id") ?? ""
    const rawTitle = normalizeText($(el).attr("data-title"))
    if (pid && rawTitle && !GENERIC_TITLE_RE.test(rawTitle)) {
      titleMap.set(pid, rawTitle)
    }
  })

  const items: Array<{ title: string, image: string }> = []
  const seen = new Set<string>()

  $(".n2-ss-slide-backgrounds .n2-ss-slide-background").each((_, el) => {
    const pid = $(el).attr("data-public-id") ?? ""
    const imgSrc = $(el).find("img").first().attr("src") ?? ""
    if (!imgSrc) return

    const image = toAbsoluteUrl(imgSrc, HOME_URL)
    if (!image || seen.has(image)) return
    seen.add(image)

    const title = normalizeText(
      titleMap.get(pid) || titleFromFilename(imgSrc),
    )
    if (!title) return

    items.push({ title, image })
  })

  if (!items.length) {
    throw new TypeError("Cannot parse XCADEY homepage banners")
  }

  return items.map((item, index) => ({
    id: `${item.image}#${index + 1}`,
    title: item.title,
    url: HOME_URL,
    content: `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" />`,
    extra: {
      info: "XCADEY homepage banner",
      hover: `title=${item.title}\nimage=${item.image}`,
    },
  }))
})

export default defineSource({
  "xcadey-banner": banner,
})

import { load } from "cheerio"
import { escapeHtml, normalizeText, toAbsoluteUrl } from "#/utils/banner"

const HOME_URL = "https://global.brytonsport.com/"

function titleFromProductPath(path: string): string {
  const segment = path.split("/").pop() ?? ""
  return segment
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim()
}

function titleFromImageUrl(url: string): string {
  const filename = (url.split("?")[0] ?? "").split("/").pop()?.replace(/\.[^.]+$/, "") ?? ""
  const stem = filename.replace(/^[Bb]anner[-_]?/, "")
  if (/^[\da-f]{8}/i.test(stem)) return ""
  return stem
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim()
}

const banner = defineSource(async () => {
  const html: string = await myFetch(HOME_URL)
  const $ = load(html)
  const items: Array<{ title: string, image: string, url: string }> = []
  const seenImage = new Set<string>()

  $(".swiper-slide").each((_, element) => {
    const $slide = $(element)

    const $img = $slide.find("img.small-hide").first()
    if (!$img.length) return

    const image = toAbsoluteUrl($img.attr("src"), HOME_URL)
    if (!image || seenImage.has(image)) return
    seenImage.add(image)

    const href = $slide.find("a[href]").first().attr("href") ?? ""
    const linkUrl = href ? toAbsoluteUrl(href, HOME_URL) : HOME_URL
    let title = normalizeText(href ? titleFromProductPath(href) : titleFromImageUrl(image))
    if (!title) title = "Bryton"

    items.push({ title, image, url: linkUrl })
  })

  if (!items.length) {
    throw new TypeError("Cannot parse Bryton homepage banners")
  }

  return items.map((item, index) => ({
    id: `${item.image}#${index + 1}`,
    title: item.title,
    url: item.url,
    content: `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" />`,
    extra: {
      info: "Bryton homepage banner",
      hover: `title=${item.title}\nimage=${item.image}`,
    },
  }))
})

export default defineSource({
  "bryton-banner": banner,
})

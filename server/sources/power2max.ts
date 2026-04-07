import { load } from "cheerio"
import { escapeHtml, normalizeText, toAbsoluteUrl } from "#/utils/banner"

const HOME_URL = "https://www.power2max.com/en/"

function titleFromImageUrl(url: string): string {
  const filename = (url.split("?")[0] ?? "").split("/").pop()?.replace(/\.[^.]+$/, "") ?? ""
  return filename
    .replace(/^p2m_/, "")
    .replace(/_slider$/, "")
    .replace(/_\d+x\d+$/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim()
}

const banner = defineSource(async () => {
  const html: string = await myFetch(HOME_URL)
  const $ = load(html)
  const items: Array<{ title: string, image: string, url: string }> = []
  const seenImage = new Set<string>()

  $(".ms-slide").each((_, el) => {
    const $slide = $(el)
    // SSR: images are lazy-loaded with data-src directly inside .ms-slide
    const $img = $slide.find("img[data-src]").first()
    const image = toAbsoluteUrl($img.attr("data-src"), HOME_URL)
    if (!image || seenImage.has(image)) return
    seenImage.add(image)

    const href = $slide.find("a.ms-slide-link[href]").first().attr("href") ?? ""
    const url = href ? toAbsoluteUrl(href, HOME_URL) : HOME_URL
    const title = normalizeText(titleFromImageUrl(image)) || "Power2Max"

    items.push({ title, image, url })
  })

  if (!items.length) throw new TypeError("Cannot parse Power2Max homepage banners")

  return items.map((item, index) => ({
    id: `${item.image}#${index + 1}`,
    title: item.title,
    url: item.url,
    content: `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" />`,
    extra: {
      info: "Power2Max homepage banner",
      hover: `title=${item.title}\nimage=${item.image}`,
    },
  }))
})

export default defineSource({
  "power2max-banner": banner,
})

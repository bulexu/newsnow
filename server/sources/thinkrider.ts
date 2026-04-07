import { load } from "cheerio"
import { escapeHtml, normalizeText, toAbsoluteUrl } from "#/utils/banner"

const HOME_URL = "https://www.thinkrider.com/"

function extractText($slide: cheerio.Cheerio) {
  // Prefer .slideshow__toptitle + .slideshow__title
  const top = $slide.find(".slideshow__toptitle").first().text()
  const title = $slide.find(".slideshow__title, h1, h2, .mega-title").first().text()
  return normalizeText(
    title ? `${top ? `${top} — ` : ""}${title}` : `${top}`,
  )
}

function extractBgImage($imgDiv: cheerio.Cheerio) {
  // Try data-bgset, else style background-image
  const bgset = $imgDiv.attr("data-bgset")
  if (bgset) {
    // Use last image (largest)
    const last = bgset.split(",").pop()?.trim().split(" ")[0]
    return last ? toAbsoluteUrl(last, HOME_URL) : ""
  }
  const style = $imgDiv.attr("style") || ""
  const m = style.match(/background-image:\s*url\(["']?(.*?)["']?\)/)
  return m ? toAbsoluteUrl(m[1], HOME_URL) : ""
}

const banner = defineSource(async () => {
  const html: string = await myFetch(HOME_URL)
  const $ = load(html)
  const items: Array<{ title: string, image: string, url: string }> = []
  const seenImage = new Set<string>()

  $(".slideshow__slide").each((_, el) => {
    const $slide = $(el)
    const $imgDiv = $slide.find(".slideshow__image").first()
    const image = extractBgImage($imgDiv)
    if (!image || seenImage.has(image)) return
    seenImage.add(image)

    const title = extractText($slide)
    let url = HOME_URL
    const $btn = $slide.find("a.btn[href]").first()
    if ($btn.length) url = toAbsoluteUrl($btn.attr("href"), HOME_URL)

    items.push({ title: title || "ThinkRider", image, url })
  })

  if (!items.length) throw new TypeError("Cannot parse ThinkRider homepage banners")

  return items.map((item, index) => ({
    id: `${item.image}#${index + 1}`,
    title: item.title,
    url: item.url,
    content: `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" />`,
    extra: {
      info: "ThinkRider homepage banner",
      hover: `title=${item.title}\nimage=${item.image}`,
    },
  }))
})

export default defineSource({
  "thinkrider-banner": banner,
})

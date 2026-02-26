import TurndownService from "turndown"

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
})

export function html2md(html: string) {
  return turndownService.turndown(html)
}

export function toAbsoluteUrl(url: string, baseUrl: string, itemUrl?: string) {
  if (!url) return ""
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith("//")) return `http:${url}`
  if (url.startsWith("/")) return `${baseUrl}${url}`
  if (url.startsWith("./") && itemUrl) {
    const cleanItemUrl = itemUrl.split("#")[0].split("?")[0]
    const lastSlash = cleanItemUrl.lastIndexOf("/")
    const base = lastSlash >= 0 ? cleanItemUrl.slice(0, lastSlash + 1) : `${cleanItemUrl}/`
    return `${base}${url.slice(2)}`
  }
  return `${baseUrl}/${url}`
}

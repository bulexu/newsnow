import TurndownService from "turndown"

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
})

export function html2md(html: string) {
  return turndownService.turndown(html)
}

export function toAbsoluteUrl(url: string, baseUrl: string) {
  if (!url) return ""
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith("//")) return `http:${url}`
  if (url.startsWith("/")) return `${baseUrl}${url}`
  return `${baseUrl}/${url}`
}

export interface BannerAction {
  text: string
  url: string
}

export function normalizeText(value?: string) {
  return (value || "").replace(/\s+/g, " ").trim()
}

export function toAbsoluteUrl(url: string | undefined, baseUrl: string) {
  if (!url) return ""
  try {
    const normalized = url.replace(/&amp;/g, "&")
    if (normalized.startsWith("//")) {
      return `https:${normalized}`
    }
    return new URL(normalized, baseUrl).toString()
  } catch {
    return ""
  }
}

export function firstSrcFromSrcset(srcset?: string) {
  if (!srcset) return ""
  const first = srcset.split(",")[0]?.trim() || ""
  return first.split(/\s+/)[0] || ""
}

export function escapeHtml(value?: string) {
  return (value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function formatActions(actions: BannerAction[]) {
  return actions.map(action => `${action.text} (${action.url})`).join(" | ")
}

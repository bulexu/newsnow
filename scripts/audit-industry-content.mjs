import { readFileSync } from "node:fs"
import process from "node:process"

const sources = JSON.parse(readFileSync(new URL("../shared/sources.json", import.meta.url), "utf8"))

const baseUrl = process.argv[2] || "http://localhost:5173"
const requestedIds = new Set(process.argv.slice(3))
const ids = Object.entries(sources)
  .filter(([id, source]) => source.column === "industry" && !source.redirect && (!requestedIds.size || requestedIds.has(id)))
  .map(([id]) => id)

let next = 0
const results = []

await Promise.all(Array.from({ length: 4 }, async () => {
  while (next < ids.length) {
    const id = ids[next++]
    const started = Date.now()
    try {
      const url = new URL("/api/s", baseUrl)
      url.searchParams.set("id", id)
      url.searchParams.set("withDetail", "true")
      const response = await fetch(url, { signal: AbortSignal.timeout(120_000) })
      const data = await response.json()
      const items = data.items || []
      const withContent = items.filter(item => item.content?.trim())
      const result = {
        id,
        status: response.status,
        items: items.length,
        withContent: withContent.length,
        withLink: withContent.filter(item => /\[[^\]]+\]\(https?:\/\//.test(item.content)).length,
        sampleLength: withContent[0]?.content?.length || 0,
        seconds: Math.round((Date.now() - started) / 1000),
      }
      results.push(result)
      console.log(JSON.stringify(result))
    } catch (error) {
      const result = { id, error: String(error), seconds: Math.round((Date.now() - started) / 1000) }
      results.push(result)
      console.log(JSON.stringify(result))
    }
  }
}))

const summary = {
  total: results.length,
  complete: results.filter(result => result.items && result.items === result.withContent).length,
  partial: results.filter(result => result.items && result.withContent && result.items !== result.withContent).length,
  empty: results.filter(result => result.items && !result.withContent).length,
  errors: results.filter(result => result.error || result.status !== 200 || !result.items).length,
}
console.log(JSON.stringify(summary))
if (summary.complete !== summary.total) process.exitCode = 1

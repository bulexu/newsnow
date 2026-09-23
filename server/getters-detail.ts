import type { SourceID } from "@shared/types"
import { sources } from "@shared/sources"
import * as modules from "glob:./sources/{*.ts,**/index.ts}"
import type { SourceDetailGetter, SourceDetailGetterMap } from "./types"
import { industryDetail } from "./utils/industry-detail"

export const detailGetters = (function () {
  const getters = {} as Partial<Record<SourceID, SourceDetailGetter>>
  typeSafeObjectEntries(modules).forEach(([, mod]) => {
    const details = (mod as { details?: SourceDetailGetterMap }).details
    if (details) {
      Object.assign(getters, details)
    }
  })
  for (const [id, source] of typeSafeObjectEntries(sources)) {
    if (source.column === "industry" && !source.redirect && !getters[id]) getters[id] = industryDetail
  }
  return getters
})()

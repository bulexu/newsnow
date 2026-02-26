import type { SourceID } from "@shared/types"
import * as modules from "glob:./sources/{*.ts,**/index.ts}"
import type { SourceDetailGetter, SourceDetailGetterMap } from "./types"

export const detailGetters = (function () {
  const getters = {} as Partial<Record<SourceID, SourceDetailGetter>>
  typeSafeObjectEntries(modules).forEach(([, mod]) => {
    const details = (mod as { details?: SourceDetailGetterMap }).details
    if (details) {
      Object.assign(getters, details)
    }
  })
  return getters
})()

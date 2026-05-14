import { AsyncLocalStorage } from "node:async_hooks"
import type { SourceID } from "@shared/types"

export interface SourceRequestContext {
  id?: SourceID
  robots?: "ignore" | "enforce"
}

const sourceRequestContext = new AsyncLocalStorage<SourceRequestContext>()

export function getSourceRequestContext() {
  return sourceRequestContext.getStore()
}

export function runWithSourceRequestContext<T>(context: SourceRequestContext, handler: () => T) {
  return sourceRequestContext.run(context, handler)
}

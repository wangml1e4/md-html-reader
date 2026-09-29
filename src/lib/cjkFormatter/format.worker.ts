import { formatMarkdownChecked } from './formatter'
import { DEFAULT_CJK_FORMATTING } from './types'
self.onmessage = ({ data }) => {
  try { self.postMessage({ result: formatMarkdownChecked(data.source, data.settings || DEFAULT_CJK_FORMATTING, { preserveTwoSpaceHardBreaks: true }) }) }
  catch (error) { self.postMessage({ error: String(error) }) }
}

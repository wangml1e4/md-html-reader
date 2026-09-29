import Help from '@icon-park/vue-next/es/icons/Help'
import Connection from '@icon-park/vue-next/es/icons/Connection'
import Tool from '@icon-park/vue-next/es/icons/Tool'
import DocSearch from '@icon-park/vue-next/es/icons/DocSearch'
import Search from '@icon-park/vue-next/es/icons/Search'
import Export from '@icon-park/vue-next/es/icons/Export'
import SettingTwo from '@icon-park/vue-next/es/icons/SettingTwo'
import Translate from '@icon-park/vue-next/es/icons/Translate'
import Comment from '@icon-park/vue-next/es/icons/Comment'
import Magic from '@icon-park/vue-next/es/icons/Magic'
import Close from '@icon-park/vue-next/es/icons/Close'
import Save from '@icon-park/vue-next/es/icons/Save'
import Link from '@icon-park/vue-next/es/icons/Link'
import Refresh from '@icon-park/vue-next/es/icons/Refresh'
import Unlock from '@icon-park/vue-next/es/icons/Unlock'
import AllApplication from '@icon-park/vue-next/es/icons/AllApplication'
import FileEditing from '@icon-park/vue-next/es/icons/FileEditing'
import HtmlFive from '@icon-park/vue-next/es/icons/HtmlFive'
import Local from '@icon-park/vue-next/es/icons/Local'
import Text from '@icon-park/vue-next/es/icons/Text'
import List from '@icon-park/vue-next/es/icons/List'
import Check from '@icon-park/vue-next/es/icons/Check'
import BookOpen from '@icon-park/vue-next/es/icons/BookOpen'
import Code from '@icon-park/vue-next/es/icons/Code'
import Split from '@icon-park/vue-next/es/icons/Split'
import FullScreen from '@icon-park/vue-next/es/icons/FullScreen'
import OffScreen from '@icon-park/vue-next/es/icons/OffScreen'
import Format from '@icon-park/vue-next/es/icons/Format'
import Undo from '@icon-park/vue-next/es/icons/Undo'
import Delete from '@icon-park/vue-next/es/icons/Delete'
import FileAddition from '@icon-park/vue-next/es/icons/FileAddition'
import Copy from '@icon-park/vue-next/es/icons/Copy'
import Send from '@icon-park/vue-next/es/icons/Send'
import Config from '@icon-park/vue-next/es/icons/Config'
import Browser from '@icon-park/vue-next/es/icons/Browser'

export const icons = {
  help: Help,
  connection: Connection,
  tools: Tool,
  'find-file': DocSearch,
  search: Search,
  export: Export,
  settings: SettingTwo,
  translate: Translate,
  comment: Comment,
  improve: Magic,
  close: Close,
  save: Save,
  link: Link,
  refresh: Refresh,
  unlock: Unlock,
  'all-files': AllApplication,
  markdown: FileEditing,
  html: HtmlFive,
  locate: Local,
  titles: Text,
  outline: List,
  check: Check,
  read: BookOpen,
  code: Code,
  split: Split,
  focus: FullScreen,
  unfocus: OffScreen,
  format: Format,
  undo: Undo,
  delete: Delete,
  'new-file': FileAddition,
  copy: Copy,
  send: Send,
  config: Config,
  preview: Browser,
} as const

export type IconName = keyof typeof icons

// 锚点数据类型定义（按 PROJECT_PLAN.md 第四节）

export interface TextPositionSelector {
  type: "TextPosition";
  start: number;  // UTF-16 code unit offset
  end: number;
}

export interface TextQuoteSelector {
  type: "TextQuote";
  exact: string;
  prefix: string;
  suffix: string;
}

export interface BlockSelector {
  type: "Block";
  blockType: "paragraph" | "heading" | "list_item" | "code_block" | "blockquote" | "table_cell";
  blockOrdinal: number;
  blockHash: string;
}

export type AnchorStatus = "valid" | "drifted" | "orphaned";

export interface CommentAnchor {
  position: TextPositionSelector;
  quote: TextQuoteSelector;
  block?: BlockSelector;
  status: AnchorStatus;
  baseDocHash: string;
}

export interface Comment {
  id: string;
  threadId: string;
  author: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  resolved?: boolean;
}

export interface CommentThread {
  id: string;
  anchor: CommentAnchor;
  comments: Comment[];
  createdAt: string;
}

export interface CommentSidecar {
  schemaVersion: 1;
  documentFile: string;
  lastKnownDocHash: string;
  threads: CommentThread[];
}

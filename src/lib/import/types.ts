export type CommentType = 'info' | 'limit' | 'defect';
export type CommentCategory = 'low' | 'med' | 'high';
export type IssueKind = 'unsupported' | 'empty_in_source' | 'notice';

export type ParsedOption = {
  kind: 'choice' | 'unit';
  label: string;
  position: number;
};

export type ParsedComment = {
  name: string;
  textHtml: string;
  position: number;
  commentType: CommentType;
  category: CommentCategory | null;
  answerType: string;
  /** Checkbox rows are questions with options, not prose comments. */
  isQuestion: boolean;
  recommendation: string | null;
  defaultValue: string | null;
  estimateMin: number | null;
  estimateMax: number | null;
  sourceRow: number;
  /** Column J. Recorded for audit only — never used for ordering. */
  sourceOrder: number | null;
  options: ParsedOption[];
};

export type ParsedItem = {
  name: string;
  position: number;
  sourceRow: number;
  comments: ParsedComment[];
};

export type ParsedSection = {
  name: string;
  position: number;
  sourceRow: number;
  items: ParsedItem[];
};

export type ImportIssue = {
  kind: IssueKind;
  /** Null for template-level issues. */
  sourceRow: number | null;
  sourceColumn: string | null;
  locationPath: string | null;
  message: string;
  rawSnippet: string | null;
};

export type ImportResult = {
  templateName: string;
  sections: ParsedSection[];
  issues: ImportIssue[];
  stats: {
    sheetName: string;
    rowCount: number;
    columnCount: number;
    sectionCount: number;
    itemCount: number;
    commentCount: number;
    durationMs: number;
  };
};

/** Thrown when the file cannot be imported at all. */
export class ImportError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ImportError';
    this.code = code;
  }
}

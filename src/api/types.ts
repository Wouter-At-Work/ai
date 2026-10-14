export interface Paginated<T> {
  values: T[];
  next?: string;
  page?: number;
  size?: number;
}

export interface Link {
  href: string;
}

export interface Account {
  uuid: string;
  display_name: string;
  nickname?: string;
  links: { avatar: Link };
}

export interface Participant {
  user: Account;
  role: "PARTICIPANT" | "REVIEWER";
  approved: boolean;
  state: "approved" | "changes_requested" | null;
}

export interface Endpoint {
  branch: { name: string };
  commit: { hash: string } | null;
  repository: { full_name: string; name: string };
}

export interface Rendered {
  raw: string;
  html: string;
}

export interface PullRequest {
  id: number;
  title: string;
  state: "OPEN" | "MERGED" | "DECLINED" | "SUPERSEDED";
  draft?: boolean;
  author: Account;
  source: Endpoint;
  destination: Endpoint;
  created_on: string;
  updated_on: string;
  comment_count: number;
  task_count: number;
  summary?: Rendered;
  participants: Participant[];
  reviewers: Account[];
  links: { html: Link };
}

export interface InlinePosition {
  path: string;
  from?: number | null;
  to?: number | null;
  start_from?: number | null;
  start_to?: number | null;
  outdated?: boolean;
}

export interface Comment {
  id: number;
  content: Rendered;
  user: Account;
  created_on: string;
  updated_on: string;
  deleted: boolean;
  pending?: boolean;
  inline?: InlinePosition;
  parent?: { id: number };
  resolution?: { user: Account; created_on: string } | null;
}

export interface Commit {
  hash: string;
}

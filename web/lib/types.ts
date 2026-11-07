export interface Person { id: string; name: string; siteCount: number }
export interface Site { address: string; title: string; authorName: string; html: string }
export type Current =
  | { kind: 'page'; address: string; valid: boolean; site: Site | null; scrollY: number }
  | { kind: 'search'; query: string; scrollY: number };
export interface NavView { cursor: number; length: number; canBack: boolean; canForward: boolean; current: Current | null }
export type Via = 'typed' | 'link' | 'history' | 'search';
export interface HistoryItem { id: string; address: string; at: string; via: string; found: boolean; title: string | null }

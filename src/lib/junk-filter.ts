/**
 * Rules-based junk filter. Removes tabs that are clearly not user content
 * (login pages, auth callbacks, search homepages, browser internals, etc.)
 */

import { ParsedTab } from "./parse-urls";

const JUNK_PATTERNS: RegExp[] = [
  /^chrome:\/\//i,
  /^chrome-extension:\/\//i,
  /^about:/i,
  /^edge:\/\//i,
  /^file:\/\//i,
  /^moz-extension:\/\//i,

  // Auth / session pages
  /\/login\b/i,
  /\/signin\b/i,
  /\/sign-in\b/i,
  /\/logout\b/i,
  /\/signout\b/i,
  /\/auth\b/i,
  /\/callback\b/i,
  /\/oauth\b/i,
  /\/session\b/i,
  /\/sso\b/i,

  // Notifications / settings
  /\/notifications\b/i,
  /\/settings\b/i,
  /\/preferences\b/i,
  /\/account\b/i,

  // Blank / new tab
  /^https?:\/\/www\.google\.\w+\/?$/i,         // google.com homepage
  /^https?:\/\/www\.bing\.\w+\/?$/i,
  /^https?:\/\/newtab/i,

  // Google search results (but NOT specific searches — those have useful query params)
  // Only filter bare search pages without a query
  /google\.\w+\/search\?.*q=&/i,               // empty query
  /google\.\w+\/search\/?$/i,                   // no query at all
];

export interface FilterResult {
  kept: ParsedTab[];
  filtered: ParsedTab[];
}

export function filterJunk(tabs: ParsedTab[]): FilterResult {
  const kept: ParsedTab[] = [];
  const filtered: ParsedTab[] = [];

  for (const tab of tabs) {
    const isJunk = JUNK_PATTERNS.some(pattern => pattern.test(tab.url));
    if (isJunk) {
      filtered.push(tab);
    } else {
      kept.push(tab);
    }
  }

  return { kept, filtered };
}

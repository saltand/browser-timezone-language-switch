# Browser Timezone & Language Switch

Browser Timezone & Language Switch is a browser extension built with WXT and React. It lets you define per-domain rules that change the request `Accept-Language` header and spoof page-level language and timezone APIs, so websites behave as if the browser is running from a different locale.

## Features

- Create per-site rules with simple domain patterns such as `example.com` (exact host), `*.example.com` (the domain and all subdomains), or `*google*`
- Override `Accept-Language` for matching requests, and for every request made from a tab showing a matching site (including third-party APIs and CDNs)
- Spoof `navigator.language`, `navigator.languages`, the default locale of `Intl.*` and `toLocale*` methods, `Intl.DateTimeFormat`, and timezone-related `Date` behavior in the page context, including iframes
- Enable, disable, edit, delete, search, import, and export rules from the popup UI
- Build for Chromium-based browsers and Firefox with WXT

## Reliable early injection (Chromium)

Pages often read the language in their first inline script. To spoof before any page script runs, the extension registers a `chrome.userScripts` script, which Chromium only allows after you turn on **Allow User Scripts** on the extension's details page in `chrome://extensions` (developer mode before Chrome 138). Without it, the extension falls back to a later injection that some pages beat.

Firefox uses a registered content script and needs no extra setup.

Sites that pick the language from the URL, a cookie, your account settings, or your IP address ignore these signals; switch the language on the site itself in that case.

## Development

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build
```

## Release

```bash
pnpm release
```

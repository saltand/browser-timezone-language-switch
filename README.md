# Browser Timezone & Language Switch

Browser Timezone & Language Switch is a browser extension built with WXT and React. It lets you define per-domain rules that change the request `Accept-Language` header and spoof page-level language and timezone APIs, so websites behave as if the browser is running from a different locale.

## Features

- Create per-site rules with simple domain patterns such as `example.com`, `*.example.com`, or `*google*`
- Override `Accept-Language` for matching requests
- Spoof `navigator.language`, `navigator.languages`, `Intl.DateTimeFormat`, and timezone-related `Date` behavior in the page context
- Enable, disable, edit, delete, search, import, and export rules from the popup UI
- Build for Chromium-based browsers and Firefox with WXT

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

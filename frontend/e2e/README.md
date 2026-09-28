# Web regression tests

Run `npm run test:e2e` from `frontend/`. Playwright builds the production app and starts Vite preview at `127.0.0.1:4178`. The production build is intentional: development-only mock login must not hide authentication failures.

All API requests use explicit in-memory fixtures based on the backend controller contracts. Unknown API calls and requests to external sites fail the test; no production data is read or written. Each test gets a new browser context and API state. The browser clock is fixed at 2026-09-28 in America/Phoenix, which also catches UTC-midnight date shifts.

macOS uses the locally installed Google Chrome when available. To select a different executable, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. CI uses `npx playwright install --with-deps chromium` before running the suite. To test an existing production preview, set `PLAYWRIGHT_BASE_URL`; this bypasses the managed build and server.

`npm run test:e2e:report` opens the HTML report. Failed tests retain a screenshot and trace. Fixtures use synthetic credentials only.

The regression suite covers account changes and stale responses, chat history restoration, refresh failure, login errors, profile request loops, calendar dates/reminders/save recovery and downloaded iCalendar files, growth birthday input, knowledge filtering/retry, article desktop/mobile layout, account-specific name favorites, and check-in status/points refresh/error recovery. Pure calendar serialization tests check RFC 5545 line endings, dates, alarms, escaping, and UTF-8 line folding against the real implementation. Browser tests also reject unhandled page errors. Notification tests use a real Service Worker lifecycle and intercept only the permission prompt and OS notification surface, covering due times, completed/disabled events, deduplication, stale responses, and closing notifications on logout. The suite does not validate a deployed backend, medical answer quality, or OS notification settings/delivery.

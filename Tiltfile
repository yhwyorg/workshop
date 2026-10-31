# Sermon Workshop: the local development loop.
#
#   tilt up            then open http://localhost:10350
#
# Everything runs on this machine; there is no cluster. Production is static files
# on GitHub Pages, so the closest thing to production is the built site served as
# static files ("prod" below), and that is what the browser tests run against.
#
# Each check re-runs when the files it depends on change, so a save shows within
# seconds whether types, lint, unit tests and the browser tests still pass.

# Windows runs local_resource commands through cmd.exe; npm and npx work there and
# in bash alike, so every command below is a plain npm/npx call.

# scripts/deps.mjs installs only when package-lock.json's contents change; it explains
# the two Windows/Tilt traps (npm ci and a self-retriggering npm install) it avoids.
local_resource(
    'deps',
    cmd='node scripts/deps.mjs',
    deps=['package-lock.json'],
    labels=['setup'],
)

local_resource(
    'dev',
    serve_cmd='npx vite --port 5180 --strictPort',
    resource_deps=['deps'],
    readiness_probe=probe(http_get=http_get_action(port=5180, path='/'), period_secs=2),
    links=[link('http://localhost:5180', 'dev server (hot reload)')],
    labels=['run'],
)

local_resource(
    'typecheck',
    cmd='npx tsc -b',
    deps=['src', 'e2e', 'playwright.config.ts', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.e2e.json'],
    resource_deps=['deps'],
    labels=['checks'],
)

local_resource(
    'lint',
    cmd='npx eslint .',
    deps=['src', 'e2e', 'eslint.config.js'],
    resource_deps=['deps'],
    labels=['checks'],
)

local_resource(
    'unit',
    cmd='npx vitest run',
    deps=['src'],
    resource_deps=['deps'],
    labels=['checks'],
)

# The production build, rebuilt on every change and served as static files the way
# GitHub Pages serves it. `vite preview` serves whatever is in dist/, so a rebuild
# shows up without restarting it.
local_resource(
    'build',
    cmd='npx vite build',
    deps=['src', 'public', 'index.html', 'vite.config.ts'],
    resource_deps=['deps'],
    labels=['run'],
)

local_resource(
    'prod',
    serve_cmd='npx vite preview --port 4180 --strictPort',
    resource_deps=['build'],
    readiness_probe=probe(http_get=http_get_action(port=4180, path='/'), period_secs=2),
    links=[link('http://localhost:4180', 'production build')],
    labels=['run'],
)

# Browser tests on every change: Chromium on a desktop and WebKit at iPad landscape
# (the engine iPad Safari uses). They reuse "prod" rather than starting their own server.
#
# Not all four devices on every save: on this Windows machine Playwright's WebKit runs
# each test several times slower than Chromium (about 22s each, measured alone), and
# with three WebKit devices the full run grew to 10-11 minutes for 284 tests and timed
# out under its own load (a button "never stable" because WebKit drew no frames). Two
# devices keep the loop short; the full matrix is "browser-all" below, and CI runs it
# on every pull request, where it is reliable.
local_resource(
    'browser',
    cmd='npx playwright test --project=desktop --project=ipad-landscape',
    deps=['e2e', 'playwright.config.ts', 'dist'],
    # After the cheaper checks: a type error or failing unit test is reported in
    # seconds, and the browsers do not compete with them for the CPU.
    resource_deps=['prod', 'typecheck', 'lint', 'unit'],
    labels=['checks'],
)

# All four devices (adds iPad portrait and the phone). Run from the Tilt UI before
# opening a pull request that changes layout. Its own output folder, so it can't
# collide with the run above.
local_resource(
    'browser-all',
    cmd='npx playwright test --output=test-results-all',
    trigger_mode=TRIGGER_MODE_MANUAL,
    auto_init=False,
    resource_deps=['prod'],
    labels=['checks'],
)

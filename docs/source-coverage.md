# Source coverage audit

374 source streams accepted from 491 curated candidates. These are streams, not distinct vendors or a claim of comprehensive vulnerability coverage. A project may have both a release stream and an advisory stream.

Verification window: 2026-10-23T20:56:02.908Z through 2026-10-23T21:01:31.470Z. Registry SHA-256: `86e9878eb9436e0357bc0317c033cddf6b4b0f5a3e3211e98f81cef25cbe6211`.

## What verification means

Every enabled source returned parseable RSS/Atom and at least one usable document through the same adapter used by ingestion. Inline release feeds were checked across up to 30 entries; article feeds required a successful article fetch and extraction among the first three entries. Each check records a sample URL, text hash, text length, item count, and warnings. This is transport/parser verification, not a live LLM accuracy evaluation or an uptime guarantee.

Candidates were selected for deployed application attack surfaces, runtime/standard-library exposure, transitive parsing/authentication dependencies, privileged infrastructure roles, or official remediation notices. Upstream repositories and publisher pages are retained as provenance. Arbitrary security-news aggregation sites are not used to inflate coverage.

## Channel mix

| Channel | Streams | Meaning |
| --- | ---: | --- |
| mixed-announcements | 26 | Official news/release stream that may contain security fixes. |
| release-notes | 326 | Upstream release bodies; not equivalent to repository security-advisory coverage. |
| security-advisories | 22 | Dedicated advisory or public coordination stream; may also contain non-actionable notices. |

## Categories

| Category | Streams |
| --- | ---: |
| applications-ai | 44 |
| browsers | 1 |
| cloud-native | 44 |
| cloud-providers | 1 |
| coordination | 6 |
| data-platforms | 23 |
| devops-observability | 25 |
| dotnet-web | 16 |
| go-rust-libraries | 25 |
| identity-secrets | 18 |
| javascript-web | 43 |
| jvm-web | 18 |
| languages-runtimes | 29 |
| native-parsers-crypto | 22 |
| network-vendors | 11 |
| operating-systems | 7 |
| python-web | 31 |
| ruby-web | 10 |

## Maintenance follow-up

GitHub streams with a latest dated entry older than one year received an additional repository metadata review (see `sources/maintenance-review.json`). Archived or explicitly abandoned endpoints were excluded or a documented successor was added. The current Element Synapse endpoint was checked instead of the archived Matrix repository; it was excluded because the checked entries contained only version tags. A quiet but unarchived release stream remains eligible with a staleness warning; this does not assert that every repository is actively maintained.

## Known limitations

- GitHub release feeds are reused for their inline notes. GitHub tag-only entries are skipped, and projects whose checked feed contains no substantive release notes are excluded. External changelogs, assets, commits, and repository security advisories are not crawled automatically.
- Dedicated vendor pages without a working RSS/Atom endpoint need a separate adapter. Rejected candidates below are not enabled or counted. A rejection can reflect network access, temporary failure, or an unsupported format—not the absence of a vendor advisory service.
- Updates are watched only while entries remain in the current feed window. Every entry in a fetched feed is durably staged. Publishers can still remove entries between polls; monitor lag and add a historical API adapter where necessary.
- Exact-quote validation reduces invented fields but cannot prove correct product/version association. Production model evaluation remains required.
- No vendor coverage is inferred from a distribution package advisory: Debian or Ubuntu backport versions remain distinct from upstream fixed versions.
- This catalog does not yet include a structured OSV adapter.

## Enabled catalog

| Source | Category | Channel | Adapter | Feed | Warnings |
| --- | --- | --- | --- | --- | --- |
| [Node.js runtime](https://github.com/nodejs/node) | languages-runtimes | release-notes | feed-content | [RSS/Atom](https://github.com/nodejs/node/releases.atom) |  |
| [Rust compiler and standard library](https://github.com/rust-lang/rust) | languages-runtimes | release-notes | feed-content | [RSS/Atom](https://github.com/rust-lang/rust/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [Bun](https://github.com/oven-sh/bun) | languages-runtimes | release-notes | feed-content | [RSS/Atom](https://github.com/oven-sh/bun/releases.atom) | 5 checked entries were not usable (Feed item lacks substantive release notes) |
| [Deno](https://github.com/denoland/deno) | languages-runtimes | release-notes | feed-content | [RSS/Atom](https://github.com/denoland/deno/releases.atom) |  |
| [Elixir](https://github.com/elixir-lang/elixir) | languages-runtimes | release-notes | feed-content | [RSS/Atom](https://github.com/elixir-lang/elixir/releases.atom) | 4 checked entries were not usable (Feed item lacks substantive release notes) |
| [Erlang OTP](https://github.com/erlang/otp) | languages-runtimes | release-notes | feed-content | [RSS/Atom](https://github.com/erlang/otp/releases.atom) |  |
| [Julia](https://github.com/JuliaLang/julia) | languages-runtimes | release-notes | feed-content | [RSS/Atom](https://github.com/JuliaLang/julia/releases.atom) | 4 checked entries were not usable (Feed item lacks substantive release notes) |
| [Scala](https://github.com/scala/scala) | languages-runtimes | release-notes | feed-content | [RSS/Atom](https://github.com/scala/scala/releases.atom) | 4 checked entries were not usable (Feed item lacks substantive release notes) |
| [PHP runtime](https://github.com/php/php-src) | languages-runtimes | release-notes | feed-content | [RSS/Atom](https://github.com/php/php-src/releases.atom) | 6 checked entries were not usable (Feed item lacks substantive release notes) |
| [Composer](https://github.com/composer/composer) | languages-runtimes | release-notes | feed-content | [RSS/Atom](https://github.com/composer/composer/releases.atom) |  |
| [setuptools](https://github.com/pypa/setuptools) | languages-runtimes | release-notes | feed-content | [RSS/Atom](https://github.com/pypa/setuptools/releases.atom) | 9 checked entries were not usable (Feed item lacks substantive release notes) |
| [virtualenv](https://github.com/pypa/virtualenv) | languages-runtimes | release-notes | feed-content | [RSS/Atom](https://github.com/pypa/virtualenv/releases.atom) |  |
| [Poetry](https://github.com/python-poetry/poetry) | languages-runtimes | release-notes | feed-content | [RSS/Atom](https://github.com/python-poetry/poetry/releases.atom) |  |
| [uv](https://github.com/astral-sh/uv) | languages-runtimes | release-notes | feed-content | [RSS/Atom](https://github.com/astral-sh/uv/releases.atom) |  |
| [RubyGems and Bundler](https://github.com/ruby/rubygems) | languages-runtimes | release-notes | feed-content | [RSS/Atom](https://github.com/ruby/rubygems/releases.atom) |  |
| [npm](https://github.com/npm/cli) | languages-runtimes | release-notes | feed-content | [RSS/Atom](https://github.com/npm/cli/releases.atom) | 8 checked entries were not usable (Feed item lacks substantive release notes) |
| [pnpm](https://github.com/pnpm/pnpm) | languages-runtimes | release-notes | feed-content | [RSS/Atom](https://github.com/pnpm/pnpm/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [Yarn](https://github.com/yarnpkg/berry) | languages-runtimes | release-notes | feed-content | [RSS/Atom](https://github.com/yarnpkg/berry/releases.atom) | 9 checked entries were not usable (Feed item lacks substantive release notes) |
| [Apache Maven](https://github.com/apache/maven) | languages-runtimes | release-notes | feed-content | [RSS/Atom](https://github.com/apache/maven/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [Gradle](https://github.com/gradle/gradle) | languages-runtimes | release-notes | feed-content | [RSS/Atom](https://github.com/gradle/gradle/releases.atom) | 3 checked entries were not usable (Feed item lacks substantive release notes) |
| [Express](https://github.com/expressjs/express) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/expressjs/express/releases.atom) |  |
| [Fastify](https://github.com/fastify/fastify) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/fastify/fastify/releases.atom) | 2 checked entries were not usable (Feed item lacks substantive release notes) |
| [Koa](https://github.com/koajs/koa) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/koajs/koa/releases.atom) |  |
| [Hono](https://github.com/honojs/hono) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/honojs/hono/releases.atom) | 2 checked entries were not usable (Feed item lacks substantive release notes) |
| [NestJS](https://github.com/nestjs/nest) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/nestjs/nest/releases.atom) | 2 checked entries were not usable (Feed item lacks substantive release notes) |
| [Next.js](https://github.com/vercel/next.js) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/vercel/next.js/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [Nuxt](https://github.com/nuxt/nuxt) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/nuxt/nuxt/releases.atom) | 1 checked entries were not usable (Empty or oversized document; requires a dedicated adapter) |
| [SvelteKit](https://github.com/sveltejs/kit) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/sveltejs/kit/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [Svelte](https://github.com/sveltejs/svelte) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/sveltejs/svelte/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [React Router](https://github.com/remix-run/react-router) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/remix-run/react-router/releases.atom) | 9 checked entries were not usable (Feed item lacks substantive release notes) |
| [React](https://github.com/react/react) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/react/react/releases.atom) |  |
| [Vue](https://github.com/vuejs/core) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/vuejs/core/releases.atom) |  |
| [Angular](https://github.com/angular/angular) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/angular/angular/releases.atom) |  |
| [Vite](https://github.com/vitejs/vite) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/vitejs/vite/releases.atom) | 5 checked entries were not usable (Feed item lacks substantive release notes) |
| [webpack](https://github.com/webpack/webpack) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/webpack/webpack/releases.atom) |  |
| [Rollup](https://github.com/rollup/rollup) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/rollup/rollup/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [esbuild](https://github.com/evanw/esbuild) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/evanw/esbuild/releases.atom) |  |
| [Babel](https://github.com/babel/babel) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/babel/babel/releases.atom) |  |
| [Axios](https://github.com/axios/axios) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/axios/axios/releases.atom) |  |
| [node-fetch](https://github.com/node-fetch/node-fetch) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/node-fetch/node-fetch/releases.atom) | 4 checked entries were not usable (Feed item lacks substantive release notes); Latest dated entry is older than one year; monitor for source stagnation |
| [Undici](https://github.com/nodejs/undici) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/nodejs/undici/releases.atom) |  |
| [ws](https://github.com/websockets/ws) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/websockets/ws/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [Socket.IO](https://github.com/socketio/socket.io) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/socketio/socket.io/releases.atom) | 2 checked entries were not usable (Feed item lacks substantive release notes) |
| [body-parser](https://github.com/expressjs/body-parser) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/expressjs/body-parser/releases.atom) |  |
| [Multer](https://github.com/expressjs/multer) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/expressjs/multer/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [serve-static](https://github.com/expressjs/serve-static) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/expressjs/serve-static/releases.atom) | 3 checked entries were not usable (Feed item lacks substantive release notes) |
| [send](https://github.com/pillarjs/send) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/pillarjs/send/releases.atom) | 4 checked entries were not usable (Feed item lacks substantive release notes) |
| [htmlparser2](https://github.com/fb55/htmlparser2) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/fb55/htmlparser2/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [Cheerio](https://github.com/cheeriojs/cheerio) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/cheeriojs/cheerio/releases.atom) | 2 checked entries were not usable (Feed item lacks substantive release notes) |
| [DOMPurify](https://github.com/cure53/DOMPurify) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/cure53/DOMPurify/releases.atom) |  |
| [Marked](https://github.com/markedjs/marked) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/markedjs/marked/releases.atom) |  |
| [highlight.js](https://github.com/highlightjs/highlight.js) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/highlightjs/highlight.js/releases.atom) | 3 checked entries were not usable (Feed item lacks substantive release notes) |
| [Lodash](https://github.com/lodash/lodash) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/lodash/lodash/releases.atom) | 8 checked entries were not usable (Feed item lacks substantive release notes) |
| [Underscore](https://github.com/jashkenas/underscore) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/jashkenas/underscore/releases.atom) | 9 checked entries were not usable (Feed item lacks substantive release notes) |
| [Handlebars](https://github.com/handlebars-lang/handlebars.js) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/handlebars-lang/handlebars.js/releases.atom) | 7 checked entries were not usable (Feed item lacks substantive release notes) |
| [Pug](https://github.com/pugjs/pug) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/pugjs/pug/releases.atom) | 3 checked entries were not usable (Feed item lacks substantive release notes) |
| [Eta](https://github.com/bgub/eta) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/bgub/eta/releases.atom) | 3 checked entries were not usable (Feed item lacks substantive release notes) |
| [Ajv](https://github.com/ajv-validator/ajv) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/ajv-validator/ajv/releases.atom) | 2 checked entries were not usable (Feed item lacks substantive release notes) |
| [Zod](https://github.com/colinhacks/zod) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/colinhacks/zod/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/auth0/node-jsonwebtoken/releases.atom) | 8 checked entries were not usable (Feed item lacks substantive release notes) |
| [jose](https://github.com/panva/jose) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/panva/jose/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [bcrypt](https://github.com/kelektiv/node.bcrypt.js) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/kelektiv/node.bcrypt.js/releases.atom) | 6 checked entries were not usable (Feed item lacks substantive release notes); Latest dated entry is older than one year; monitor for source stagnation |
| [node-saml](https://github.com/node-saml/node-saml) | javascript-web | release-notes | feed-content | [RSS/Atom](https://github.com/node-saml/node-saml/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes); Latest dated entry is older than one year; monitor for source stagnation |
| [Flask](https://github.com/pallets/flask) | python-web | release-notes | feed-content | [RSS/Atom](https://github.com/pallets/flask/releases.atom) | 6 checked entries were not usable (Feed item lacks substantive release notes) |
| [Werkzeug](https://github.com/pallets/werkzeug) | python-web | release-notes | feed-content | [RSS/Atom](https://github.com/pallets/werkzeug/releases.atom) |  |
| [Jinja](https://github.com/pallets/jinja) | python-web | release-notes | feed-content | [RSS/Atom](https://github.com/pallets/jinja/releases.atom) | 3 checked entries were not usable (Feed item lacks substantive release notes); Latest dated entry is older than one year; monitor for source stagnation |
| [MarkupSafe](https://github.com/pallets/markupsafe) | python-web | release-notes | feed-content | [RSS/Atom](https://github.com/pallets/markupsafe/releases.atom) | 3 checked entries were not usable (Feed item lacks substantive release notes) |
| [ItsDangerous](https://github.com/pallets/itsdangerous) | python-web | release-notes | feed-content | [RSS/Atom](https://github.com/pallets/itsdangerous/releases.atom) | 4 checked entries were not usable (Feed item lacks substantive release notes); Latest dated entry is older than one year; monitor for source stagnation |
| [Starlette](https://github.com/Kludex/starlette) | python-web | release-notes | feed-content | [RSS/Atom](https://github.com/Kludex/starlette/releases.atom) |  |
| [FastAPI](https://github.com/fastapi/fastapi) | python-web | release-notes | feed-content | [RSS/Atom](https://github.com/fastapi/fastapi/releases.atom) | 3 checked entries were not usable (Feed item lacks substantive release notes) |
| [Uvicorn](https://github.com/Kludex/uvicorn) | python-web | release-notes | feed-content | [RSS/Atom](https://github.com/Kludex/uvicorn/releases.atom) |  |
| [HTTPX](https://github.com/encode/httpx) | python-web | release-notes | feed-content | [RSS/Atom](https://github.com/encode/httpx/releases.atom) | Latest dated entry is older than one year; monitor for source stagnation |
| [httpcore](https://github.com/encode/httpcore) | python-web | release-notes | feed-content | [RSS/Atom](https://github.com/encode/httpcore/releases.atom) | Latest dated entry is older than one year; monitor for source stagnation |
| [Requests](https://github.com/psf/requests) | python-web | release-notes | feed-content | [RSS/Atom](https://github.com/psf/requests/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [urllib3](https://github.com/urllib3/urllib3) | python-web | release-notes | feed-content | [RSS/Atom](https://github.com/urllib3/urllib3/releases.atom) |  |
| [aiohttp](https://github.com/aio-libs/aiohttp) | python-web | release-notes | feed-content | [RSS/Atom](https://github.com/aio-libs/aiohttp/releases.atom) |  |
| [Tornado](https://github.com/tornadoweb/tornado) | python-web | release-notes | feed-content | [RSS/Atom](https://github.com/tornadoweb/tornado/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [Gunicorn](https://github.com/benoitc/gunicorn) | python-web | release-notes | feed-content | [RSS/Atom](https://github.com/benoitc/gunicorn/releases.atom) |  |
| [Pydantic](https://github.com/pydantic/pydantic) | python-web | release-notes | feed-content | [RSS/Atom](https://github.com/pydantic/pydantic/releases.atom) | 5 checked entries were not usable (Feed item lacks substantive release notes) |
| [pydantic-core](https://github.com/pydantic/pydantic-core) | python-web | release-notes | feed-content | [RSS/Atom](https://github.com/pydantic/pydantic-core/releases.atom) | 2 checked entries were not usable (Feed item lacks substantive release notes) |
| [PyJWT](https://github.com/jpadilla/pyjwt) | python-web | release-notes | feed-content | [RSS/Atom](https://github.com/jpadilla/pyjwt/releases.atom) | 2 checked entries were not usable (Feed item lacks substantive release notes) |
| [python-xmlsec](https://github.com/xmlsec/python-xmlsec) | python-web | release-notes | feed-content | [RSS/Atom](https://github.com/xmlsec/python-xmlsec/releases.atom) |  |
| [Pillow](https://github.com/python-pillow/Pillow) | python-web | release-notes | feed-content | [RSS/Atom](https://github.com/python-pillow/Pillow/releases.atom) |  |
| [lxml](https://github.com/lxml/lxml) | python-web | release-notes | feed-content | [RSS/Atom](https://github.com/lxml/lxml/releases.atom) |  |
| [PyYAML](https://github.com/yaml/pyyaml) | python-web | release-notes | feed-content | [RSS/Atom](https://github.com/yaml/pyyaml/releases.atom) | 6 checked entries were not usable (Feed item lacks substantive release notes); Latest dated entry is older than one year; monitor for source stagnation |
| [SQLAlchemy](https://github.com/sqlalchemy/sqlalchemy) | python-web | release-notes | feed-content | [RSS/Atom](https://github.com/sqlalchemy/sqlalchemy/releases.atom) |  |
| [Psycopg](https://github.com/psycopg/psycopg) | python-web | release-notes | feed-content | [RSS/Atom](https://github.com/psycopg/psycopg/releases.atom) | 2 checked entries were not usable (Feed item lacks substantive release notes) |
| [redis-py](https://github.com/redis/redis-py) | python-web | release-notes | feed-content | [RSS/Atom](https://github.com/redis/redis-py/releases.atom) |  |
| [Celery](https://github.com/celery/celery) | python-web | release-notes | feed-content | [RSS/Atom](https://github.com/celery/celery/releases.atom) |  |
| [Kombu](https://github.com/celery/kombu) | python-web | release-notes | feed-content | [RSS/Atom](https://github.com/celery/kombu/releases.atom) |  |
| [jsonschema](https://github.com/python-jsonschema/jsonschema) | python-web | release-notes | feed-content | [RSS/Atom](https://github.com/python-jsonschema/jsonschema/releases.atom) |  |
| [Playwright Python](https://github.com/microsoft/playwright-python) | python-web | release-notes | feed-content | [RSS/Atom](https://github.com/microsoft/playwright-python/releases.atom) |  |
| [Selenium](https://github.com/seleniumhq/selenium) | python-web | release-notes | feed-content | [RSS/Atom](https://github.com/seleniumhq/selenium/releases.atom) |  |
| [Ruby on Rails](https://github.com/rails/rails) | ruby-web | release-notes | feed-content | [RSS/Atom](https://github.com/rails/rails/releases.atom) |  |
| [Puma](https://github.com/puma/puma) | ruby-web | release-notes | feed-content | [RSS/Atom](https://github.com/puma/puma/releases.atom) |  |
| [Nokogiri](https://github.com/sparklemotion/nokogiri) | ruby-web | release-notes | feed-content | [RSS/Atom](https://github.com/sparklemotion/nokogiri/releases.atom) |  |
| [Loofah](https://github.com/flavorjones/loofah) | ruby-web | release-notes | feed-content | [RSS/Atom](https://github.com/flavorjones/loofah/releases.atom) |  |
| [Rails HTML Sanitizer](https://github.com/rails/rails-html-sanitizer) | ruby-web | release-notes | feed-content | [RSS/Atom](https://github.com/rails/rails-html-sanitizer/releases.atom) | 2 checked entries were not usable (Feed item lacks substantive release notes) |
| [Devise](https://github.com/heartcombo/devise) | ruby-web | release-notes | feed-content | [RSS/Atom](https://github.com/heartcombo/devise/releases.atom) | 9 checked entries were not usable (Feed item lacks substantive release notes) |
| [WEBrick](https://github.com/ruby/webrick) | ruby-web | release-notes | feed-content | [RSS/Atom](https://github.com/ruby/webrick/releases.atom) | 3 checked entries were not usable (Feed item lacks substantive release notes) |
| [REXML](https://github.com/ruby/rexml) | ruby-web | release-notes | feed-content | [RSS/Atom](https://github.com/ruby/rexml/releases.atom) | Latest dated entry is older than one year; monitor for source stagnation |
| [net-imap](https://github.com/ruby/net-imap) | ruby-web | release-notes | feed-content | [RSS/Atom](https://github.com/ruby/net-imap/releases.atom) |  |
| [net-smtp](https://github.com/ruby/net-smtp) | ruby-web | release-notes | feed-content | [RSS/Atom](https://github.com/ruby/net-smtp/releases.atom) | 3 checked entries were not usable (Feed item lacks substantive release notes) |
| [Spring Framework](https://github.com/spring-projects/spring-framework) | jvm-web | release-notes | feed-content | [RSS/Atom](https://github.com/spring-projects/spring-framework/releases.atom) |  |
| [Spring Boot](https://github.com/spring-projects/spring-boot) | jvm-web | release-notes | feed-content | [RSS/Atom](https://github.com/spring-projects/spring-boot/releases.atom) |  |
| [Spring Security](https://github.com/spring-projects/spring-security) | jvm-web | release-notes | feed-content | [RSS/Atom](https://github.com/spring-projects/spring-security/releases.atom) |  |
| [Spring Cloud Gateway](https://github.com/spring-cloud/spring-cloud-gateway) | jvm-web | release-notes | feed-content | [RSS/Atom](https://github.com/spring-cloud/spring-cloud-gateway/releases.atom) |  |
| [Quarkus](https://github.com/quarkusio/quarkus) | jvm-web | release-notes | feed-content | [RSS/Atom](https://github.com/quarkusio/quarkus/releases.atom) | 5 checked entries were not usable (Feed item lacks substantive release notes; Empty or oversized document; requires a dedicated adapter) |
| [Micronaut](https://github.com/micronaut-projects/micronaut-core) | jvm-web | release-notes | feed-content | [RSS/Atom](https://github.com/micronaut-projects/micronaut-core/releases.atom) |  |
| [Netty](https://github.com/netty/netty) | jvm-web | release-notes | feed-content | [RSS/Atom](https://github.com/netty/netty/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [Undertow](https://github.com/undertow-io/undertow) | jvm-web | release-notes | feed-content | [RSS/Atom](https://github.com/undertow-io/undertow/releases.atom) | 8 checked entries were not usable (Feed item lacks substantive release notes) |
| [Apache Struts](https://github.com/apache/struts) | jvm-web | release-notes | feed-content | [RSS/Atom](https://github.com/apache/struts/releases.atom) | 2 checked entries were not usable (Feed item lacks substantive release notes) |
| [Apache Log4j](https://github.com/apache/logging-log4j2) | jvm-web | release-notes | feed-content | [RSS/Atom](https://github.com/apache/logging-log4j2/releases.atom) |  |
| [Logback](https://github.com/qos-ch/logback) | jvm-web | release-notes | feed-content | [RSS/Atom](https://github.com/qos-ch/logback/releases.atom) |  |
| [SLF4J](https://github.com/qos-ch/slf4j) | jvm-web | release-notes | feed-content | [RSS/Atom](https://github.com/qos-ch/slf4j/releases.atom) | 6 checked entries were not usable (Feed item lacks substantive release notes) |
| [Gson](https://github.com/google/gson) | jvm-web | release-notes | feed-content | [RSS/Atom](https://github.com/google/gson/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [Retrofit](https://github.com/lysine-dev/retrofit) | jvm-web | release-notes | feed-content | [RSS/Atom](https://github.com/lysine-dev/retrofit/releases.atom) | 6 checked entries were not usable (Feed item lacks substantive release notes); Latest dated entry is older than one year; monitor for source stagnation |
| [Apache Shiro](https://github.com/apache/shiro) | jvm-web | release-notes | feed-content | [RSS/Atom](https://github.com/apache/shiro/releases.atom) |  |
| [Apache Dubbo](https://github.com/apache/dubbo) | jvm-web | release-notes | feed-content | [RSS/Atom](https://github.com/apache/dubbo/releases.atom) |  |
| [JJWT](https://github.com/jwtk/jjwt) | jvm-web | release-notes | feed-content | [RSS/Atom](https://github.com/jwtk/jjwt/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes); Latest dated entry is older than one year; monitor for source stagnation |
| [.NET runtime](https://github.com/dotnet/runtime) | dotnet-web | release-notes | feed-content | [RSS/Atom](https://github.com/dotnet/runtime/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [ASP.NET Core](https://github.com/dotnet/aspnetcore) | dotnet-web | release-notes | feed-content | [RSS/Atom](https://github.com/dotnet/aspnetcore/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [.NET SDK](https://github.com/dotnet/sdk) | dotnet-web | release-notes | feed-content | [RSS/Atom](https://github.com/dotnet/sdk/releases.atom) | 6 checked entries were not usable (Feed item lacks substantive release notes) |
| [Entity Framework Core](https://github.com/dotnet/efcore) | dotnet-web | release-notes | feed-content | [RSS/Atom](https://github.com/dotnet/efcore/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [Json.NET](https://github.com/JamesNK/Newtonsoft.Json) | dotnet-web | release-notes | feed-content | [RSS/Atom](https://github.com/JamesNK/Newtonsoft.Json/releases.atom) | Latest dated entry is older than one year; monitor for source stagnation |
| [MessagePack for C#](https://github.com/MessagePack-CSharp/MessagePack-CSharp) | dotnet-web | release-notes | feed-content | [RSS/Atom](https://github.com/MessagePack-CSharp/MessagePack-CSharp/releases.atom) |  |
| [protobuf-net](https://github.com/protobuf-net/protobuf-net) | dotnet-web | release-notes | feed-content | [RSS/Atom](https://github.com/protobuf-net/protobuf-net/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [StackExchange.Redis](https://github.com/StackExchange/StackExchange.Redis) | dotnet-web | release-notes | feed-content | [RSS/Atom](https://github.com/StackExchange/StackExchange.Redis/releases.atom) | 4 checked entries were not usable (Feed item lacks substantive release notes) |
| [Npgsql](https://github.com/npgsql/npgsql) | dotnet-web | release-notes | feed-content | [RSS/Atom](https://github.com/npgsql/npgsql/releases.atom) | 4 checked entries were not usable (Feed item lacks substantive release notes) |
| [MySqlConnector](https://github.com/mysql-net/MySqlConnector) | dotnet-web | release-notes | feed-content | [RSS/Atom](https://github.com/mysql-net/MySqlConnector/releases.atom) | 2 checked entries were not usable (Feed item lacks substantive release notes) |
| [Duende products (including IdentityServer)](https://github.com/DuendeSoftware/products) | dotnet-web | release-notes | feed-content | [RSS/Atom](https://github.com/DuendeSoftware/products/releases.atom) | 2 checked entries were not usable (Feed item lacks substantive release notes) |
| [IdentityModel .NET](https://github.com/AzureAD/azure-activedirectory-identitymodel-extensions-for-dotnet) | dotnet-web | release-notes | feed-content | [RSS/Atom](https://github.com/AzureAD/azure-activedirectory-identitymodel-extensions-for-dotnet/releases.atom) |  |
| [YARP](https://github.com/dotnet/yarp) | dotnet-web | release-notes | feed-content | [RSS/Atom](https://github.com/dotnet/yarp/releases.atom) | Latest dated entry is older than one year; monitor for source stagnation |
| [Polly](https://github.com/App-vNext/Polly) | dotnet-web | release-notes | feed-content | [RSS/Atom](https://github.com/App-vNext/Polly/releases.atom) |  |
| [Serilog](https://github.com/serilog/serilog) | dotnet-web | release-notes | feed-content | [RSS/Atom](https://github.com/serilog/serilog/releases.atom) | 3 checked entries were not usable (Feed item lacks substantive release notes) |
| [NLog](https://github.com/NLog/NLog) | dotnet-web | release-notes | feed-content | [RSS/Atom](https://github.com/NLog/NLog/releases.atom) |  |
| [Gin](https://github.com/gin-gonic/gin) | go-rust-libraries | release-notes | feed-content | [RSS/Atom](https://github.com/gin-gonic/gin/releases.atom) |  |
| [Fiber](https://github.com/gofiber/fiber) | go-rust-libraries | release-notes | feed-content | [RSS/Atom](https://github.com/gofiber/fiber/releases.atom) |  |
| [Echo](https://github.com/labstack/echo) | go-rust-libraries | release-notes | feed-content | [RSS/Atom](https://github.com/labstack/echo/releases.atom) |  |
| [Chi](https://github.com/go-chi/chi) | go-rust-libraries | release-notes | feed-content | [RSS/Atom](https://github.com/go-chi/chi/releases.atom) |  |
| [Gorilla WebSocket](https://github.com/gorilla/websocket) | go-rust-libraries | release-notes | feed-content | [RSS/Atom](https://github.com/gorilla/websocket/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes); Latest dated entry is older than one year; monitor for source stagnation |
| [Gorilla Mux](https://github.com/gorilla/mux) | go-rust-libraries | release-notes | feed-content | [RSS/Atom](https://github.com/gorilla/mux/releases.atom) | Latest dated entry is older than one year; monitor for source stagnation |
| [Go JWT](https://github.com/golang-jwt/jwt) | go-rust-libraries | release-notes | feed-content | [RSS/Atom](https://github.com/golang-jwt/jwt/releases.atom) |  |
| [pgx](https://github.com/jackc/pgx) | go-rust-libraries | release-notes | feed-content | [RSS/Atom](https://github.com/jackc/pgx/releases.atom) | 9 checked entries were not usable (Feed item lacks substantive release notes) |
| [go-redis](https://github.com/redis/go-redis) | go-rust-libraries | release-notes | feed-content | [RSS/Atom](https://github.com/redis/go-redis/releases.atom) |  |
| [fasthttp](https://github.com/valyala/fasthttp) | go-rust-libraries | release-notes | feed-content | [RSS/Atom](https://github.com/valyala/fasthttp/releases.atom) |  |
| [quic-go](https://github.com/quic-go/quic-go) | go-rust-libraries | release-notes | feed-content | [RSS/Atom](https://github.com/quic-go/quic-go/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [Caddy](https://github.com/caddyserver/caddy) | go-rust-libraries | release-notes | feed-content | [RSS/Atom](https://github.com/caddyserver/caddy/releases.atom) | 2 checked entries were not usable (Feed item lacks substantive release notes) |
| [Hyper](https://github.com/hyperium/hyper) | go-rust-libraries | release-notes | feed-content | [RSS/Atom](https://github.com/hyperium/hyper/releases.atom) |  |
| [gRPC Rust (former Tonic repository)](https://github.com/grpc/grpc-rust) | go-rust-libraries | release-notes | feed-content | [RSS/Atom](https://github.com/grpc/grpc-rust/releases.atom) | 7 checked entries were not usable (Feed item lacks substantive release notes) |
| [Axum](https://github.com/tokio-rs/axum) | go-rust-libraries | release-notes | feed-content | [RSS/Atom](https://github.com/tokio-rs/axum/releases.atom) | 5 checked entries were not usable (Feed item lacks substantive release notes) |
| [Tokio](https://github.com/tokio-rs/tokio) | go-rust-libraries | release-notes | feed-content | [RSS/Atom](https://github.com/tokio-rs/tokio/releases.atom) | 4 checked entries were not usable (Feed item lacks substantive release notes) |
| [Actix Web](https://github.com/actix/actix-web) | go-rust-libraries | release-notes | feed-content | [RSS/Atom](https://github.com/actix/actix-web/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [Reqwest](https://github.com/seanmonstar/reqwest) | go-rust-libraries | release-notes | feed-content | [RSS/Atom](https://github.com/seanmonstar/reqwest/releases.atom) |  |
| [Rustls](https://github.com/rustls/rustls) | go-rust-libraries | release-notes | feed-content | [RSS/Atom](https://github.com/rustls/rustls/releases.atom) | 3 checked entries were not usable (Feed item lacks substantive release notes) |
| [WebPKI](https://github.com/rustls/webpki) | go-rust-libraries | release-notes | feed-content | [RSS/Atom](https://github.com/rustls/webpki/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [RustCrypto hashes](https://github.com/rustcrypto/hashes) | go-rust-libraries | release-notes | feed-content | [RSS/Atom](https://github.com/rustcrypto/hashes/releases.atom) | 3 checked entries were not usable (Feed item lacks substantive release notes) |
| [Serde](https://github.com/serde-rs/serde) | go-rust-libraries | release-notes | feed-content | [RSS/Atom](https://github.com/serde-rs/serde/releases.atom) | 5 checked entries were not usable (Feed item lacks substantive release notes) |
| [serde_json](https://github.com/serde-rs/json) | go-rust-libraries | release-notes | feed-content | [RSS/Atom](https://github.com/serde-rs/json/releases.atom) | 7 checked entries were not usable (Feed item lacks substantive release notes) |
| [zip crate](https://github.com/zip-rs/zip2) | go-rust-libraries | release-notes | feed-content | [RSS/Atom](https://github.com/zip-rs/zip2/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [OpenSSL](https://github.com/openssl/openssl) | native-parsers-crypto | release-notes | feed-content | [RSS/Atom](https://github.com/openssl/openssl/releases.atom) |  |
| [wolfSSL](https://github.com/wolfSSL/wolfssl) | native-parsers-crypto | release-notes | feed-content | [RSS/Atom](https://github.com/wolfSSL/wolfssl/releases.atom) | 6 checked entries were not usable (Feed item lacks substantive release notes; Empty or oversized document; requires a dedicated adapter) |
| [Mbed TLS](https://github.com/Mbed-TLS/mbedtls) | native-parsers-crypto | release-notes | feed-content | [RSS/Atom](https://github.com/Mbed-TLS/mbedtls/releases.atom) | 5 checked entries were not usable (Feed item lacks substantive release notes) |
| [libsodium](https://github.com/jedisct1/libsodium) | native-parsers-crypto | release-notes | feed-content | [RSS/Atom](https://github.com/jedisct1/libsodium/releases.atom) | 7 checked entries were not usable (Feed item lacks substantive release notes) |
| [nghttp2](https://github.com/nghttp2/nghttp2) | native-parsers-crypto | release-notes | feed-content | [RSS/Atom](https://github.com/nghttp2/nghttp2/releases.atom) |  |
| [ngtcp2](https://github.com/ngtcp2/ngtcp2) | native-parsers-crypto | release-notes | feed-content | [RSS/Atom](https://github.com/ngtcp2/ngtcp2/releases.atom) |  |
| [Expat](https://github.com/libexpat/libexpat) | native-parsers-crypto | release-notes | feed-content | [RSS/Atom](https://github.com/libexpat/libexpat/releases.atom) | 3 checked entries were not usable (Feed item lacks substantive release notes) |
| [zlib](https://github.com/madler/zlib) | native-parsers-crypto | release-notes | feed-content | [RSS/Atom](https://github.com/madler/zlib/releases.atom) | 6 checked entries were not usable (Feed item lacks substantive release notes) |
| [Zstandard](https://github.com/facebook/zstd) | native-parsers-crypto | release-notes | feed-content | [RSS/Atom](https://github.com/facebook/zstd/releases.atom) | 4 checked entries were not usable (Feed item lacks substantive release notes); Latest dated entry is older than one year; monitor for source stagnation |
| [XZ Utils](https://github.com/tukaani-project/xz) | native-parsers-crypto | release-notes | feed-content | [RSS/Atom](https://github.com/tukaani-project/xz/releases.atom) |  |
| [libarchive](https://github.com/libarchive/libarchive) | native-parsers-crypto | release-notes | feed-content | [RSS/Atom](https://github.com/libarchive/libarchive/releases.atom) |  |
| [libjpeg-turbo](https://github.com/libjpeg-turbo/libjpeg-turbo) | native-parsers-crypto | release-notes | feed-content | [RSS/Atom](https://github.com/libjpeg-turbo/libjpeg-turbo/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [libvips](https://github.com/libvips/libvips) | native-parsers-crypto | release-notes | feed-content | [RSS/Atom](https://github.com/libvips/libvips/releases.atom) |  |
| [libgit2](https://github.com/libgit2/libgit2) | native-parsers-crypto | release-notes | feed-content | [RSS/Atom](https://github.com/libgit2/libgit2/releases.atom) |  |
| [libssh2](https://github.com/libssh2/libssh2) | native-parsers-crypto | release-notes | feed-content | [RSS/Atom](https://github.com/libssh2/libssh2/releases.atom) | 6 checked entries were not usable (Feed item lacks substantive release notes); Latest dated entry is older than one year; monitor for source stagnation |
| [c-ares](https://github.com/c-ares/c-ares) | native-parsers-crypto | release-notes | feed-content | [RSS/Atom](https://github.com/c-ares/c-ares/releases.atom) |  |
| [libuv](https://github.com/libuv/libuv) | native-parsers-crypto | release-notes | feed-content | [RSS/Atom](https://github.com/libuv/libuv/releases.atom) |  |
| [JSON for Modern C++](https://github.com/nlohmann/json) | native-parsers-crypto | release-notes | feed-content | [RSS/Atom](https://github.com/nlohmann/json/releases.atom) | Latest dated entry is older than one year; monitor for source stagnation |
| [Protocol Buffers](https://github.com/protocolbuffers/protobuf) | native-parsers-crypto | release-notes | feed-content | [RSS/Atom](https://github.com/protocolbuffers/protobuf/releases.atom) | 5 checked entries were not usable (Feed item lacks substantive release notes) |
| [gRPC](https://github.com/grpc/grpc) | native-parsers-crypto | release-notes | feed-content | [RSS/Atom](https://github.com/grpc/grpc/releases.atom) |  |
| [Apache Thrift](https://github.com/apache/thrift) | native-parsers-crypto | release-notes | feed-content | [RSS/Atom](https://github.com/apache/thrift/releases.atom) |  |
| [Redis](https://github.com/redis/redis) | data-platforms | release-notes | feed-content | [RSS/Atom](https://github.com/redis/redis/releases.atom) |  |
| [Valkey](https://github.com/valkey-io/valkey) | data-platforms | release-notes | feed-content | [RSS/Atom](https://github.com/valkey-io/valkey/releases.atom) |  |
| [etcd](https://github.com/etcd-io/etcd) | data-platforms | release-notes | feed-content | [RSS/Atom](https://github.com/etcd-io/etcd/releases.atom) | 7 checked entries were not usable (Feed item lacks substantive release notes) |
| [CockroachDB](https://github.com/cockroachdb/cockroach) | data-platforms | release-notes | feed-content | [RSS/Atom](https://github.com/cockroachdb/cockroach/releases.atom) | 7 checked entries were not usable (Feed item lacks substantive release notes) |
| [Elasticsearch](https://github.com/elastic/elasticsearch) | data-platforms | release-notes | feed-content | [RSS/Atom](https://github.com/elastic/elasticsearch/releases.atom) |  |
| [OpenSearch](https://github.com/opensearch-project/OpenSearch) | data-platforms | release-notes | feed-content | [RSS/Atom](https://github.com/opensearch-project/OpenSearch/releases.atom) |  |
| [Apache Lucene](https://github.com/apache/lucene) | data-platforms | release-notes | feed-content | [RSS/Atom](https://github.com/apache/lucene/releases.atom) |  |
| [Apache Pulsar](https://github.com/apache/pulsar) | data-platforms | release-notes | feed-content | [RSS/Atom](https://github.com/apache/pulsar/releases.atom) | 6 checked entries were not usable (Feed item lacks substantive release notes) |
| [Apache Superset](https://github.com/apache/superset) | data-platforms | release-notes | feed-content | [RSS/Atom](https://github.com/apache/superset/releases.atom) |  |
| [Presto](https://github.com/prestodb/presto) | data-platforms | release-notes | feed-content | [RSS/Atom](https://github.com/prestodb/presto/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [DuckDB](https://github.com/duckdb/duckdb) | data-platforms | release-notes | feed-content | [RSS/Atom](https://github.com/duckdb/duckdb/releases.atom) | 1 checked entries were not usable (Empty or oversized document; requires a dedicated adapter) |
| [Qdrant](https://github.com/qdrant/qdrant) | data-platforms | release-notes | feed-content | [RSS/Atom](https://github.com/qdrant/qdrant/releases.atom) |  |
| [Milvus](https://github.com/milvus-io/milvus) | data-platforms | release-notes | feed-content | [RSS/Atom](https://github.com/milvus-io/milvus/releases.atom) | 7 checked entries were not usable (Feed item lacks substantive release notes) |
| [Weaviate](https://github.com/weaviate/weaviate) | data-platforms | release-notes | feed-content | [RSS/Atom](https://github.com/weaviate/weaviate/releases.atom) |  |
| [Chroma](https://github.com/chroma-core/chroma) | data-platforms | release-notes | feed-content | [RSS/Atom](https://github.com/chroma-core/chroma/releases.atom) | 2 checked entries were not usable (Feed item lacks substantive release notes) |
| [RabbitMQ](https://github.com/rabbitmq/rabbitmq-server) | data-platforms | release-notes | feed-content | [RSS/Atom](https://github.com/rabbitmq/rabbitmq-server/releases.atom) |  |
| [NATS](https://github.com/nats-io/nats-server) | data-platforms | release-notes | feed-content | [RSS/Atom](https://github.com/nats-io/nats-server/releases.atom) |  |
| [Apache ActiveMQ](https://github.com/apache/activemq) | data-platforms | release-notes | feed-content | [RSS/Atom](https://github.com/apache/activemq/releases.atom) |  |
| [Kubernetes](https://github.com/kubernetes/kubernetes) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/kubernetes/kubernetes/releases.atom) |  |
| [containerd](https://github.com/containerd/containerd) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/containerd/containerd/releases.atom) | 1 checked entries were not usable (Empty or oversized document; requires a dedicated adapter) |
| [runc](https://github.com/opencontainers/runc) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/opencontainers/runc/releases.atom) |  |
| [Moby](https://github.com/moby/moby) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/moby/moby/releases.atom) | 4 checked entries were not usable (Feed item lacks substantive release notes) |
| [BuildKit](https://github.com/moby/buildkit) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/moby/buildkit/releases.atom) | 3 checked entries were not usable (Feed item lacks substantive release notes) |
| [Podman](https://github.com/podman-container-tools/podman) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/podman-container-tools/podman/releases.atom) |  |
| [Buildah](https://github.com/podman-container-tools/buildah) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/podman-container-tools/buildah/releases.atom) |  |
| [Skopeo](https://github.com/podman-container-tools/skopeo) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/podman-container-tools/skopeo/releases.atom) |  |
| [CRI-O](https://github.com/cri-o/cri-o) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/cri-o/cri-o/releases.atom) |  |
| [Helm](https://github.com/helm/helm) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/helm/helm/releases.atom) |  |
| [Argo CD](https://github.com/argoproj/argo-cd) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/argoproj/argo-cd/releases.atom) |  |
| [Argo Workflows](https://github.com/argoproj/argo-workflows) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/argoproj/argo-workflows/releases.atom) |  |
| [Flux](https://github.com/fluxcd/flux2) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/fluxcd/flux2/releases.atom) |  |
| [Linkerd](https://github.com/linkerd/linkerd2) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/linkerd/linkerd2/releases.atom) |  |
| [Envoy](https://github.com/envoyproxy/envoy) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/envoyproxy/envoy/releases.atom) |  |
| [Traefik](https://github.com/traefik/traefik) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/traefik/traefik/releases.atom) |  |
| [NGINX](https://github.com/nginx/nginx) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/nginx/nginx/releases.atom) |  |
| [Kong](https://github.com/Kong/kong) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/Kong/kong/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [Apache APISIX](https://github.com/apache/apisix) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/apache/apisix/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [Cilium](https://github.com/cilium/cilium) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/cilium/cilium/releases.atom) | 6 checked entries were not usable (Feed item lacks substantive release notes) |
| [Calico](https://github.com/projectcalico/calico) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/projectcalico/calico/releases.atom) | 7 checked entries were not usable (Feed item lacks substantive release notes) |
| [Ingress NGINX](https://github.com/kubernetes/ingress-nginx) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/kubernetes/ingress-nginx/releases.atom) |  |
| [Gateway API](https://github.com/kubernetes-sigs/gateway-api) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/kubernetes-sigs/gateway-api/releases.atom) | 4 checked entries were not usable (Feed item lacks substantive release notes) |
| [cert-manager](https://github.com/cert-manager/cert-manager) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/cert-manager/cert-manager/releases.atom) |  |
| [ExternalDNS](https://github.com/kubernetes-sigs/external-dns) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/kubernetes-sigs/external-dns/releases.atom) | 3 checked entries were not usable (Feed item lacks substantive release notes) |
| [External Secrets](https://github.com/external-secrets/external-secrets) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/external-secrets/external-secrets/releases.atom) | 5 checked entries were not usable (Feed item lacks substantive release notes) |
| [Kyverno](https://github.com/kyverno/kyverno) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/kyverno/kyverno/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [Open Policy Agent](https://github.com/open-policy-agent/opa) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/open-policy-agent/opa/releases.atom) |  |
| [Gatekeeper](https://github.com/open-policy-agent/gatekeeper) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/open-policy-agent/gatekeeper/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [Metrics Server](https://github.com/kubernetes-sigs/metrics-server) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/kubernetes-sigs/metrics-server/releases.atom) |  |
| [Longhorn](https://github.com/longhorn/longhorn) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/longhorn/longhorn/releases.atom) | 5 checked entries were not usable (Feed item lacks substantive release notes) |
| [Rook](https://github.com/rook/rook) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/rook/rook/releases.atom) | 2 checked entries were not usable (Feed item lacks substantive release notes) |
| [MinIO](https://github.com/minio/minio) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/minio/minio/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [Harbor](https://github.com/goharbor/harbor) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/goharbor/harbor/releases.atom) |  |
| [Distribution registry](https://github.com/distribution/distribution) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/distribution/distribution/releases.atom) |  |
| [Terraform](https://github.com/hashicorp/terraform) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/hashicorp/terraform/releases.atom) |  |
| [OpenTofu](https://github.com/opentofu/opentofu) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/opentofu/opentofu/releases.atom) |  |
| [Consul](https://github.com/hashicorp/consul) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/hashicorp/consul/releases.atom) | 6 checked entries were not usable (Feed item lacks substantive release notes) |
| [Nomad](https://github.com/hashicorp/nomad) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/hashicorp/nomad/releases.atom) |  |
| [Pulumi](https://github.com/pulumi/pulumi) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/pulumi/pulumi/releases.atom) | 2 checked entries were not usable (Feed item lacks substantive release notes) |
| [Crossplane](https://github.com/crossplane/crossplane) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/crossplane/crossplane/releases.atom) | 3 checked entries were not usable (Feed item lacks substantive release notes) |
| [Keycloak](https://github.com/keycloak/keycloak) | identity-secrets | release-notes | feed-content | [RSS/Atom](https://github.com/keycloak/keycloak/releases.atom) | 4 checked entries were not usable (Empty or oversized document; requires a dedicated adapter; Feed item lacks substantive release notes) |
| [Authelia](https://github.com/authelia/authelia) | identity-secrets | release-notes | feed-content | [RSS/Atom](https://github.com/authelia/authelia/releases.atom) |  |
| [ZITADEL](https://github.com/zitadel/zitadel) | identity-secrets | release-notes | feed-content | [RSS/Atom](https://github.com/zitadel/zitadel/releases.atom) |  |
| [authentik](https://github.com/goauthentik/authentik) | identity-secrets | release-notes | feed-content | [RSS/Atom](https://github.com/goauthentik/authentik/releases.atom) | 2 checked entries were not usable (Feed item lacks substantive release notes) |
| [Ory Kratos](https://github.com/ory/kratos) | identity-secrets | release-notes | feed-content | [RSS/Atom](https://github.com/ory/kratos/releases.atom) |  |
| [Ory Hydra](https://github.com/ory/hydra) | identity-secrets | release-notes | feed-content | [RSS/Atom](https://github.com/ory/hydra/releases.atom) | 3 checked entries were not usable (Feed item lacks substantive release notes) |
| [Ory Keto](https://github.com/ory/keto) | identity-secrets | release-notes | feed-content | [RSS/Atom](https://github.com/ory/keto/releases.atom) | 4 checked entries were not usable (Feed item lacks substantive release notes) |
| [Dex](https://github.com/dexidp/dex) | identity-secrets | release-notes | feed-content | [RSS/Atom](https://github.com/dexidp/dex/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [OAuth2 Proxy](https://github.com/oauth2-proxy/oauth2-proxy) | identity-secrets | release-notes | feed-content | [RSS/Atom](https://github.com/oauth2-proxy/oauth2-proxy/releases.atom) |  |
| [Casbin](https://github.com/apache/casbin) | identity-secrets | release-notes | feed-content | [RSS/Atom](https://github.com/apache/casbin/releases.atom) |  |
| [OpenFGA](https://github.com/openfga/openfga) | identity-secrets | release-notes | feed-content | [RSS/Atom](https://github.com/openfga/openfga/releases.atom) |  |
| [SpiceDB](https://github.com/authzed/spicedb) | identity-secrets | release-notes | feed-content | [RSS/Atom](https://github.com/authzed/spicedb/releases.atom) |  |
| [Vault](https://github.com/hashicorp/vault) | identity-secrets | release-notes | feed-content | [RSS/Atom](https://github.com/hashicorp/vault/releases.atom) | 3 checked entries were not usable (Empty or oversized document; requires a dedicated adapter; Feed item lacks substantive release notes) |
| [OpenBao](https://github.com/openbao/openbao) | identity-secrets | release-notes | feed-content | [RSS/Atom](https://github.com/openbao/openbao/releases.atom) | 4 checked entries were not usable (Feed item lacks substantive release notes) |
| [step-ca](https://github.com/smallstep/certificates) | identity-secrets | release-notes | feed-content | [RSS/Atom](https://github.com/smallstep/certificates/releases.atom) | 2 checked entries were not usable (Feed item lacks substantive release notes) |
| [Bitwarden server](https://github.com/bitwarden/server) | identity-secrets | release-notes | feed-content | [RSS/Atom](https://github.com/bitwarden/server/releases.atom) |  |
| [Vaultwarden](https://github.com/dani-garcia/vaultwarden) | identity-secrets | release-notes | feed-content | [RSS/Atom](https://github.com/dani-garcia/vaultwarden/releases.atom) |  |
| [Jenkins](https://github.com/jenkinsci/jenkins) | devops-observability | release-notes | feed-content | [RSS/Atom](https://github.com/jenkinsci/jenkins/releases.atom) |  |
| [GitHub Actions runner](https://github.com/actions/runner) | devops-observability | release-notes | feed-content | [RSS/Atom](https://github.com/actions/runner/releases.atom) |  |
| [GitHub Actions checkout](https://github.com/actions/checkout) | devops-observability | release-notes | feed-content | [RSS/Atom](https://github.com/actions/checkout/releases.atom) | 4 checked entries were not usable (Feed item lacks substantive release notes) |
| [GitHub Actions cache](https://github.com/actions/cache) | devops-observability | release-notes | feed-content | [RSS/Atom](https://github.com/actions/cache/releases.atom) | 2 checked entries were not usable (Feed item lacks substantive release notes) |
| [Woodpecker CI](https://github.com/woodpecker-ci/woodpecker) | devops-observability | release-notes | feed-content | [RSS/Atom](https://github.com/woodpecker-ci/woodpecker/releases.atom) |  |
| [Gitea alternate location](https://github.com/go-gitea/gitea) | devops-observability | release-notes | feed-content | [RSS/Atom](https://github.com/go-gitea/gitea/releases.atom) | 2 checked entries were not usable (Feed item lacks substantive release notes) |
| [Prometheus](https://github.com/prometheus/prometheus) | devops-observability | release-notes | feed-content | [RSS/Atom](https://github.com/prometheus/prometheus/releases.atom) | 5 checked entries were not usable (Feed item lacks substantive release notes) |
| [Alertmanager](https://github.com/prometheus/alertmanager) | devops-observability | release-notes | feed-content | [RSS/Atom](https://github.com/prometheus/alertmanager/releases.atom) | 2 checked entries were not usable (Feed item lacks substantive release notes) |
| [Node Exporter](https://github.com/prometheus/node_exporter) | devops-observability | release-notes | feed-content | [RSS/Atom](https://github.com/prometheus/node_exporter/releases.atom) | 3 checked entries were not usable (Feed item lacks substantive release notes) |
| [Grafana](https://github.com/grafana/grafana) | devops-observability | release-notes | feed-content | [RSS/Atom](https://github.com/grafana/grafana/releases.atom) |  |
| [Loki](https://github.com/grafana/loki) | devops-observability | release-notes | feed-content | [RSS/Atom](https://github.com/grafana/loki/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [Tempo](https://github.com/grafana/tempo) | devops-observability | release-notes | feed-content | [RSS/Atom](https://github.com/grafana/tempo/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [Mimir](https://github.com/grafana/mimir) | devops-observability | release-notes | feed-content | [RSS/Atom](https://github.com/grafana/mimir/releases.atom) |  |
| [OpenTelemetry Collector](https://github.com/open-telemetry/opentelemetry-collector) | devops-observability | release-notes | feed-content | [RSS/Atom](https://github.com/open-telemetry/opentelemetry-collector/releases.atom) | 9 checked entries were not usable (Feed item lacks substantive release notes) |
| [OpenTelemetry Collector Contrib](https://github.com/open-telemetry/opentelemetry-collector-contrib) | devops-observability | release-notes | feed-content | [RSS/Atom](https://github.com/open-telemetry/opentelemetry-collector-contrib/releases.atom) | 9 checked entries were not usable (Feed item lacks substantive release notes) |
| [Fluent Bit](https://github.com/fluent/fluent-bit) | devops-observability | release-notes | feed-content | [RSS/Atom](https://github.com/fluent/fluent-bit/releases.atom) |  |
| [Fluentd](https://github.com/fluent/fluentd) | devops-observability | release-notes | feed-content | [RSS/Atom](https://github.com/fluent/fluentd/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [Vector](https://github.com/vectordotdev/vector) | devops-observability | release-notes | feed-content | [RSS/Atom](https://github.com/vectordotdev/vector/releases.atom) | 9 checked entries were not usable (Feed item lacks substantive release notes) |
| [Jaeger](https://github.com/jaegertracing/jaeger) | devops-observability | release-notes | feed-content | [RSS/Atom](https://github.com/jaegertracing/jaeger/releases.atom) |  |
| [Sentry](https://github.com/getsentry/sentry) | devops-observability | release-notes | feed-content | [RSS/Atom](https://github.com/getsentry/sentry/releases.atom) | 4 checked entries were not usable (Feed item lacks substantive release notes; Empty or oversized document; requires a dedicated adapter) |
| [Ansible](https://github.com/ansible/ansible) | devops-observability | release-notes | feed-content | [RSS/Atom](https://github.com/ansible/ansible/releases.atom) |  |
| [Puppet](https://github.com/puppetlabs/puppet) | devops-observability | release-notes | feed-content | [RSS/Atom](https://github.com/puppetlabs/puppet/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes); Latest dated entry is older than one year; monitor for source stagnation |
| [ownCloud](https://github.com/owncloud/core) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/owncloud/core/releases.atom) | 4 checked entries were not usable (Feed item lacks substantive release notes) |
| [Mattermost](https://github.com/mattermost/mattermost) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/mattermost/mattermost/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [Rocket.Chat](https://github.com/RocketChat/Rocket.Chat) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/RocketChat/Rocket.Chat/releases.atom) |  |
| [Mastodon](https://github.com/mastodon/mastodon) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/mastodon/mastodon/releases.atom) |  |
| [Immich](https://github.com/immich-app/immich) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/immich-app/immich/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [Paperless-ngx](https://github.com/paperless-ngx/paperless-ngx) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/paperless-ngx/paperless-ngx/releases.atom) |  |
| [Jellyfin](https://github.com/jellyfin/jellyfin) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/jellyfin/jellyfin/releases.atom) | 1 checked entries were not usable (Empty or oversized document; requires a dedicated adapter) |
| [Home Assistant](https://github.com/home-assistant/core) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/home-assistant/core/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [n8n](https://github.com/n8n-io/n8n) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/n8n-io/n8n/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [Appsmith](https://github.com/appsmithorg/appsmith) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/appsmithorg/appsmith/releases.atom) |  |
| [ToolJet](https://github.com/ToolJet/ToolJet) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/ToolJet/ToolJet/releases.atom) |  |
| [Strapi](https://github.com/strapi/strapi) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/strapi/strapi/releases.atom) |  |
| [Directus](https://github.com/directus/directus) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/directus/directus/releases.atom) |  |
| [Payload CMS](https://github.com/payloadcms/payload) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/payloadcms/payload/releases.atom) |  |
| [WordPress](https://github.com/WordPress/wordpress-develop) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/WordPress/wordpress-develop/releases.atom) |  |
| [Laravel](https://github.com/laravel/framework) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/laravel/framework/releases.atom) | 2 checked entries were not usable (Feed item lacks substantive release notes) |
| [Symfony](https://github.com/symfony/symfony) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/symfony/symfony/releases.atom) |  |
| [Guzzle](https://github.com/guzzle/guzzle) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/guzzle/guzzle/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [Twig](https://github.com/twigphp/Twig) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/twigphp/Twig/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [PHPMailer](https://github.com/PHPMailer/PHPMailer) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/PHPMailer/PHPMailer/releases.atom) |  |
| [phpseclib](https://github.com/phpseclib/phpseclib) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/phpseclib/phpseclib/releases.atom) | 2 checked entries were not usable (Feed item lacks substantive release notes) |
| [Roundcube](https://github.com/roundcube/roundcubemail) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/roundcube/roundcubemail/releases.atom) |  |
| [Ollama](https://github.com/ollama/ollama) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/ollama/ollama/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [vLLM](https://github.com/vllm-project/vllm) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/vllm-project/vllm/releases.atom) | 4 checked entries were not usable (Feed item lacks substantive release notes) |
| [llama.cpp](https://github.com/ggml-org/llama.cpp) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/ggml-org/llama.cpp/releases.atom) | 2 checked entries were not usable (Feed item lacks substantive release notes) |
| [Transformers](https://github.com/huggingface/transformers) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/huggingface/transformers/releases.atom) |  |
| [Tokenizers](https://github.com/huggingface/tokenizers) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/huggingface/tokenizers/releases.atom) | 6 checked entries were not usable (Feed item lacks substantive release notes) |
| [Safetensors](https://github.com/safetensors/safetensors) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/safetensors/safetensors/releases.atom) | 2 checked entries were not usable (Feed item lacks substantive release notes) |
| [PyTorch](https://github.com/pytorch/pytorch) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/pytorch/pytorch/releases.atom) | 5 checked entries were not usable (Feed item lacks substantive release notes) |
| [TensorFlow](https://github.com/tensorflow/tensorflow) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/tensorflow/tensorflow/releases.atom) |  |
| [Ray](https://github.com/ray-project/ray) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/ray-project/ray/releases.atom) |  |
| [MLflow](https://github.com/mlflow/mlflow) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/mlflow/mlflow/releases.atom) | 3 checked entries were not usable (Feed item lacks substantive release notes) |
| [LangChain](https://github.com/langchain-ai/langchain) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/langchain-ai/langchain/releases.atom) |  |
| [LangChain.js](https://github.com/langchain-ai/langchainjs) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/langchain-ai/langchainjs/releases.atom) | 6 checked entries were not usable (Feed item lacks substantive release notes) |
| [LlamaIndex](https://github.com/run-llama/llama_index) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/run-llama/llama_index/releases.atom) | 1 checked entries were not usable (Empty or oversized document; requires a dedicated adapter) |
| [Dify](https://github.com/langgenius/dify) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/langgenius/dify/releases.atom) | 5 checked entries were not usable (Empty or oversized document; requires a dedicated adapter) |
| [Open WebUI](https://github.com/open-webui/open-webui) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/open-webui/open-webui/releases.atom) | 4 checked entries were not usable (Empty or oversized document; requires a dedicated adapter) |
| [Ruby](https://www.ruby-lang.org/) | languages-runtimes | mixed-announcements | article | [RSS/Atom](https://www.ruby-lang.org/en/feeds/news.rss) |  |
| [Node.js announcements](https://nodejs.org/) | languages-runtimes | mixed-announcements | article | [RSS/Atom](https://nodejs.org/en/feed/blog.xml) |  |
| [oss-security](https://oss-security.openwall.org/) | coordination | security-advisories | article | [RSS/Atom](https://seclists.org/rss/oss-sec.rss) |  |
| [Debian DSA](https://www.debian.org/security/) | operating-systems | security-advisories | article | [RSS/Atom](https://www.debian.org/security/dsa-long) |  |
| [Ubuntu USN](https://ubuntu.com/security/notices) | operating-systems | security-advisories | article | [RSS/Atom](https://ubuntu.com/security/notices/rss.xml) |  |
| [Gentoo GLSA](https://security.gentoo.org/) | operating-systems | security-advisories | article | [RSS/Atom](https://security.gentoo.org/glsa/feed.rss) |  |
| [Arch Linux security](https://security.archlinux.org/) | operating-systems | security-advisories | article | [RSS/Atom](https://security.archlinux.org/advisory/feed.atom) |  |
| [FreeBSD security](https://www.freebsd.org/security/) | operating-systems | security-advisories | article | [RSS/Atom](https://www.freebsd.org/security/feed.xml) |  |
| [Alpine Linux](https://alpinelinux.org/) | operating-systems | mixed-announcements | article | [RSS/Atom](https://alpinelinux.org/atom.xml) |  |
| [Fedora security updates](https://bodhi.fedoraproject.org/) | operating-systems | security-advisories | article | [RSS/Atom](https://bodhi.fedoraproject.org/rss/updates/?type=security&status=stable) |  |
| [CERT-EU](https://cert.europa.eu/) | coordination | security-advisories | article | [RSS/Atom](https://cert.europa.eu/publications/security-advisories-rss) |  |
| [CERT-FR advisories](https://www.cert.ssi.gouv.fr/) | coordination | security-advisories | article | [RSS/Atom](https://cert.cyber.gouv.fr/avis/feed/) |  |
| [CERT-FR alerts](https://www.cert.ssi.gouv.fr/) | coordination | security-advisories | article | [RSS/Atom](https://cert.cyber.gouv.fr/alerte/feed/) |  |
| [CERT/CC vulnerability notes](https://kb.cert.org/) | coordination | security-advisories | article | [RSS/Atom](https://kb.cert.org/vulfeed) |  |
| [JVN English](https://jvn.jp/en/) | coordination | security-advisories | article | [RSS/Atom](https://jvn.jp/en/rss/jvn.rdf) |  |
| [Python blog](https://blog.python.org/) | languages-runtimes | mixed-announcements | article | [RSS/Atom](https://blog.python.org/feeds/posts/default) |  |
| [Go blog](https://go.dev/) | languages-runtimes | mixed-announcements | article | [RSS/Atom](https://go.dev/blog/feed.atom) |  |
| [Rust blog](https://www.rust-lang.org/) | languages-runtimes | mixed-announcements | article | [RSS/Atom](https://blog.rust-lang.org/feed.xml) |  |
| [Django weblog](https://www.djangoproject.com/) | python-web | mixed-announcements | article | [RSS/Atom](https://www.djangoproject.com/rss/weblog/) |  |
| [PostgreSQL news](https://www.postgresql.org/) | data-platforms | mixed-announcements | article | [RSS/Atom](https://www.postgresql.org/news.rss) |  |
| [Apache Solr security](https://solr.apache.org/security-news.html) | data-platforms | security-advisories | feed-content | [RSS/Atom](https://solr.apache.org/feeds/solr/security.atom.xml) |  |
| [Apache Camel blog](https://camel.apache.org/) | jvm-web | mixed-announcements | article | [RSS/Atom](https://camel.apache.org/blog/index.xml) |  |
| [Jenkins security advisories](https://www.jenkins.io/security/advisories/) | devops-observability | security-advisories | article | [RSS/Atom](https://www.jenkins.io/security/advisories/rss.xml) |  |
| [GitLab releases](https://about.gitlab.com/releases/) | devops-observability | mixed-announcements | article | [RSS/Atom](https://docs.gitlab.com/releases/releases.xml) |  |
| [GitLab patch releases](https://about.gitlab.com/releases/categories/releases/) | devops-observability | mixed-announcements | article | [RSS/Atom](https://docs.gitlab.com/releases/patch-releases.xml) |  |
| [Fortinet PSIRT](https://www.fortiguard.com/psirt) | network-vendors | security-advisories | article | [RSS/Atom](https://filestore.fortinet.com/fortiguard/rss/ir.xml) |  |
| [Palo Alto Networks advisories](https://security.paloaltonetworks.com/) | network-vendors | security-advisories | article | [RSS/Atom](https://security.paloaltonetworks.com/rss.xml) |  |
| [Microsoft security updates](https://msrc.microsoft.com/update-guide/) | network-vendors | security-advisories | feed-content | [RSS/Atom](https://api.msrc.microsoft.com/update-guide/rss) | 10 checked entries were not usable (Feed item lacks substantive release notes) |
| [WebKit blog](https://webkit.org/) | browsers | mixed-announcements | article | [RSS/Atom](https://webkit.org/feed/) |  |
| [Cloudflare blog](https://blog.cloudflare.com/) | cloud-providers | mixed-announcements | article | [RSS/Atom](https://blog.cloudflare.com/rss/) |  |
| [Docker blog](https://www.docker.com/) | cloud-native | mixed-announcements | article | [RSS/Atom](https://www.docker.com/blog/feed/) |  |
| [Kubernetes blog](https://kubernetes.io/) | cloud-native | mixed-announcements | article | [RSS/Atom](https://kubernetes.io/feed.xml) |  |
| [HashiCorp discuss security](https://discuss.hashicorp.com/c/security/52) | identity-secrets | security-advisories | article | [RSS/Atom](https://discuss.hashicorp.com/c/security/52.rss) |  |
| [Drupal security](https://www.drupal.org/security) | applications-ai | security-advisories | article | [RSS/Atom](https://www.drupal.org/security/rss.xml) |  |
| [WordPress security](https://wordpress.org/news/category/security/) | applications-ai | security-advisories | article | [RSS/Atom](https://wordpress.org/news/category/security/feed/) |  |
| [TYPO3 news](https://typo3.org/help/security-advisories) | applications-ai | mixed-announcements | article | [RSS/Atom](https://news.typo3.com/rss) |  |
| [Joomla security](https://developer.joomla.org/security-centre.html) | applications-ai | security-advisories | article | [RSS/Atom](https://developer.joomla.org/security-centre.feed?type=rss) |  |
| [Elastic security announcements](https://discuss.elastic.co/c/announcements/security-announcements/31) | data-platforms | security-advisories | article | [RSS/Atom](https://discuss.elastic.co/c/announcements/security-announcements/31.rss) |  |
| [OpenSSL news](https://openssl-library.org/) | native-parsers-crypto | mixed-announcements | article | [RSS/Atom](https://openssl-library.org/news/index.xml) |  |
| [Tor blog](https://blog.torproject.org/) | network-vendors | mixed-announcements | article | [RSS/Atom](https://blog.torproject.org/feed.xml) | 1 checked entries were not usable (Source HTTP 503) |
| [PHP announcements](https://www.php.net/) | languages-runtimes | mixed-announcements | article | [RSS/Atom](https://www.php.net/feed.atom) |  |
| [Swift blog](https://www.swift.org/) | languages-runtimes | mixed-announcements | article | [RSS/Atom](https://www.swift.org/atom.xml) |  |
| [Rust Inside Rust blog](https://blog.rust-lang.org/inside-rust/) | languages-runtimes | mixed-announcements | article | [RSS/Atom](https://blog.rust-lang.org/inside-rust/feed.xml) |  |
| [Amazon Corretto security](https://github.com/corretto/corretto-21) | languages-runtimes | mixed-announcements | feed-content | [RSS/Atom](https://github.com/corretto/corretto-21/releases.atom) | 2 checked entries were not usable (Feed item lacks substantive release notes) |
| [PowerDNS blog](https://blog.powerdns.com/) | network-vendors | mixed-announcements | article | [RSS/Atom](https://blog.powerdns.com/rss.xml) |  |
| [Unbound releases](https://github.com/NLnetLabs/unbound) | network-vendors | mixed-announcements | feed-content | [RSS/Atom](https://github.com/NLnetLabs/unbound/releases.atom) | 2 checked entries were not usable (Feed item lacks substantive release notes) |
| [Exim releases](https://github.com/Exim/exim) | network-vendors | mixed-announcements | feed-content | [RSS/Atom](https://github.com/Exim/exim/releases.atom) | 7 checked entries were not usable (Feed item lacks substantive release notes) |
| [Dovecot releases](https://github.com/dovecot/core) | network-vendors | mixed-announcements | feed-content | [RSS/Atom](https://github.com/dovecot/core/releases.atom) |  |
| [Jupyter Server releases](https://github.com/jupyter-server/jupyter_server) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/jupyter-server/jupyter_server/releases.atom) |  |
| [JupyterLab releases](https://github.com/jupyterlab/jupyterlab) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/jupyterlab/jupyterlab/releases.atom) |  |
| [Apache Zeppelin releases](https://github.com/apache/zeppelin) | applications-ai | release-notes | feed-content | [RSS/Atom](https://github.com/apache/zeppelin/releases.atom) | 9 checked entries were not usable (Feed item lacks substantive release notes) |
| [Apache NiFi releases](https://github.com/apache/nifi) | data-platforms | release-notes | feed-content | [RSS/Atom](https://github.com/apache/nifi/releases.atom) | 7 checked entries were not usable (Feed item lacks substantive release notes) |
| [Apache Druid releases](https://github.com/apache/druid) | data-platforms | release-notes | feed-content | [RSS/Atom](https://github.com/apache/druid/releases.atom) | 6 checked entries were not usable (Feed item lacks substantive release notes) |
| [Apache APISIX Dashboard releases](https://github.com/apache/apisix-dashboard) | cloud-native | release-notes | feed-content | [RSS/Atom](https://github.com/apache/apisix-dashboard/releases.atom) | Latest dated entry is older than one year; monitor for source stagnation |
| [OpenVPN releases](https://github.com/OpenVPN/openvpn) | network-vendors | release-notes | feed-content | [RSS/Atom](https://github.com/OpenVPN/openvpn/releases.atom) |  |
| [Headscale releases](https://github.com/juanfont/headscale) | network-vendors | release-notes | feed-content | [RSS/Atom](https://github.com/juanfont/headscale/releases.atom) | 1 checked entries were not usable (Feed item lacks substantive release notes) |
| [Nebula releases](https://github.com/slackhq/nebula) | network-vendors | release-notes | feed-content | [RSS/Atom](https://github.com/slackhq/nebula/releases.atom) |  |
| [archives (Go)](https://github.com/mholt/archives) | go-rust-libraries | release-notes | feed-content | [RSS/Atom](https://github.com/mholt/archives/releases.atom) | Latest dated entry is older than one year; monitor for source stagnation |

## Excluded candidates

| Source | Candidate endpoint | Reason |
| --- | --- | --- |
| Swift | [Endpoint](https://github.com/swiftlang/swift/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Kotlin | [Endpoint](https://github.com/JetBrains/kotlin/releases.atom) | No usable document: Feed item lacks substantive release notes |
| pip | [Endpoint](https://github.com/pypa/pip/releases.atom) | No usable document: Feed item lacks substantive release notes |
| hapi | [Endpoint](https://github.com/hapijs/hapi/releases.atom) | No usable document: Feed item lacks substantive release notes |
| qs | [Endpoint](https://github.com/ljharb/qs/releases.atom) | No usable document: Feed item lacks substantive release notes |
| node-tar | [Endpoint](https://github.com/isaacs/node-tar/releases.atom) | No usable document: Feed item lacks substantive release notes |
| glob | [Endpoint](https://github.com/isaacs/node-glob/releases.atom) | No usable document: Feed item lacks substantive release notes |
| minimatch | [Endpoint](https://github.com/isaacs/minimatch/releases.atom) | No usable document: Feed item lacks substantive release notes |
| lru-cache | [Endpoint](https://github.com/isaacs/node-lru-cache/releases.atom) | No usable document: Feed item lacks substantive release notes |
| rimraf | [Endpoint](https://github.com/isaacs/rimraf/releases.atom) | No usable document: Feed item lacks substantive release notes |
| sanitize-html | [Endpoint](https://github.com/apostrophecms/sanitize-html/releases.atom) | No usable document: Feed item lacks substantive release notes |
| js-xss | [Endpoint](https://github.com/leizongmin/js-xss/releases.atom) | No usable document: Feed item lacks substantive release notes |
| markdown-it | [Endpoint](https://github.com/markdown-it/markdown-it/releases.atom) | No usable document: Feed item lacks substantive release notes |
| EJS | [Endpoint](https://github.com/mde/ejs/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Joi | [Endpoint](https://github.com/hapijs/joi/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Auth.js | [Endpoint](https://github.com/authjs/authjs/releases.atom) | Source HTTP 404 |
| cryptography | [Endpoint](https://github.com/pyca/cryptography/releases.atom) | No usable document: Feed item lacks substantive release notes |
| pyOpenSSL | [Endpoint](https://github.com/pyca/pyopenssl/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Paramiko | [Endpoint](https://github.com/paramiko/paramiko/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Fabric | [Endpoint](https://github.com/fabric/fabric/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Marshmallow | [Endpoint](https://github.com/marshmallow-code/marshmallow/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Rack | [Endpoint](https://github.com/rack/rack/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Sinatra | [Endpoint](https://github.com/sinatra/sinatra/releases.atom) | No usable document: Feed item lacks substantive release notes |
| ruby-jwt | [Endpoint](https://github.com/ruby-jwt/ruby-jwt/releases.atom) | Source HTTP 404 |
| Sidekiq alternate location | [Endpoint](https://github.com/sidekiq/sidekiq/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Jetty | [Endpoint](https://github.com/eclipse-jetty/jetty.project/releases.atom) | Source HTTP 404 |
| Apache Tomcat | [Endpoint](https://github.com/apache/tomcat/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Jackson Databind | [Endpoint](https://github.com/FasterXML/jackson-databind/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Jackson Core | [Endpoint](https://github.com/FasterXML/jackson-core/releases.atom) | No usable document: Feed item lacks substantive release notes |
| SnakeYAML | [Endpoint](https://github.com/yaml/snakeyaml/releases.atom) | Source HTTP 404 |
| OkHttp | [Endpoint](https://github.com/lysine-dev/okhttp/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Apache CXF | [Endpoint](https://github.com/apache/cxf/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Apache Camel | [Endpoint](https://github.com/apache/camel/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Apache Commons Compress | [Endpoint](https://github.com/apache/commons-compress/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Apache Commons IO | [Endpoint](https://github.com/apache/commons-io/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Apache Commons Text | [Endpoint](https://github.com/apache/commons-text/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Apache Commons FileUpload | [Endpoint](https://github.com/apache/commons-fileupload/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Apache Commons BeanUtils | [Endpoint](https://github.com/apache/commons-beanutils/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Apache POI | [Endpoint](https://github.com/apache/poi/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Apache PDFBox | [Endpoint](https://github.com/apache/pdfbox/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Apache Tika | [Endpoint](https://github.com/apache/tika/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Apache Groovy | [Endpoint](https://github.com/apache/groovy/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Bouncy Castle Java | [Endpoint](https://github.com/bouncycastle/bc-java/releases.atom) | Source HTTP 404 |
| GORM | [Endpoint](https://github.com/gorm/gorm/releases.atom) | Source HTTP 404 |
| archiver | [Endpoint](https://github.com/mholt/archiver/releases.atom) | Repository is archived and explicitly deprecated in favor of mholt/archives; not counted as a maintained patch-announcement stream. |
| gogo/protobuf | [Endpoint](https://github.com/gogo/protobuf/releases.atom) | Upstream explicitly marks this library deprecated, and its latest release is from 2021; not counted as a maintained patch-announcement stream. |
| ring | [Endpoint](https://github.com/briansmith/ring/releases.atom) | Empty feed |
| time crate | [Endpoint](https://github.com/time-rs/time/releases.atom) | No usable document: Feed item lacks substantive release notes |
| nix crate | [Endpoint](https://github.com/nix-rust/nix/releases.atom) | No usable document: Feed item lacks substantive release notes |
| curl | [Endpoint](https://github.com/curl/curl/releases.atom) | No usable document: Feed item lacks substantive release notes |
| libxml2 | [Endpoint](https://github.com/GNOME/libxml2/releases.atom) | No usable document: Feed item lacks substantive release notes |
| libpng | [Endpoint](https://github.com/pnggroup/libpng/releases.atom) | No usable document: Feed item lacks substantive release notes |
| ImageMagick | [Endpoint](https://github.com/ImageMagick/ImageMagick/releases.atom) | No usable document: Feed item lacks substantive release notes |
| FFmpeg | [Endpoint](https://github.com/FFmpeg/FFmpeg/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Memcached | [Endpoint](https://github.com/memcached/memcached/releases.atom) | No usable document: Feed item lacks substantive release notes |
| ClickHouse | [Endpoint](https://github.com/ClickHouse/ClickHouse/releases.atom) | No usable document: Feed item lacks substantive release notes |
| TiDB | [Endpoint](https://github.com/pingcap/tidb/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Apache Solr | [Endpoint](https://github.com/apache/solr/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Apache Cassandra | [Endpoint](https://github.com/apache/cassandra/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Apache CouchDB | [Endpoint](https://github.com/apache/couchdb/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Apache Kafka | [Endpoint](https://github.com/apache/kafka/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Apache Flink | [Endpoint](https://github.com/apache/flink/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Apache Spark | [Endpoint](https://github.com/apache/spark/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Apache Airflow | [Endpoint](https://github.com/apache/airflow/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Trino | [Endpoint](https://github.com/trinodb/trino/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Apache ActiveMQ Artemis | [Endpoint](https://github.com/apache/artemis/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Istio | [Endpoint](https://github.com/istio/istio/releases.atom) | No usable document: Feed item lacks substantive release notes |
| HAProxy | [Endpoint](https://github.com/haproxy/haproxy/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Teleport | [Endpoint](https://github.com/gravitational/teleport/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Datadog Agent | [Endpoint](https://github.com/DataDog/datadog-agent/releases.atom) | Source HTTP 502 |
| Salt | [Endpoint](https://github.com/saltstack/salt/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Nextcloud | [Endpoint](https://github.com/nextcloud/server/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Zulip | [Endpoint](https://github.com/zulip/zulip/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Discourse | [Endpoint](https://github.com/discourse/discourse/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Synapse | [Endpoint](https://github.com/element-hq/synapse/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Moodle | [Endpoint](https://github.com/moodle/moodle/releases.atom) | No usable document: Feed item lacks substantive release notes |
| phpMyAdmin | [Endpoint](https://github.com/phpmyadmin/phpmyadmin/releases.atom) | No usable document: Feed item lacks substantive release notes |
| NetBSD | [Endpoint](https://www.netbsd.org/changes/rss-netbsd.xml) | Feed links target shared changes-page fragments; no reviewed section-extraction adapter. Excluded rather than treating the whole news page as a distinct advisory. |
| SUSE security | [Endpoint](https://www.suse.com/support/update/security/rss/) | URL outside source allowlist |
| Rocky Linux errata | [Endpoint](https://errata.rockylinux.org/rss.xml) | Endpoint returned HTML instead of RSS/Atom (unavailable, changed or challenged) |
| CISA advisories | [Endpoint](https://www.cisa.gov/cybersecurity-advisories/all.xml) | Source HTTP 403 |
| NCSC Netherlands | [Endpoint](https://advisories.ncsc.nl/rss.xml) | Source HTTP 404 |
| GitHub global advisories | [Endpoint](https://github.com/security-advisories.atom) | The operation was aborted due to timeout |
| PHP releases | [Endpoint](https://www.php.net/releases/feed.php) | No usable document: Source exceeds configured byte limit |
| Apache announcements | [Endpoint](https://news.apache.org/announce?format=atom) | Source HTTP 404 |
| Atlassian advisories | [Endpoint](https://confluence.atlassian.com/security/atlassian-security-advisories-rss-feed-1236937321.html) | Source HTTP 404 |
| Cisco advisories | [Endpoint](https://sec.cloudapps.cisco.com/security/center/psirtrss20/CiscoSecurityAdvisory.xml) | Endpoint returned HTML instead of RSS/Atom (unavailable, changed or challenged) |
| Juniper SIRT | [Endpoint](https://supportportal.juniper.net/s/knowledge/rss?language=en_US) | Source HTTP 404 |
| SonicWall PSIRT | [Endpoint](https://psirt.global.sonicwall.com/api/v1/vuln/rss) | Endpoint returned HTML instead of RSS/Atom (unavailable, changed or challenged) |
| F5 security | [Endpoint](https://my.f5.com/manage/s/feed/rss?category=Security%20Advisory) | Source HTTP 404 |
| VMware security | [Endpoint](https://www.vmware.com/security/advisories.xml) | Source HTTP 404 |
| Citrix security | [Endpoint](https://support.citrix.com/support-home/rss) | Endpoint returned HTML instead of RSS/Atom (unavailable, changed or challenged) |
| Microsoft MSRC blog | [Endpoint](https://www.microsoft.com/en-us/msrc/blog/feed) | Source HTTP 404 |
| Mozilla advisories | [Endpoint](https://www.mozilla.org/en-US/security/advisories/feed/) | Source HTTP 404 |
| Chrome releases | [Endpoint](https://chromereleases.googleblog.com/feeds/posts/default?alt=rss) | URL outside source allowlist |
| Android security bulletins | [Endpoint](https://source.android.com/docs/security/bulletin/feed.xml) | Source HTTP 404 |
| Apple security releases | [Endpoint](https://support.apple.com/en-us/100100/rss) | Endpoint returned HTML instead of RSS/Atom (unavailable, changed or challenged) |
| AWS security bulletins | [Endpoint](https://aws.amazon.com/security/security-bulletins/rss/) | Endpoint returned HTML instead of RSS/Atom (unavailable, changed or challenged) |
| Google Cloud security bulletins | [Endpoint](https://cloud.google.com/feeds/gcp-security-bulletins.xml) | Endpoint returned HTML instead of RSS/Atom (unavailable, changed or challenged) |
| Azure security updates | [Endpoint](https://azurecomcdn.azureedge.net/en-us/updates/feed/?category=security) | The operation was aborted due to timeout |
| Zabbix releases | [Endpoint](https://www.zabbix.com/rn/rss) | Endpoint returned HTML instead of RSS/Atom (unavailable, changed or challenged) |
| OpenSSH releases | [Endpoint](https://www.openssh.com/releasenotes.xml) | URL outside source allowlist |
| Wireshark news | [Endpoint](https://www.wireshark.org/news/rss.xml) | Source HTTP 404 |
| Amazon Linux 2023 advisories | [Endpoint](https://alas.aws.amazon.com/AL2023/alas.rss) | Endpoint returned HTML instead of RSS/Atom (unavailable, changed or challenged) |
| Microsoft Security Response Center news | [Endpoint](https://www.microsoft.com/en-us/msrc/blog/feed/) | Source HTTP 404 |
| NVIDIA security bulletins | [Endpoint](https://www.nvidia.com/en-us/security/psirt-policies/rss/) | Source HTTP 404 |
| Dell security advisories | [Endpoint](https://www.dell.com/support/security/en-us/rss) | Source HTTP 404 |
| OpenSSL security advisories | [Endpoint](https://openssl-library.org/news/secadv/index.xml) | Source HTTP 404 |
| Kotlin blog | [Endpoint](https://blog.jetbrains.com/kotlin/feed/) | Source HTTP 403 |
| OpenJDK vulnerability advisories | [Endpoint](https://openjdk.org/groups/vulnerability/advisories/rss.xml) | Source HTTP 403 |
| Eclipse Temurin JDK | [Endpoint](https://github.com/adoptium/temurin21-binaries/releases.atom) | No usable document: Feed item lacks substantive release notes |
| BIND 9 releases | [Endpoint](https://gitlab.isc.org/isc-projects/bind9/-/tags?format=atom) | No usable document: Feed item lacks substantive release notes |
| Knot DNS releases | [Endpoint](https://github.com/CZ-NIC/knot/releases.atom) | No usable document: Feed item lacks substantive release notes |
| Traefik announcements | [Endpoint](https://community.traefik.io/c/announcements/5.rss) | The operation was aborted due to timeout |
| Mattermost security | [Endpoint](https://mattermost.com/blog/category/security/feed/) | Source HTTP 404 |
| Nextcloud news | [Endpoint](https://nextcloud.com/blog/feed/) | Empty feed |
| Tailscale releases | [Endpoint](https://github.com/tailscale/tailscale/releases.atom) | No usable document: Feed item lacks substantive release notes |

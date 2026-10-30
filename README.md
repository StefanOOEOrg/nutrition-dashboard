# nutrition-dashboard

Read-only dashboard for today's nutrition: how much of the calorie budget is used, how the macros
stand against their goals, and what was eaten when.

The data comes from the [mcp-nutrition](https://github.com/StefanOOEOrg/mcp-nutrition) diary
(Postgres, schema `nutrition`); the values of the foods come from
[mcp-food](https://github.com/StefanOOEOrg/mcp-food). The dashboard only reads - logging stays in
the chat via the MCP tools.

![Nutrition dashboard: calorie ring at 81 % of the budget, macro bars for protein, carbs and fat,
water, the day timeline and the log on a vertical time axis](docs/screenshot.png)

## Data sources

Both servers share one Postgres database; the dashboard only reads from it.

| Repository | What it contributes |
|---|---|
| [mcp-nutrition](https://github.com/StefanOOEOrg/mcp-nutrition) | the diary: meals, water and the daily goals (schema `nutrition`) - it also ships the container `nutrition-db` on `127.0.0.1:5433` |
| [mcp-food](https://github.com/StefanOOEOrg/mcp-food) | the nutrition values of foods and recipes (schema `food`) that end up in a logged meal |

## What it shows

- **Calorie budget** as a ring: consumed / goal, percent, what is left.
- **Macro budget**: protein, carbs and fat with grams, goal, percent and an over state.
- **Water**: millilitres against the goal.
- **Left today**: kcal, protein, carbs, fat and water still available (negative = over).
- **Day timeline**: one dot per logged entry on a 00:00-24:00 band, water in blue, plus a "now"
  marker.
- **Log**: one row per logged minute on a vertical time axis - the foods, kcal as number and as
  percent of the budget, and P/C/F as percent of their goals. Same times as the ribbon, so no
  numbering is needed.
- A goal that was never set in the diary shows as "no goal" instead of a fake percentage.

## Requirements

- [uv](https://docs.astral.sh/uv/) (brings its own Python)
- Node.js >= 22 + npm
- **Postgres 17** with the `nutrition` schema - the container of the mcp-nutrition repository
  (`db/`, `127.0.0.1:5433`). Without it the page still loads, but `/api/today` answers with an
  error message.

## Quick start

```bash
cp .env.example .env          # set NUTRITION_DASHBOARD_DATABASE_URL
cd web && npm ci && npm run build && cd ..
uv run nutrition-dashboard
```

Open <http://127.0.0.1:8090>. The start line prints the time zone, the schema and the env file in
use.

The server binds `127.0.0.1` on purpose: reach the page from another machine through an SSH
tunnel, not by opening the port.

```bash
ssh -N -L 8090:127.0.0.1:8090 <host>
```

## Configuration (environment variables)

Variables can be set in the shell or in a `.env` file in the repo root (gitignored). The file is
read once at startup, before the defaults below apply. Precedence: process environment > `.env` >
default. `DASHBOARD_ENV_FILE=/path/to/file` points the app at another file.

| Variable | Default |
|---|---|
| `NUTRITION_DASHBOARD_DATABASE_URL` | `''` (no connection) |
| `DASHBOARD_SCHEMA` | `nutrition` |
| `DASHBOARD_TZ` | `Europe/Vienna` |
| `DASHBOARD_HOST` | `127.0.0.1` |
| `DASHBOARD_PORT` | `8090` |
| `DASHBOARD_WEB_DIST_DIR` | `web/dist/web/browser` |
| `DASHBOARD_ENV_FILE` | `./.env` |

## Development

```bash
uv sync
uv run ruff check server && uv run ruff format --check server
uv run pytest                      # needs TEST_DATABASE_URL, see below

cd web
node node_modules/@angular/cli/bin/ng.js test --watch=false
node node_modules/eslint/bin/eslint.js src
node node_modules/prettier/bin/prettier.cjs --check "src/**/*.{ts,html,css}"
node node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit
node node_modules/typescript/bin/tsc -p tsconfig.spec.json --noEmit
```

The server tests run against a real Postgres. `TEST_DATABASE_URL` points at a database where the
role may create schemas - every test gets its own throwaway schema and drops it again, so the real
`nutrition` schema is never touched. Without the variable the database tests skip; set
`TEST_REQUIRE_DB=1` to make that a failure (CI does).

```bash
TEST_DATABASE_URL=postgresql://nutrition:***@127.0.0.1:5433/nutrition uv run pytest
```

Live reload of the UI: start the server, then `ng serve` in `web/` - `proxy.conf.json` forwards
`/api` to `127.0.0.1:8090`.

## Layout

```
server/nutrition_dashboard/
  app.py        FastAPI app: /api/today, static files, entry point
  db.py         read-only queries: meals, water, goals of one day
  day.py        day boundaries in the time zone + the aggregation of the response
  models.py     row types the database layer hands over
  config.py     DASHBOARD_* / NUTRITION_DASHBOARD_* from environment and .env
web/src/app/
  app.*         shell: header, error bar, the two columns
  budget-panel/ calorie ring, macro bars, water, "Left today"
  day-log/      day ribbon and the log on the time axis
  format.ts     pure formatting helpers (percentages, bar widths, labels)
  api.service.ts  GET /api/today
docs/ui-mockup.html   approved visual specification (static, real data)
docs/screenshot.png   the dashboard as a PNG, for this README
```

## Scope and limitations

- Single user, local tool: binds `127.0.0.1`, no authentication, no multi-user support.
- Read-only, today only - no date navigation, no editing, no recipes, no photos.
- Fibre and sugar are not shown: their goals exist, but the logged meals almost never carry the
  values (3 of 33 rows had `fiber_g`, 8 of 33 `sugar_g`), so the bars would always be empty.
- The schema belongs to mcp-nutrition; changes there can break this app. The one-way dependency is
  deliberate - there is no migration layer.

## License

MIT - see [LICENSE](LICENSE). Copyright (c) 2026 StefanOOEOrg.

"""FastAPI app: ``/api`` for the numbers, the built Angular app for everything else.

The wiring below (route, error mapping, static files, ``main``) is complete. The route body is a
thin call into the injected ``loader``; the actual work lives in ``db.py`` (rows) and ``day.py``
(the response shape).
"""

import logging
from collections.abc import Callable
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from . import config, day, db

logger = logging.getLogger(__name__)

Loader = Callable[[], dict[str, Any]]


def create_app(loader: Loader, web_dist: Path | None = None) -> FastAPI:
    """Build the app.

    ``loader`` returns the response of ``GET /api/today`` (tests inject a fake);
    ``web_dist=None`` means no static files are served.
    """
    app = FastAPI(title="Nutrition Dashboard")

    @app.get("/api/today")
    def today() -> dict[str, Any]:
        """Return ``loader()``; any failure becomes a readable 500 instead of a stack trace."""
        try:
            return loader()
        except Exception as exc:  # noqa: BLE001 - the browser needs one readable message
            logger.exception("loading the day failed")
            raise HTTPException(status_code=500, detail=f"Could not read the diary: {exc}") from exc

    if web_dist is not None and web_dist.is_dir():
        app.mount("/", StaticFiles(directory=web_dist, html=True), name="web")
    else:

        @app.get("/", response_class=HTMLResponse)
        def index() -> HTMLResponse:
            """Landing page for a fresh clone: names the missing build step."""
            return HTMLResponse(
                "<h1>Nutrition Dashboard</h1>"
                "<p>The web app is not built yet.</p>"
                "<p>Run <code>npm ci &amp;&amp; npm run build</code> in <code>web/</code>, "
                "then reload this page.</p>"
            )

    return app


def load_today() -> dict[str, Any]:
    """Load the current day in the configured time zone and build the response."""
    today = datetime.now(ZoneInfo(config.TIMEZONE)).date()
    raw = db.load_day(today, url=config.DATABASE_URL, tz=config.TIMEZONE, schema=config.SCHEMA)
    return day.build_day(today, raw, config.TIMEZONE)


def build_default_app() -> FastAPI:
    """App with the real database from ``config``."""
    return create_app(load_today, web_dist=config.WEB_DIST_DIR)


def main() -> None:
    """Entry point: ``uv run nutrition-dashboard``."""
    env_file = config.ENV_FILE if config.ENV_FILE.exists() else "none"
    if not config.WEB_DIST_DIR.is_dir():
        print("Web app not built: run 'npm ci && npm run build' in web/ (the UI will not load)")
    print(
        f"Nutrition Dashboard: http://{config.HOST}:{config.PORT}  "
        f"(TZ: {config.TIMEZONE}, Schema: {config.SCHEMA}, Env: {env_file})"
    )
    uvicorn.run(build_default_app(), host=config.HOST, port=config.PORT)


if __name__ == "__main__":
    main()

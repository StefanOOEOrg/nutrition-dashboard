"""Configuration from environment variables (fully implemented, no stub)."""

import os
from pathlib import Path

from .env_file import load_env_file

REPO_ROOT = Path(__file__).resolve().parents[2]

# The `.env` is read before any constant below is computed, because all of them are built at import
# time. The process environment wins over the file.
ENV_FILE = Path(os.environ.get("DASHBOARD_ENV_FILE", REPO_ROOT / ".env"))
load_env_file(ENV_FILE)

#: libpq URL of the database with the mcp-nutrition schema. Read-only use.
DATABASE_URL = os.environ.get("NUTRITION_DASHBOARD_DATABASE_URL", "")

#: Schema that holds ``meals``, ``water`` and ``goals``.
SCHEMA = os.environ.get("DASHBOARD_SCHEMA", "nutrition")

#: Time zone for "today" and for the times shown in the log.
TIMEZONE = os.environ.get("DASHBOARD_TZ", "Europe/Vienna")

#: Built Angular app (``npm run build`` in web/).
WEB_DIST_DIR = Path(
    os.environ.get("DASHBOARD_WEB_DIST_DIR", REPO_ROOT / "web" / "dist" / "web" / "browser")
).resolve()

HOST = os.environ.get("DASHBOARD_HOST", "127.0.0.1")
PORT = int(os.environ.get("DASHBOARD_PORT", "8090"))

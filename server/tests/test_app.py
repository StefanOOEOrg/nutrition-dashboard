"""Specs for the app wiring: the API route, the error response and the landing page."""

from collections.abc import Callable
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from nutrition_dashboard.app import create_app

PAYLOAD: dict[str, Any] = {
    "date": "2026-10-30",
    "timezone": "Europe/Vienna",
    "goals": {
        "kcal": 2000.0,
        "protein_g": 130.0,
        "carbs_g": 210.0,
        "fat_g": 70.0,
        "water_ml": 3000,
    },
    "totals": {
        "kcal": 0.0,
        "protein_g": 0.0,
        "carbs_g": 0.0,
        "fat_g": 0.0,
        "water_ml": 0,
    },
    "entries": [],
}


def client(loader: Callable[[], dict[str, Any]], web_dist: Path | None = None) -> TestClient:
    """TestClient around the app with an injected loader."""
    return TestClient(create_app(loader, web_dist=web_dist))


def test_api_today_returns_what_the_loader_built() -> None:
    response = client(lambda: PAYLOAD).get("/api/today")

    assert response.status_code == 200
    assert response.json() == PAYLOAD


def test_api_today_turns_a_failure_into_a_readable_500() -> None:
    def failing() -> dict[str, Any]:
        raise RuntimeError("connection refused")

    response = client(failing).get("/api/today")

    assert response.status_code == 500
    assert response.json() == {"detail": "Could not read the diary: connection refused"}


def test_root_explains_the_missing_build(tmp_path: Path) -> None:
    response = client(lambda: PAYLOAD, web_dist=tmp_path / "not-built").get("/")

    assert response.status_code == 200
    assert "npm ci" in response.text


def test_root_serves_the_built_app(tmp_path: Path) -> None:
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<h1>Nutrition Dashboard</h1>", encoding="utf-8")

    response = client(lambda: PAYLOAD, web_dist=dist).get("/")

    assert response.status_code == 200
    assert "Nutrition Dashboard" in response.text

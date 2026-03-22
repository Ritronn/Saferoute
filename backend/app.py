"""
SafeRoute — Flask Backend
Endpoints:
  GET  /api/geocode?q=...         → Location autocomplete (Google Places API)
  POST /api/route                 → Find & rank routes by safety (Google Places + Overpass)
  POST /api/safety-briefing       → AI safety briefing via Gemini
  GET  /api/crime-news?area=...   → Crime news scraper
  GET  /api/crime-hotspots        → Crime hotspot data for heatmap
"""

import os
import time
import math
from collections import defaultdict
from functools import lru_cache
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests as http_req
from safety_scorer import fetch_safety_features, score_route, score_segments, split_into_segments
from crime_hotspots import get_all_hotspots

load_dotenv()

app = Flask(__name__)
CORS(app)

# ─── API Keys ───────────────────────────────────────────────────────────
GOOGLE_PLACES_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "")
PLACES_URL = "https://places.googleapis.com/v1/places:searchText"

OSRM = "http://router.project-osrm.org"

# ─── Rate Limiter (per-IP, resets daily) ────────────────────────────────
DAILY_LIMIT = 100            # max geocode requests per IP per day
_rate_data = defaultdict(lambda: {"count": 0, "reset": 0})


def _check_rate_limit(ip):
    """Returns True if request is allowed, False if rate-limited."""
    now = time.time()
    entry = _rate_data[ip]
    # Reset counter every 24h
    if now > entry["reset"]:
        entry["count"] = 0
        entry["reset"] = now + 86400
    if entry["count"] >= DAILY_LIMIT:
        return False
    entry["count"] += 1
    return True


# ─── Query Cache (TTL = 5 min) ──────────────────────────────────────────
_query_cache = {}
CACHE_TTL = 300  # seconds


def _get_cached(query):
    """Return cached result or None."""
    key = query.lower().strip()
    if key in _query_cache:
        result, ts = _query_cache[key]
        if time.time() - ts < CACHE_TTL:
            return result
        del _query_cache[key]
    return None


def _set_cache(query, result):
    key = query.lower().strip()
    _query_cache[key] = (result, time.time())
    # Prune old entries when cache gets large
    if len(_query_cache) > 500:
        cutoff = time.time() - CACHE_TTL
        to_del = [k for k, (_, ts) in _query_cache.items() if ts < cutoff]
        for k in to_del:
            del _query_cache[k]


# ─── Type Icons ──────────────────────────────────────────────────────────
TYPE_ICONS = {
    "restaurant": "🍽️", "cafe": "☕", "hotel": "🏨", "lodging": "🏨",
    "hospital": "🏥", "school": "🏫", "university": "🎓",
    "park": "🌳", "stadium": "🏟️", "shopping_mall": "🛍️",
    "store": "🛒", "supermarket": "🛒",
    "place_of_worship": "🛕", "church": "⛪", "mosque": "🕌",
    "museum": "🏛️", "movie_theater": "🎬", "bank": "🏦",
    "police": "🚔", "fire_station": "🚒", "post_office": "📮",
    "airport": "✈️", "train_station": "🚉", "bus_station": "🚌",
    "subway_station": "🚇", "transit_station": "🚉",
    "locality": "🏙️", "sublocality": "🏘️", "neighborhood": "🏘️",
    "route": "🛣️", "street_address": "🏠",
}


def _icon_for_types(types):
    """Pick the best icon from a list of Google Place types."""
    for t in types:
        if t in TYPE_ICONS:
            return TYPE_ICONS[t]
    return "📍"


def _type_label(types):
    """Human-readable label from Google Place types."""
    skip = {"point_of_interest", "establishment", "geocode", "political"}
    for t in types:
        if t not in skip:
            return t.replace("_", " ").title()
    return ""


def _build_google_suggestion(place):
    """Build a structured suggestion from a Google Places result."""
    display = place.get("formattedAddress", "")
    name = place.get("displayName", {}).get("text", display.split(",")[0])

    # Secondary = address minus the primary name
    parts = [p.strip() for p in display.split(",")]
    secondary = ", ".join(parts[1:4]) if len(parts) > 1 else ""

    types = place.get("types", [])
    loc = place.get("location", {})

    return {
        "primary": name,
        "secondary": secondary,
        "type": _type_label(types),
        "icon": _icon_for_types(types),
        "display_name": display,
        "lat": loc.get("latitude", 0),
        "lon": loc.get("longitude", 0),
    }


@app.route("/api/geocode")
def geocode():
    """Location autocomplete via Google Places API with rate limiting."""
    q = request.args.get("q", "").strip()
    if len(q) < 3:
        return jsonify([])

    # Rate limit check
    client_ip = request.remote_addr or "unknown"
    if not _check_rate_limit(client_ip):
        remaining = _rate_data[client_ip]
        print(f"[Rate Limit] IP {client_ip} exceeded {DAILY_LIMIT} requests/day")
        return jsonify({"error": "Rate limit exceeded. Try again tomorrow."}), 429

    # Check cache first
    cached = _get_cached(q)
    if cached is not None:
        print(f"[Cache HIT] '{q}' — saved an API call 💰")
        return jsonify(cached)

    # Call Google Places API
    if not GOOGLE_PLACES_KEY:
        return jsonify({"error": "Google Places API key not configured"}), 500

    try:
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
            "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location,places.types",
        }
        body = {
            "textQuery": q,
            "maxResultCount": 5,
            "languageCode": "en",
        }
        r = http_req.post(PLACES_URL, json=body, headers=headers, timeout=10)
        r.raise_for_status()
    except Exception as e:
        print(f"[Places API Error] {e}")
        return jsonify({"error": f"Places lookup failed: {e}"}), 500

    places = r.json().get("places", [])
    results = [_build_google_suggestion(p) for p in places]

    # Cache the results
    _set_cache(q, results)

    count = _rate_data[client_ip]["count"]
    print(f"[Geocode] '{q}' → {len(results)} results  |  IP {client_ip}: {count}/{DAILY_LIMIT} today")

    return jsonify(results)


# ─── Multi-Route Generation ─────────────────────────────────────────────

def _generate_waypoints(slat, slon, elat, elon, n=2):
    """
    Generate intermediate waypoints perpendicular to the direct route line.
    This forces OSRM to return genuinely different routes through different areas.
    """
    mid_lat = (slat + elat) / 2
    mid_lon = (slon + elon) / 2

    # Vector from start to end
    dlat = elat - slat
    dlon = elon - slon

    # Distance between points (rough km)
    dist = math.sqrt(dlat**2 + dlon**2)

    # Perpendicular offset — proportional to route length (0.003-0.015 degrees)
    offset = max(0.003, min(0.015, dist * 0.3))

    waypoints = []
    # North-ish detour (perpendicular to the route)
    waypoints.append((mid_lat + dlon * offset / dist * 3, mid_lon - dlat * offset / dist * 3))
    # South-ish detour (opposite direction)
    waypoints.append((mid_lat - dlon * offset / dist * 3, mid_lon + dlat * offset / dist * 3))

    return waypoints


def _fetch_osrm_route(slon, slat, elon, elat, waypoints=None):
    """Fetch a route from OSRM, optionally via waypoints."""
    if waypoints:
        coords_str = f"{slon},{slat}"
        for wlat, wlon in waypoints:
            coords_str += f";{wlon},{wlat}"
        coords_str += f";{elon},{elat}"
    else:
        coords_str = f"{slon},{slat};{elon},{elat}"

    try:
        r = http_req.get(
            f"{OSRM}/route/v1/driving/{coords_str}",
            params={"overview": "full", "geometries": "geojson"},
            timeout=15,
        )
        data = r.json()
        if data.get("code") == "Ok" and data.get("routes"):
            return data["routes"][0]
    except Exception as e:
        print(f"[OSRM waypoint route] Error: {e}")
    return None


def _get_diverse_routes(slat, slon, elat, elon):
    """
    Get 2-3 diverse routes. First tries OSRM alternatives, then supplements
    with waypoint-based routes to ensure genuinely different paths.
    """
    routes = []
    seen_coords = set()

    # 1. Try OSRM's built-in alternatives first
    try:
        r = http_req.get(
            f"{OSRM}/route/v1/driving/{slon},{slat};{elon},{elat}",
            params={"alternatives": "3", "overview": "full", "geometries": "geojson", "continue_straight": "false"},
            timeout=15,
        )
        osrm = r.json()
        if osrm.get("code") == "Ok" and osrm.get("routes"):
            for rt in osrm["routes"]:
                # Create a fingerprint from a few sampled coordinates to detect duplicates
                coords = rt["geometry"]["coordinates"]
                mid = len(coords) // 2
                fp = f"{coords[mid][0]:.4f},{coords[mid][1]:.4f}"
                if fp not in seen_coords:
                    seen_coords.add(fp)
                    routes.append(rt)
    except Exception as e:
        print(f"[OSRM alternatives] Error: {e}")

    # 2. If we got less than 2 routes, generate more via waypoints
    if len(routes) < 3:
        waypoints = _generate_waypoints(slat, slon, elat, elon)
        for wp in waypoints:
            if len(routes) >= 3:
                break
            rt = _fetch_osrm_route(slon, slat, elon, elat, waypoints=[(wp[0], wp[1])])
            if rt:
                coords = rt["geometry"]["coordinates"]
                mid = len(coords) // 2
                fp = f"{coords[mid][0]:.4f},{coords[mid][1]:.4f}"
                if fp not in seen_coords:
                    seen_coords.add(fp)
                    routes.append(rt)
                    print(f"[Multi-Route] Added waypoint route via ({wp[0]:.4f}, {wp[1]:.4f})")

    print(f"[Multi-Route] Total routes generated: {len(routes)}")
    return routes


# ─── Route Finding ───────────────────────────────────────────────────────

@app.route("/api/route", methods=["POST"])
def find_route():
    """Find routes and rank by safety score."""
    data = request.get_json()
    slat, slon = data["start_lat"], data["start_lon"]
    elat, elon = data["end_lat"], data["end_lon"]
    time_mode = data.get("time_mode", "day")  # "day" or "night"

    # 1 — Get diverse route alternatives
    routes = _get_diverse_routes(slat, slon, elat, elon)

    if not routes:
        return jsonify({"error": "No routes found"}), 400

    # 2 — Fetch safety features (Google Places preferred, Overpass fallback)
    all_coords = []
    for rt in routes:
        all_coords.extend(rt["geometry"]["coordinates"])

    cats, pois = fetch_safety_features(all_coords, api_key=GOOGLE_PLACES_KEY)

    # 3 — Score each route + compute per-segment colors
    results = []
    for i, rt in enumerate(routes):
        coords = rt["geometry"]["coordinates"]
        safety = score_route(coords, cats, time_mode)

        # Per-segment scoring for color-coded rendering
        n_segments = 5
        segments_data = split_into_segments(coords, n_segments)
        segment_scores = score_segments(coords, cats, n_segments, time_mode)

        # Build segment coordinate ranges for frontend
        seg_coords = []
        for j, seg in enumerate(segments_data):
            leaflet_coords = [[c[1], c[0]] for c in seg]  # [lat, lon] for Leaflet
            seg_coords.append({
                "coordinates": leaflet_coords,
                "color": segment_scores[j]["color"],
                "score": segment_scores[j]["score"],
            })

        results.append({
            "id": i,
            "geometry": rt["geometry"],
            "distance_km": round(rt["distance"] / 1000, 1),
            "duration_min": round(rt["duration"] / 60),
            "safety": safety,
            "segments": seg_coords,
        })

    # 4 — Sort by safety (highest first) & label
    results.sort(key=lambda r: r["safety"]["overall"], reverse=True)
    if results:
        results[0]["label"] = "SAFEST"
    fastest = min(results, key=lambda r: r["duration_min"])
    if fastest["id"] != results[0]["id"]:
        fastest["label"] = "FASTEST"
    for r in results:
        r.setdefault("label", "")

    return jsonify({
        "routes": results,
        "features_found": {k: len(v) for k, v in cats.items()},
        "safety_pois": pois,
        "time_mode": time_mode,
    })


@app.route("/api/safety-briefing", methods=["POST"])
def safety_briefing():
    """Generate AI safety briefing for a route using Gemini."""
    from ai_service import generate_safety_briefing
    data = request.get_json()
    route_data = data.get("route", {})
    features = data.get("features_found", {})
    briefing = generate_safety_briefing(route_data, features)
    if briefing:
        return jsonify({"briefing": briefing})
    return jsonify({"error": "Could not generate briefing"}), 500


@app.route("/api/crime-news")
def crime_news():
    """Get real crime news for an area using web scraper."""
    from crime_scraper import scrape_crime_news
    area = request.args.get("area", "").strip()
    if not area:
        return jsonify({"error": "area name required"}), 400
    articles = scrape_crime_news(area, limit=8)
    return jsonify({"articles": articles, "area": area})


@app.route("/api/crime-hotspots")
def crime_hotspots():
    """Return crime hotspot data for heatmap rendering."""
    hotspots = get_all_hotspots()
    return jsonify({"hotspots": hotspots})


if __name__ == "__main__":
    if not GOOGLE_PLACES_KEY:
        print("⚠️  WARNING: GOOGLE_PLACES_API_KEY not set in .env — geocoding won't work!")
    else:
        print(f"✅ Google Places API key loaded (ends ...{GOOGLE_PLACES_KEY[-4:]})")
    print(f"🛡️  Rate limit: {DAILY_LIMIT} geocode requests/IP/day")
    app.run(debug=True, port=5000)

"""
SafeRoute — Safety Scoring Engine
Uses Google Places Nearby Search API for reliable safety feature data.
Falls back to Overpass API if Google Places key is unavailable.
"""

import os
import math
import requests
from crime_hotspots import get_crime_risk

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
PLACES_NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby"

# Safety-relevant place types for Google Places API
SAFETY_TYPES = {
    "police": ["police"],
    "hospital": ["hospital", "pharmacy", "doctor"],
    "commercial": ["shopping_mall", "supermarket", "convenience_store", "restaurant", "cafe", "bank", "atm"],
    "transit": ["bus_station", "transit_station", "subway_station", "train_station"],
    "populated": ["school", "university", "church", "hindu_temple", "mosque", "library", "community_center"],
}

# Weights for scoring (default = day mode)
WEIGHTS_DAY = {
    "lighting": 0.20,
    "police": 0.15,
    "medical": 0.15,
    "commercial": 0.20,
    "populated": 0.15,
    "crime_risk": 0.15,
}

# Night mode: lighting & police matter more, commercial matters less
WEIGHTS_NIGHT = {
    "lighting": 0.30,
    "police": 0.22,
    "medical": 0.13,
    "commercial": 0.10,
    "populated": 0.10,
    "crime_risk": 0.15,
}


def get_weights(time_mode="day"):
    """Return scoring weights based on time of day."""
    return WEIGHTS_NIGHT if time_mode == "night" else WEIGHTS_DAY


def haversine(lat1, lon1, lat2, lon2):
    """Distance between two GPS points in meters."""
    R = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def get_route_bbox(coordinates, padding=0.008):
    """Bounding box from [lon, lat] coordinates. Returns (south, west, north, east)."""
    lats = [c[1] for c in coordinates]
    lons = [c[0] for c in coordinates]
    return (min(lats) - padding, min(lons) - padding,
            max(lats) + padding, max(lons) + padding)


def sample_points(coordinates, n=5):
    """Sample n evenly-spaced points from a route's [lon, lat] list."""
    total = len(coordinates)
    if total <= n:
        return list(coordinates)
    step = (total - 1) / (n - 1)
    return [coordinates[round(i * step)] for i in range(n)]


def split_into_segments(coordinates, n=5):
    """Split route coordinates into n segments for per-segment scoring."""
    total = len(coordinates)
    if total < n:
        return [coordinates]
    seg_size = total // n
    segments = []
    for i in range(n):
        start = i * seg_size
        end = start + seg_size if i < n - 1 else total
        segments.append(coordinates[start:end])
    return segments


# ── Google Places Nearby Search ─────────────────────────────────────────

def fetch_nearby_places(lat, lon, api_key, radius=800):
    """
    Query Google Places Nearby Search for all safety-relevant places
    around a single point. Returns categorized results + raw POIs for map.
    """
    # Combine all types into one request (max 50 types per request)
    all_types = []
    for types in SAFETY_TYPES.values():
        all_types.extend(types)

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": "places.displayName,places.location,places.types,places.primaryType",
    }

    body = {
        "includedTypes": all_types,
        "locationRestriction": {
            "circle": {
                "center": {"latitude": lat, "longitude": lon},
                "radius": radius,
            }
        },
        "maxResultCount": 20,
        "languageCode": "en",
    }

    try:
        resp = requests.post(PLACES_NEARBY_URL, json=body, headers=headers, timeout=15)
        resp.raise_for_status()
        return resp.json().get("places", [])
    except Exception as e:
        print(f"[Places Nearby Error] {e}")
        return []


def categorize_places(places):
    """Categorize Google Places results into safety categories."""
    cats = {
        "police": [], "hospital": [], "commercial": [],
        "street_lamp": [], "lit_road": [], "transit": [],
        "populated": [],
    }
    pois = []  # For map markers

    for place in places:
        types = place.get("types", [])
        primary = place.get("primaryType", "")
        loc = place.get("location", {})
        lat = loc.get("latitude", 0)
        lon = loc.get("longitude", 0)
        name = place.get("displayName", {}).get("text", "Unknown")

        if not lat or not lon:
            continue

        poi = {"lat": lat, "lon": lon, "name": name, "type": primary or (types[0] if types else "unknown")}

        # Categorize
        categorized = False
        for t in types:
            if t in SAFETY_TYPES["police"]:
                cats["police"].append((lat, lon))
                poi["category"] = "police"
                poi["icon"] = "🚔"
                categorized = True
                break
            elif t in SAFETY_TYPES["hospital"]:
                cats["hospital"].append((lat, lon))
                poi["category"] = "hospital"
                poi["icon"] = "🏥"
                categorized = True
                break
            elif t in SAFETY_TYPES["commercial"]:
                cats["commercial"].append((lat, lon))
                poi["category"] = "commercial"
                poi["icon"] = "🏪"
                categorized = True
                break
            elif t in SAFETY_TYPES["transit"]:
                cats["transit"].append((lat, lon))
                poi["category"] = "transit"
                poi["icon"] = "🚌"
                categorized = True
                break
            elif t in SAFETY_TYPES["populated"]:
                cats["populated"].append((lat, lon))
                poi["category"] = "populated"
                poi["icon"] = "🏘️"
                categorized = True
                break

        if not categorized:
            cats["commercial"].append((lat, lon))
            poi["category"] = "commercial"
            poi["icon"] = "🏪"

        pois.append(poi)

    return cats, pois


def fetch_safety_google(coordinates, api_key):
    """
    Fetch safety features along a route using Google Places Nearby Search.
    Samples 5 points along the route, queries each, deduplicates results.
    """
    points = sample_points(coordinates, n=5)
    all_places = []
    seen = set()

    for coord in points:
        lon, lat = coord[0], coord[1]
        places = fetch_nearby_places(lat, lon, api_key, radius=800)
        for p in places:
            loc = p.get("location", {})
            key = f"{loc.get('latitude', 0):.5f},{loc.get('longitude', 0):.5f}"
            if key not in seen:
                seen.add(key)
                all_places.append(p)

    print(f"[Google Places] Fetched {len(all_places)} unique places from {len(points)} sample points")
    return categorize_places(all_places)


# ── Overpass Fallback ───────────────────────────────────────────────────

def fetch_safety_overpass(bbox):
    """Fallback: Query Overpass API with smaller bbox + shorter timeout."""
    s, w, n, e = bbox
    # Clamp bbox to avoid timeout (max ~0.1 degree span)
    lat_span = n - s
    lon_span = e - w
    if lat_span > 0.12 or lon_span > 0.12:
        mid_lat = (s + n) / 2
        mid_lon = (w + e) / 2
        s, n = mid_lat - 0.05, mid_lat + 0.05
        w, e = mid_lon - 0.05, mid_lon + 0.05
        print(f"[Overpass] Clamped bbox to 0.1° (~11km) to avoid timeout")

    b = f"{s},{w},{n},{e}"
    query = f"""
[out:json][timeout:15];
(
  node["amenity"="police"]({b});
  node["amenity"="hospital"]({b});
  node["amenity"="clinic"]({b});
  node["amenity"="pharmacy"]({b});
  node["shop"]({b});
  node["amenity"="bank"]({b});
  node["amenity"="restaurant"]({b});
  node["amenity"="cafe"]({b});
  node["highway"="street_lamp"]({b});
  way["lit"="yes"]({b});
  node["amenity"="bus_station"]({b});
  node["public_transport"="station"]({b});
  node["amenity"="school"]({b});
  node["amenity"="place_of_worship"]({b});
);
out center;
"""
    try:
        resp = requests.post(OVERPASS_URL, data={"data": query}, timeout=20)
        resp.raise_for_status()
        elements = resp.json().get("elements", [])
    except Exception as ex:
        print(f"[Overpass Error] {ex}")
        elements = []

    cats = {
        "police": [], "hospital": [], "commercial": [],
        "street_lamp": [], "lit_road": [], "transit": [],
        "populated": [],
    }
    pois = []

    for el in elements:
        tags = el.get("tags", {})
        lat = el.get("lat") or (el.get("center") or {}).get("lat")
        lon = el.get("lon") or (el.get("center") or {}).get("lon")
        if lat is None or lon is None:
            continue

        amenity = tags.get("amenity", "")
        name = tags.get("name", amenity or "unknown")

        if amenity == "police":
            cats["police"].append((lat, lon))
            pois.append({"lat": lat, "lon": lon, "name": name, "type": "police", "category": "police", "icon": "🚔"})
        elif amenity in ("hospital", "clinic", "pharmacy"):
            cats["hospital"].append((lat, lon))
            pois.append({"lat": lat, "lon": lon, "name": name, "type": amenity, "category": "hospital", "icon": "🏥"})
        elif tags.get("shop") or amenity in ("bank", "atm", "restaurant", "cafe"):
            cats["commercial"].append((lat, lon))
            pois.append({"lat": lat, "lon": lon, "name": name, "type": amenity or "shop", "category": "commercial", "icon": "🏪"})
        elif tags.get("highway") == "street_lamp":
            cats["street_lamp"].append((lat, lon))
        elif tags.get("lit") == "yes":
            cats["lit_road"].append((lat, lon))
        elif amenity == "bus_station" or tags.get("public_transport") == "station":
            cats["transit"].append((lat, lon))
            pois.append({"lat": lat, "lon": lon, "name": name, "type": "transit", "category": "transit", "icon": "🚌"})
        elif amenity in ("school", "college", "place_of_worship"):
            cats["populated"].append((lat, lon))
            pois.append({"lat": lat, "lon": lon, "name": name, "type": amenity, "category": "populated", "icon": "🏘️"})

    print(f"[Overpass] Found {sum(len(v) for v in cats.values())} features")
    return cats, pois


# ── Scoring ─────────────────────────────────────────────────────────────

def count_nearby(lat, lon, feature_list, radius_m):
    """Count features within radius_m meters of a point."""
    return sum(1 for fl, fn in feature_list if haversine(lat, lon, fl, fn) <= radius_m)


def nearest_dist(lat, lon, feature_list):
    """Distance (m) to nearest feature. Returns inf if empty."""
    if not feature_list:
        return float("inf")
    return min(haversine(lat, lon, fl, fn) for fl, fn in feature_list)


def score_point(coord, cats, time_mode="day"):
    """Score a single [lon, lat] point for safety (0-100)."""
    lon, lat = coord[0], coord[1]
    weights = get_weights(time_mode)

    # 1. Lighting (street lamps + lit roads within 400m)
    lamps = count_nearby(lat, lon, cats["street_lamp"], 400)
    lit = count_nearby(lat, lon, cats["lit_road"], 400)
    commercial_nearby = count_nearby(lat, lon, cats["commercial"], 400)
    lighting = min(1.0, (lamps + lit + commercial_nearby * 0.5) / 4.0)

    # 2. Police proximity (within 3km is good)
    pd = nearest_dist(lat, lon, cats["police"])
    police = max(0.0, 1.0 - pd / 3000)

    # 3. Medical proximity (within 3km is good)
    hd = nearest_dist(lat, lon, cats["hospital"])
    medical = max(0.0, 1.0 - hd / 3000)

    # 4. Commercial activity (shops, restaurants, banks within 600m)
    shops = count_nearby(lat, lon, cats["commercial"], 600)
    commercial = min(1.0, shops / 3.0)

    # 5. Populated area (transit, schools, temples within 800m)
    tr = count_nearby(lat, lon, cats["transit"], 1000)
    pop = count_nearby(lat, lon, cats["populated"], 800)
    populated = min(1.0, (tr * 2 + pop + commercial_nearby * 0.3) / 3.0)

    # 6. Crime Risk — lower = safer (inverted for scoring: high crime → low score)
    crime_raw = get_crime_risk(lat, lon)
    crime_safety = 1.0 - crime_raw  # Convert risk to safety score

    overall = (
        lighting * weights["lighting"]
        + police * weights["police"]
        + medical * weights["medical"]
        + commercial * weights["commercial"]
        + populated * weights["populated"]
        + crime_safety * weights["crime_risk"]
    )

    # Apply a floor boost — even highways have some base safety
    overall = min(1.0, overall * 1.15 + 0.05)

    return {
        "lighting": round(min(100, lighting * 100)),
        "police": round(min(100, police * 100)),
        "medical": round(min(100, medical * 100)),
        "commercial": round(min(100, commercial * 100)),
        "populated": round(min(100, populated * 100)),
        "crime_risk": round(min(100, crime_safety * 100)),
        "overall": round(min(100, overall * 100)),
    }


def score_route(coordinates, cats, time_mode="day"):
    """Score an entire route. Returns averaged safety dict."""
    points = sample_points(coordinates, n=8)
    scores = [score_point(p, cats, time_mode) for p in points]
    if not scores:
        return {k: 0 for k in ("lighting", "police", "medical", "commercial", "populated", "crime_risk", "overall")}
    keys = scores[0].keys()
    return {k: round(sum(s[k] for s in scores) / len(scores)) for k in keys}


def score_segments(coordinates, cats, n_segments=5, time_mode="day"):
    """Score route in segments. Returns list of {color, score} per segment."""
    segments = split_into_segments(coordinates, n_segments)
    results = []
    for seg in segments:
        if not seg:
            results.append({"score": 0, "color": "#ef4444"})
            continue
        mid = seg[len(seg) // 2]
        s = score_point(mid, cats, time_mode)
        overall = s["overall"]
        if overall >= 60:
            color = "#10b981"  # green
        elif overall >= 35:
            color = "#f59e0b"  # yellow
        else:
            color = "#ef4444"  # red
        results.append({
            "score": overall,
            "color": color,
            "start_idx": 0,  # will be set by caller
            "end_idx": 0,
        })
    return results


def fetch_safety_features(coordinates, api_key=None):
    """
    Main entry: fetch safety features using Google Places (preferred) or Overpass (fallback).
    Returns (cats_dict, pois_list).
    """
    if api_key:
        cats, pois = fetch_safety_google(coordinates, api_key)
        total = sum(len(v) for v in cats.values())
        if total > 0:
            return cats, pois
        print("[Safety] Google Places returned 0 results, falling back to Overpass...")

    # Fallback to Overpass
    bbox = get_route_bbox(coordinates, padding=0.005)
    return fetch_safety_overpass(bbox)

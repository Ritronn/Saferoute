"""
SafeRoute — Crime Hotspots Database
Uses Gemini AI to generate a crime risk database for Pune.
Caches results to pune_crime_data.json for subsequent runs.
"""

import os
import json
import math
import requests
import time
from dotenv import load_dotenv

load_dotenv()

GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_KEY}"
CACHE_FILE = os.path.join(os.path.dirname(__file__), "pune_crime_data.json")

# In-memory cache
_crime_data = None


def _call_gemini(prompt):
    """Call Gemini API with retry."""
    for attempt in range(3):
        try:
            resp = requests.post(GEMINI_URL, json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.4, "maxOutputTokens": 4000}
            }, timeout=60)
            if resp.status_code == 429:
                time.sleep(2 ** attempt)
                continue
            resp.raise_for_status()
            data = resp.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as e:
            print(f"[Crime Hotspots Gemini Error] {e}")
            if attempt < 2:
                time.sleep(1)
    return None


def _parse_gemini_response(text):
    """Parse Gemini's JSON response, handling markdown code fences."""
    if not text:
        return None
    # Strip markdown fences
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first line (```json) and last line (```)
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines)
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        print(f"[Crime Hotspots] JSON parse error: {e}")
        return None


def generate_crime_data():
    """Use Gemini to generate crime hotspot data for Pune."""
    prompt = """List the 30 most crime-prone areas and neighborhoods in Pune, Maharashtra, India.

For each area, provide:
- name: Area/neighborhood name
- lat: Approximate latitude (decimal)
- lon: Approximate longitude (decimal)
- crime_types: List of common crime types (e.g., "theft", "chain_snatching", "assault", "harassment", "robbery", "vehicle_theft", "pickpocketing")
- risk_level: Risk score from 1-10 (10 = most dangerous)
- description: One sentence about why this area is risky

Return ONLY a valid JSON array, no markdown, no explanation. Example format:
[
  {"name": "Example Area", "lat": 18.52, "lon": 73.85, "crime_types": ["theft", "robbery"], "risk_level": 7, "description": "Known for late-night robberies near the station."}
]"""

    text = _call_gemini(prompt)
    data = _parse_gemini_response(text)

    if data and isinstance(data, list) and len(data) > 0:
        # Save to cache file
        with open(CACHE_FILE, "w") as f:
            json.dump(data, f, indent=2)
        print(f"[Crime Hotspots] Generated and cached {len(data)} hotspots via Gemini")
        return data

    print("[Crime Hotspots] Failed to generate data from Gemini")
    return _get_fallback_data()


def _get_fallback_data():
    """Hardcoded fallback Pune crime hotspots if Gemini fails."""
    return [
        {"name": "Pune Station Area", "lat": 18.5285, "lon": 73.8742, "crime_types": ["pickpocketing", "chain_snatching", "theft"], "risk_level": 8, "description": "Crowded railway station area with high petty crime rates."},
        {"name": "Hadapsar", "lat": 18.5089, "lon": 73.9260, "crime_types": ["vehicle_theft", "robbery", "chain_snatching"], "risk_level": 7, "description": "Rapidly developing area with patchy surveillance coverage."},
        {"name": "Yerawada", "lat": 18.5580, "lon": 73.8869, "crime_types": ["assault", "robbery", "theft"], "risk_level": 7, "description": "Near jail area with frequent assault incidents."},
        {"name": "Kondhwa", "lat": 18.4693, "lon": 73.8942, "crime_types": ["vehicle_theft", "chain_snatching"], "risk_level": 6, "description": "Peripheral area with rising vehicle theft."},
        {"name": "Swargate", "lat": 18.5018, "lon": 73.8636, "crime_types": ["pickpocketing", "theft", "harassment"], "risk_level": 7, "description": "Major bus terminus with crowding and petty crime."},
        {"name": "Kothrud outskirts", "lat": 18.5074, "lon": 73.8077, "crime_types": ["chain_snatching", "robbery"], "risk_level": 5, "description": "Isolated stretches near outskirts."},
        {"name": "Pimpri-Chinchwad", "lat": 18.6298, "lon": 73.7997, "crime_types": ["theft", "assault", "robbery"], "risk_level": 6, "description": "Industrial area with night-time crime."},
        {"name": "Bibwewadi", "lat": 18.4812, "lon": 73.8659, "crime_types": ["chain_snatching", "vehicle_theft"], "risk_level": 6, "description": "Residential area with increasing snatching incidents."},
        {"name": "Katraj", "lat": 18.4566, "lon": 73.8604, "crime_types": ["theft", "assault"], "risk_level": 6, "description": "Hilly terrain with poorly lit roads."},
        {"name": "Shivajinagar", "lat": 18.5314, "lon": 73.8446, "crime_types": ["pickpocketing", "theft"], "risk_level": 5, "description": "Commercial hub with crowded markets."},
        {"name": "Lohegaon", "lat": 18.5880, "lon": 73.9196, "crime_types": ["robbery", "vehicle_theft"], "risk_level": 5, "description": "Airport-adjacent area with isolated pockets."},
        {"name": "Wanowrie", "lat": 18.4880, "lon": 73.8930, "crime_types": ["chain_snatching", "theft"], "risk_level": 5, "description": "Mixed-use area with narrow lanes."},
        {"name": "Dhanori", "lat": 18.5890, "lon": 73.8950, "crime_types": ["vehicle_theft", "harassment"], "risk_level": 5, "description": "Developing suburb with inadequate street lighting."},
        {"name": "Undri", "lat": 18.4559, "lon": 73.9150, "crime_types": ["robbery", "theft"], "risk_level": 5, "description": "New development area with sparse police presence."},
        {"name": "Mundhwa", "lat": 18.5326, "lon": 73.9310, "crime_types": ["theft", "chain_snatching"], "risk_level": 5, "description": "IT corridor area with late-night safety concerns."},
    ]


def load_crime_data():
    """Load crime data from cache or generate fresh."""
    global _crime_data
    if _crime_data:
        return _crime_data

    # Try loading from cache file
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r") as f:
                _crime_data = json.load(f)
            print(f"[Crime Hotspots] Loaded {len(_crime_data)} hotspots from cache")
            return _crime_data
        except Exception as e:
            print(f"[Crime Hotspots] Cache read error: {e}")

    # Generate fresh data using Gemini
    _crime_data = generate_crime_data()
    return _crime_data


def haversine(lat1, lon1, lat2, lon2):
    """Distance between two GPS points in meters."""
    R = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def get_crime_risk(lat, lon):
    """
    Get crime risk score for a location (0.0 = no risk, 1.0 = max risk).
    Checks proximity to all known crime hotspots.
    """
    hotspots = load_crime_data()
    if not hotspots:
        return 0.0

    max_risk = 0.0
    INFLUENCE_RADIUS = 2000  # meters — hotspot influence radius

    for hs in hotspots:
        dist = haversine(lat, lon, hs["lat"], hs["lon"])
        if dist < INFLUENCE_RADIUS:
            risk_level = hs.get("risk_level", 5) / 10.0  # Normalize to 0-1
            # Risk decays with distance (closer = higher risk)
            proximity_factor = max(0.0, 1.0 - dist / INFLUENCE_RADIUS)
            weighted_risk = risk_level * proximity_factor
            max_risk = max(max_risk, weighted_risk)

    return min(1.0, max_risk)


def get_all_hotspots():
    """Return all hotspots for heatmap rendering."""
    return load_crime_data() or []

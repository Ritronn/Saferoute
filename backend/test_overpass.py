"""Quick test: check if Overpass API returns data for Pune center."""
import requests

bbox = "18.50,73.82,18.56,73.90"  # Central Pune area

query = f"""
[out:json][timeout:30];
(
  node["amenity"="police"]({bbox});
  node["amenity"="hospital"]({bbox});
  node["shop"]({bbox});
  node["highway"="street_lamp"]({bbox});
  way["lit"="yes"]({bbox});
);
out center;
"""

print("Querying Overpass API for central Pune...")
try:
    r = requests.post("https://overpass-api.de/api/interpreter", data={"data": query}, timeout=60)
    print(f"Status: {r.status_code}")
    data = r.json()
    elements = data.get("elements", [])
    print(f"Total elements found: {len(elements)}")
    
    # Count by type
    counts = {}
    for el in elements:
        tags = el.get("tags", {})
        amenity = tags.get("amenity", "")
        if amenity == "police":
            counts["police"] = counts.get("police", 0) + 1
        elif amenity in ("hospital", "clinic"):
            counts["hospital"] = counts.get("hospital", 0) + 1
        elif tags.get("shop"):
            counts["shop"] = counts.get("shop", 0) + 1
        elif tags.get("highway") == "street_lamp":
            counts["street_lamp"] = counts.get("street_lamp", 0) + 1
        elif tags.get("lit") == "yes":
            counts["lit_road"] = counts.get("lit_road", 0) + 1
        else:
            counts["other"] = counts.get("other", 0) + 1
    
    print(f"\nBreakdown: {counts}")
    
    if len(elements) == 0:
        print("\n⚠️  OVERPASS RETURNED 0 ELEMENTS — this is the problem!")
        print("Possible causes: rate limiting, server overload, or query timeout")
except Exception as e:
    print(f"ERROR: {e}")

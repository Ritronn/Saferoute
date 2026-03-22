"""
SafeRoute — Gemini AI Service
Generates safety briefings and crime insights using Google Gemini API.
"""

import os
import requests
import time
from dotenv import load_dotenv

load_dotenv()

GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_KEY}"


def call_gemini(prompt):
    """Call Gemini API with retry for rate limits."""
    for attempt in range(3):
        try:
            resp = requests.post(GEMINI_URL, json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.7, "maxOutputTokens": 500}
            }, timeout=60)
            if resp.status_code == 429:
                print(f"[Gemini] Rate limited, retrying in {2 ** attempt}s...")
                time.sleep(2 ** attempt)
                continue
            resp.raise_for_status()
            data = resp.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as e:
            print(f"[Gemini Error] {e}")
            if attempt < 2:
                time.sleep(1)
    return None


def generate_safety_briefing(route_data, features_found):
    """Generate an AI safety briefing for a route."""
    safety = route_data["safety"]
    prompt = f"""You are SafeRoute AI, a travel safety analyst for Indian cities. Generate a safety briefing for this route.

Route Details:
- Distance: {route_data['distance_km']} km, Duration: ~{route_data['duration_min']} minutes
- Overall Safety Score: {safety['overall']}/100

Safety Breakdown:
- Street Lighting: {safety['lighting']}%
- Police Coverage: {safety['police']}%
- Medical Access: {safety['medical']}%
- Commercial Activity: {safety['commercial']}%
- Populated Areas: {safety['populated']}%

Safety Infrastructure Found Along Route:
- Police Stations: {features_found.get('police', 0)}
- Hospitals/Clinics: {features_found.get('hospital', 0)}
- Street Lamps: {features_found.get('street_lamp', 0)}
- Lit Roads: {features_found.get('lit_road', 0)}
- Commercial Points: {features_found.get('commercial', 0)}
- Transit Stops: {features_found.get('transit', 0)}

Write a 4-5 sentence safety briefing that:
1. Summarizes the overall safety level (good/moderate/caution)
2. Highlights the STRONGEST safety factor
3. Warns about the WEAKEST factor
4. Gives one practical travel tip
5. If score is below 40, suggest traveling during daytime

Write in simple, clear English. No bullet points, flowing paragraph. Be helpful not alarmist."""

    return call_gemini(prompt)


def get_crime_insights(lat, lon, area_name=""):
    """Get AI-powered crime insights for an area."""
    prompt = f"""You are a safety analyst for Indian cities. Provide a brief crime and safety analysis for the area near coordinates ({lat}, {lon}){f' ({area_name})' if area_name else ''}.

Include these sections (use these exact headings):

**Safety Level**: [Safe / Moderate / Exercise Caution] - one line assessment

**Recent Trends**: 2-3 sentences about common safety concerns in this type of area (urban/suburban/commercial). Reference specific types of incidents like chain snatching, pickpocketing, traffic accidents etc. that are common in Indian cities.

**Time Advisory**: One sentence about safest vs least safe times.

**Safety Tips**:
• Tip 1
• Tip 2  
• Tip 3

Keep it concise and specific to Indian urban context. Do not use scary language. Be practical and helpful. Total response should be under 150 words."""

    return call_gemini(prompt)

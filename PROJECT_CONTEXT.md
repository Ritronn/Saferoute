# 🛡️ SafeRoute — Project Context

> **Navigate safely, not just fast.**
> SafeRoute is a full-stack web application that helps users find the **safest route** between two locations, not just the fastest. It analyzes real-world safety data — street lighting, police proximity, hospitals, commercial activity, and crime hotspots — to score and rank routes by safety.

---

## 📋 Table of Contents

1. [Tech Stack](#-tech-stack)
2. [Project Structure](#-project-structure)
3. [Architecture Overview](#-architecture-overview)
4. [Features & How They Work](#-features--how-they-work)
   - [Smart Route Safety Scoring](#1--smart-route-safety-scoring)
   - [Multi-Route Comparison](#2--multi-route-comparison)
   - [Color-Coded Safety Map](#3--color-coded-safety-map)
   - [Day/Night Mode](#4--daynight-mode)
   - [Crime Heatmap](#5--crime-heatmap)
   - [AI Safety Briefing](#6--ai-safety-briefing-gemini)
   - [Live Crime News](#7--live-crime-news-scraper)
   - [Emergency SOS](#8--emergency-sos)
   - [Fake Call](#9--fake-call)
   - [Guardian Mode](#10--guardian-mode-dead-mans-switch)
   - [Live Trip Sharing](#11--live-trip-sharing-whatsapp)
   - [Community Board](#12--community-board)
   - [Location Autocomplete](#13--location-autocomplete)
5. [API Endpoints](#-api-endpoints)
6. [How to Run](#-how-to-run)

---

## 🧰 Tech Stack

| Layer      | Technology                                                                 |
| ---------- | -------------------------------------------------------------------------- |
| **Frontend** | React 18 (JSX) + Vite dev server                                         |
| **Map**      | Leaflet.js via `react-leaflet` (CARTO Voyager tiles)                     |
| **Backend**  | Python Flask + Flask-CORS                                                |
| **Routing**  | OSRM (Open Source Routing Machine) — free driving directions             |
| **Safety Data** | Google Places Nearby Search API (primary), Overpass/OSM API (fallback) |
| **AI**       | Google Gemini 2.5 Flash — safety briefings + crime hotspot generation     |
| **News**     | Google News RSS — real-time crime article scraping                        |
| **Styling**  | Vanilla CSS with glassmorphism, gradients, and micro-animations           |

---

## 📂 Project Structure

```
SafeRoute/
├── backend/
│   ├── app.py               # Flask server — all API endpoints
│   ├── safety_scorer.py      # Safety scoring engine (the brain)
│   ├── ai_service.py         # Gemini AI integration for safety briefings
│   ├── crime_scraper.py      # Google News RSS crime news scraper
│   ├── crime_hotspots.py     # Crime hotspot database (Gemini-generated + fallback)
│   ├── test_overpass.py      # Overpass API test script
│   ├── requirements.txt      # Python dependencies
│   └── .env                  # API keys (GOOGLE_PLACES_API_KEY, GEMINI_API_KEY)
│
├── frontend/
│   ├── index.html            # Entry HTML
│   ├── vite.config.js        # Vite config (proxies /api to Flask backend)
│   ├── package.json          # Node dependencies
│   └── src/
│       ├── main.jsx          # React entry point
│       ├── App.jsx           # Root component — orchestrates everything
│       ├── index.css         # All styles (dark theme, glassmorphism, animations)
│       └── components/
│           ├── LocationInput.jsx   # Autocomplete search for start/end locations
│           ├── MapView.jsx         # Leaflet map with routes, POIs, heatmap
│           ├── RoutePanel.jsx      # Route cards with safety score breakdown
│           ├── SafetyBriefing.jsx  # AI-generated safety summary panel
│           ├── SOSButton.jsx       # Emergency SOS floating button + panel
│           ├── FakeCall.jsx        # Fake incoming call simulator
│           ├── SafetyTimer.jsx     # Guardian mode (dead man's switch timer)
│           ├── CrimeInfo.jsx       # Live crime news feed
│           ├── Community.jsx       # Community tips / incident reporting board
│           └── HeatmapToggle.jsx   # Toggle button for crime heatmap overlay
│
└── .gitignore
```

---

## 🏗 Architecture Overview

```
┌─────────────────────────────────┐
│         FRONTEND (React)        │
│  User types locations → clicks  │
│  "Find Safest Route" button     │
│                                 │
│  Components render:             │
│  • Map with color-coded routes  │
│  • Safety score breakdowns      │
│  • AI briefing, SOS, community  │
└──────────────┬──────────────────┘
               │  HTTP calls via /api/*
               ▼
┌─────────────────────────────────┐
│       BACKEND (Flask API)       │
│                                 │
│  /api/geocode  → Google Places  │
│  /api/route    → OSRM + Safety  │
│  /api/safety-briefing → Gemini  │
│  /api/crime-news → Google RSS   │
│  /api/crime-hotspots → Gemini   │
└──────────────┬──────────────────┘
               │
    ┌──────────┼──────────────┐
    ▼          ▼              ▼
 OSRM       Google         Gemini
(Routes)   Places API     AI (2.5)
            + Overpass
            (Safety POIs)
```

**Flow:** User picks start & end → frontend calls `/api/route` → backend fetches driving routes from OSRM, queries Google Places for nearby police/hospitals/shops/transit along the route, scores each route segment → returns ranked routes with safety data → frontend renders color-coded routes on the map with all the details.

---

## ✨ Features & How They Work

### 1. 🧠 Smart Route Safety Scoring

**What it does:** Every route gets a safety score from 0–100 based on **6 real-world factors**.

**How it works:**
- The backend samples **8 points** evenly along the route
- For each point, it queries **Google Places Nearby Search** (800m radius) for:
  - 🔦 **Street Lighting** — counts street lamps + lit roads + commercial areas (proxy for lighting)
  - 🚔 **Police Coverage** — distance to nearest police station (within 3km = good)
  - 🏥 **Medical Access** — distance to nearest hospital/pharmacy (within 3km = good)
  - 🏪 **Commercial Activity** — count of shops, restaurants, banks within 600m
  - 🏘️ **Populated Areas** — transit stops, schools, temples within 800m
  - 🔴 **Crime Risk** — proximity to known crime hotspots (AI-generated database)
- Each factor is scored 0–100, then weighted and combined into an overall score
- If Google Places doesn't work, it **falls back to Overpass (OpenStreetMap)** data
- A floor boost ensures even highways get a baseline safety score

**Scoring weights (Day mode):**
| Factor | Weight |
|--------|--------|
| Street Lighting | 20% |
| Police Coverage | 15% |
| Medical Access | 15% |
| Commercial Activity | 20% |
| Populated Areas | 15% |
| Crime Risk | 15% |

---

### 2. 🗺️ Multi-Route Comparison

**What it does:** Shows **2–3 alternative routes** between your start and destination, ranked by safety.

**How it works:**
- First tries OSRM's built-in `alternatives=3` parameter to get different routes
- If fewer than 3 routes come back, it **generates waypoints** perpendicular to the straight-line path between start and end, forcing OSRM to find genuinely different roads through different neighborhoods
- Each route is independently scored and labeled:
  - 🛡️ **SAFEST** — highest safety score
  - ⚡ **FASTEST** — shortest travel time
- Route cards show distance (km), duration (min), and full safety breakdown with animated progress bars

---

### 3. 🎨 Color-Coded Safety Map

**What it does:** The active route on the map is drawn in **segments colored by safety level** — green (safe), yellow (moderate), red (caution).

**How it works:**
- Each route is split into **5 segments**
- The midpoint of each segment is scored individually
- Segment colors: `≥60 → 🟢 green` | `≥35 → 🟡 yellow` | `<35 → 🔴 red`
- Inactive routes show as thin dashed gray lines
- Safety POIs (police, hospitals, shops, transit) appear as colored circle markers on the map with popups showing their name and type

---

### 4. 🌙 Day/Night Mode

**What it does:** Adjusts safety scoring weights based on time of day — night mode prioritizes lighting and police.

**How it works:**
- **Auto-detects** current time: 6 AM–6 PM = Day, otherwise = Night
- User can manually toggle with a ☀️/🌙 button
- Night mode shifts weights:
  - Street Lighting: 20% → **30%** (lights matter more at night)
  - Police Coverage: 15% → **22%** (patrol presence is critical)
  - Commercial Activity: 20% → **10%** (shops are closed)
  - Populated Areas: 15% → **10%** (fewer people around)
- The route is re-scored when mode changes

---

### 5. 🔥 Crime Heatmap

**What it does:** Overlays red/orange/yellow circles on the map showing known crime hotspot areas.

**How it works:**
- On first load, backend calls **Gemini AI** to generate a database of ~30 crime-prone areas in Pune (with lat/lon, crime types, risk levels 1-10, and descriptions)
- This data is **cached to `pune_crime_data.json`** so subsequent loads are instant
- If Gemini fails, 15 hardcoded fallback hotspots are used
- Frontend renders each hotspot as a `<Circle>` on the map:
  - Risk 8-10: Large red circles (600m radius, 35% opacity)
  - Risk 6-7: Orange circles (500m radius)
  - Risk 4-5: Yellow circles (400m radius)
- Clicking a hotspot shows: name, risk level, description, and crime types
- Toggle on/off with the 🔥 button on the map

---

### 6. 🤖 AI Safety Briefing (Gemini)

**What it does:** Generates a **human-readable safety paragraph** for the selected route using Google Gemini AI.

**How it works:**
- When a route is selected, the frontend sends route data (distance, duration, all 6 safety scores, and infrastructure counts) to `/api/safety-briefing`
- Backend prompts **Gemini 2.5 Flash** to write a 4-5 sentence briefing that:
  1. Summarizes overall safety level (good/moderate/caution)
  2. Highlights the strongest safety factor
  3. Warns about the weakest factor
  4. Gives a practical travel tip
  5. If score < 40, suggests traveling during daytime
- Retry logic with exponential backoff for rate limits (429 errors)
- Example output: *"This route has moderate safety with strong commercial activity around the midway point. Medical access is excellent with two hospitals within reach. However, street lighting drops significantly in the final stretch — consider keeping your phone charged. For nighttime travel, the parallel main road offers better visibility."*

---

### 7. 📰 Live Crime News Scraper

**What it does:** Shows **real, recent crime news articles** from Google News for the area you're searching.

**How it works:**
- Auto-detects user's city via browser **geolocation + reverse geocoding** (Nominatim/OSM)
- Scrapes **Google News RSS feed** with 4 queries: `"crime [area]"`, `"theft [area]"`, `"accident [area]"`, `"safety [area]"`
- Parses XML RSS, extracts title, source, link, and publication date
- Deduplicates articles and returns up to 8 results
- User can also manually search any area name
- Articles link out to the original news source

---

### 8. 🆘 Emergency SOS

**What it does:** A floating red SOS button that gives **instant access to emergency numbers** and location sharing.

**How it works:**
- Floating 🆘 button always visible on the map
- Opens a panel with **4 one-tap emergency call buttons**:
  - 👩 Women Helpline — 1091
  - 🚔 Police — 112
  - 🚑 Ambulance — 108
  - 🚒 Fire — 101
- **Copy Location:** Uses browser geolocation to get current GPS coordinates, generates a Google Maps link, and copies an emergency message to clipboard
- **Share Live Trip:** Generates a WhatsApp message with trip details (start, destination, ETA, safety score, Google Maps route link) and opens WhatsApp share

---

### 9. 📱 Fake Call

**What it does:** Simulates a **realistic incoming phone call** to help the user leave an uncomfortable or unsafe situation with a believable excuse.

**How it works:**
- Accessed from the SOS panel
- User picks a "caller" (Mom, Dad, Boss, Best Friend) and a delay (15s / 30s / 1 min)
- After the delay, a **full-screen incoming call overlay** appears with:
  - The caller's name and emoji
  - "Incoming Call..." status
  - Vibration pattern (`navigator.vibrate`)
  - Realistic ringtone generated via **Web Audio API** (sine wave, ring-ring pattern)
- User can **Accept** (switches to a fake in-call screen with a running timer) or **Decline**
- The in-call screen shows the caller name and elapsed time, with an "End Call" button
- During countdown, a banner shows *"Call from Mom in 12s"* with a cancel option

---

### 10. ⏱️ Guardian Mode (Dead Man's Switch)

**What it does:** A **check-in timer** — if you don't confirm you're safe before it expires, the app triggers a full emergency alert. Like a dead man's switch for personal safety.

**How it works:**
- User sets up:
  - 📍 Destination (where they're heading)
  - 👤 Emergency contact name + phone number
  - ⏳ Timer duration (15 min / 30 min / 1 hr / 2 hrs / custom)
  - 📝 Custom SOS message (pre-filled with a default emergency template)
- **Active countdown screen** shows:
  - Animated circular progress ring (green → amber → red as time runs low)
  - Large countdown timer
  - Contact info badge
  - Buttons: ✅ "I'm Safe" | ⏱️ "+15 min" | Cancel
- **If timer expires without check-in:**
  - Full-screen red ALERT overlay
  - Loud **siren alarm** via Web Audio API (rising sawtooth wave pattern)
  - Phone vibration pattern
  - Browser notification
  - Buttons to: 💬 Share SOS on WhatsApp | 📞 Call emergency contact | ✅ Dismiss (false alarm)
- **Survives page refresh** — uses `localStorage` to persist the countdown
- App.jsx checks on load if a Guardian timer is active and shows an "ACTIVE" badge

---

### 11. 📲 Live Trip Sharing (WhatsApp)

**What it does:** Sends a **formatted WhatsApp message** to a trusted contact with your trip details — route, ETA, safety score, and a Google Maps link.

**How it works:**
- Available in the SOS panel after selecting a route
- Generates a message like:
  ```
  🛡️ SafeRoute - Live Trip Update

  I'm traveling from *Koregaon Park* to *Hinjewadi*
  📏 ETA: ~35 min
  🛡️ Safety Score: 72/100

  📍 Track my route: https://www.google.com/maps/dir/18.53,73.89/18.59,73.74

  If I don't arrive safely, please check on me. 🙏
  ```
- Opens WhatsApp's share URL (`wa.me`) with the pre-filled message

---

### 12. 👥 Community Board

**What it does:** A **local safety tips board** where users can share route advice, report incidents, and upvote helpful posts.

**How it works:**
- Pre-seeded with 6 realistic sample posts from Pune locals
- Post types (tags):
  - 🟢 **Route Tip** — safer alternative route suggestions
  - 🔴 **Incident** — crime/accident reports
  - 🔵 **Safety Tip** — general safety advice
  - 🟡 **Update** — area safety updates (e.g., new police patrol)
- Users can:
  - Post new tips (name, area, tag, text)
  - Upvote/downvote posts (one vote per post)
  - Filter by tag type
- Data stored in **localStorage** (persists between sessions)
- Reddit-style upvote/downvote UI with vote counts

---

### 13. 🔍 Location Autocomplete

**What it does:** As the user types a location, it shows **smart autocomplete suggestions** with icons and place types.

**How it works:**
- Calls Google Places Text Search API with the user's query
- Returns up to 5 results with: name, formatted address, type (Restaurant, Hospital, etc.), emoji icon, and coordinates
- **Rate limited** per IP: 100 requests/day with a 24-hour rolling reset
- **Cached** with a 5-minute TTL to avoid redundant API calls
- Cache auto-prunes when it exceeds 500 entries
- Icons are mapped from Google Place types (e.g., `restaurant → 🍽️`, `hospital → 🏥`, `park → 🌳`)

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/geocode?q=...` | Location autocomplete via Google Places |
| `POST` | `/api/route` | Find & rank routes by safety. Body: `{start_lat, start_lon, end_lat, end_lon, time_mode}` |
| `POST` | `/api/safety-briefing` | AI safety briefing via Gemini. Body: `{route, features_found}` |
| `GET`  | `/api/crime-news?area=...` | Scrape crime news from Google News RSS |
| `GET`  | `/api/crime-hotspots` | Crime hotspot data for heatmap overlay |

---

## 🚀 How to Run

### Backend
```bash
cd backend
pip install -r requirements.txt
# Create .env with:
#   GOOGLE_PLACES_API_KEY=your_key
#   GEMINI_API_KEY=your_key
python app.py
# Runs on http://localhost:5000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173 (proxied to backend)
```

---

> Built with ❤️ for safer navigation. Powered by Google Places API + Google Gemini AI + OSRM.

# SafeRoute 🛡️

**Navigate safely, not just fast**

SafeRoute is a route planning application that prioritizes safety over speed by analyzing real-world infrastructure data to find the safest paths between locations.

![SafeRoute Demo](https://via.placeholder.com/800x400/1a1a2e/16a085?text=SafeRoute+Demo)

## 🎯 Problem Statement

Traditional navigation apps optimize for speed and traffic, but ignore safety factors like lighting, police presence, and populated areas. SafeRoute fills this gap by providing safety-aware routing for:

- Urban commuters (especially women traveling alone)
- Tourists in unfamiliar cities
- Ride-share and delivery drivers
- Anyone prioritizing personal safety over travel time

## ✨ Key Features

### 🗺️ Safety-First Routing
- Finds multiple route alternatives ranked by safety score
- Analyzes 6 safety factors with intelligent weighting
- Visual safety breakdown for informed decision-making

### 📊 Comprehensive Safety Scoring
- **Street Lighting (20%)** - Street lamps and lit roads
- **Police Coverage (15%)** - Proximity to police stations
- **Medical Access (15%)** - Hospitals and clinics nearby
- **Commercial Activity (20%)** - Shops, restaurants, populated areas
- **Populated Areas (15%)** - Schools, transit hubs, community centers
- **Crime Risk (15%)** - Historical crime data integration

### 🎨 Intuitive Interface
- Interactive map with color-coded route safety levels
- Expandable route cards with detailed safety metrics
- Real-time location search with autocomplete
- Dark theme optimized for night usage

## 🏗️ Architecture

### Backend (Python/Flask)
```
backend/
├── app.py              # Main Flask API server
├── safety_scorer.py    # Core safety scoring algorithm
└── requirements.txt    # Python dependencies
```

**API Endpoints:**
- `GET /api/geocode` - Location autocomplete via Nominatim
- `POST /api/route` - Route finding and safety analysis

### Frontend (React/Vite)
```
frontend/
├── src/
│   ├── App.jsx                    # Main application component
│   ├── components/
│   │   ├── LocationInput.jsx      # Search autocomplete
│   │   ├── MapView.jsx           # Interactive Leaflet map
│   │   └── RoutePanel.jsx        # Safety metrics display
│   └── main.jsx                  # Application entry point
└── package.json
```

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- npm or yarn

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
python app.py
```
Server runs on `http://localhost:5000`

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Application runs on `http://localhost:5173`

## 🔧 How It Works

### 1. Route Discovery
- User inputs start and destination locations
- Backend queries OSRM for 3 alternative routes
- Creates bounding box encompassing all routes

### 2. Safety Data Collection
- Single Overpass API call fetches OpenStreetMap safety features
- Collects street lamps, police stations, hospitals, shops, transit hubs
- Fallback to Google Places API for better data coverage

### 3. Safety Scoring Algorithm
```python
# Sample 8 evenly-spaced points along each route
points = sample_points(route_coordinates, n=8)

# Score each point for 6 safety factors
for point in points:
    lighting_score = count_nearby_lights(point, radius=400m)
    police_score = distance_to_nearest_police(point, max_dist=3km)
    # ... other factors
    
# Weighted average with time-aware adjustments
overall_score = (lighting * 0.20 + police * 0.15 + medical * 0.15 + 
                commercial * 0.20 + populated * 0.15 + crime * 0.15)
```

### 4. Route Ranking
- Routes sorted by overall safety score (0-100)
- Fastest route labeled separately if different from safest
- Visual indicators: Green (60+), Amber (35-59), Red (<35)

## 🌍 Data Sources

- **OpenStreetMap** - Street lighting, infrastructure data
- **OSRM** - Route calculation and alternatives
- **Nominatim** - Location geocoding and search
- **Overpass API** - Efficient OSM data querying
- **Google Places** - Enhanced POI data (fallback)

## 📈 Technical Highlights

### Performance Optimizations
- Single bounding box query instead of per-route API calls
- Haversine distance calculations for GPS accuracy
- Debounced search with 500ms delay
- Efficient coordinate sampling (8 points vs full route)

### Scalability Considerations
- Stateless backend design
- Caching-ready architecture
- Modular scoring system for easy feature additions
- Time-aware scoring (day/night mode weights)

## 🎯 Use Cases

### Personal Safety
- Late night commuting in urban areas
- Exploring unfamiliar neighborhoods
- Women traveling alone
- Tourist navigation in new cities

### Professional Applications
- Ride-share driver route optimization
- Delivery service safety protocols
- Corporate travel policy compliance
- Insurance risk assessment

## 🔮 Future Enhancements

### Real-Time Features
- Live crime incident integration
- User-reported safety updates
- Weather-based visibility adjustments
- Emergency service response times

### Advanced Analytics
- Predictive safety modeling with ML
- Seasonal safety pattern analysis
- Community-driven safety reporting
- Integration with smart city infrastructure

### Platform Expansion
- Mobile app development
- API for third-party integrations
- Offline safety map downloads
- Multi-modal transport safety (walking, cycling, transit)

## 🤝 Contributing

We welcome contributions! Areas for improvement:

- Enhanced crime data integration
- Mobile-responsive design
- Additional safety factors
- Performance optimizations
- International market adaptations

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🏆 Hackathon Project

Built during [Hackathon Name] - demonstrating the potential for safety-first navigation in urban environments.

**Team:** [Your Team Name]  
**Demo:** [Live Demo URL]  
**Presentation:** [Slides URL]

---

*SafeRoute: Because getting there safely matters more than getting there fast.*
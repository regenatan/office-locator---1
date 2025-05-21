# 🗺️ Tourist on a Budget – Interactive Map App

## 📌 Project Overview
**Tourist on a Budget** is an interactive web map that helps users discover attractions in Singapore that are near MRT stations and bus stops.  
Built with **Leaflet.js**, this app integrates public transport data and Google Places API to show budget-friendly places to explore.

---

## 🚀 Features
- View Singapore MRT stations and bus stops on a map
- Find nearby attractions, hawker centres, and companies within 400m of a transport node
- Marker clustering for cleaner visualization
- Sidebar details for selected locations
- Responsive design with Bootstrap for mobile usability
- Clear all markers and reset map with a button

---

## 🛠️ Tech Stack
- **Frontend**: HTML, CSS, JavaScript, Bootstrap
- **Mapping Library**: Leaflet.js
- **APIs/Data Sources**:
  - [data.gov.sg](https://data.gov.sg) for MRT and bus stop data (GeoJSON)
  - Google Places API for attractions and hawkers

---

## 📂 Project Structure
/tourist-map/
│
├── index.html # Main HTML file
├── style.css # Custom styles
├── script.js # Main JavaScript logic
├── /data/
│ ├── cleaned_mrt_stations.json
│ └── cleaned_bus_stops.json

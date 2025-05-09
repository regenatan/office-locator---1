var bounds = L.latLngBounds(
  L.latLng(1.15, 103.59), // SW (Tuas/Western Islands)
  L.latLng(1.47, 104.12)  // NE (Changi/Punggol)
);

// Initialize map with locked bounds
let map = L.map('map', {
  maxBounds: bounds,          // Restricts panning to Singapore
  maxBoundsViscosity: 1.0,    // Strict bounds (no elastic drag)
  minZoom: 12,               // Prevents excessive zoom-out
  maxZoom: 18                // Prevents excessive zoom-in
}).setView([1.3521, 103.8198], 12); // Centered on Singapore

L.tileLayer('https://www.onemap.gov.sg/maps/tiles/Grey/{z}/{x}/{y}.png', {
  attribution:'<img src="https://www.onemap.gov.sg/web-assets/images/logo/om_logo.png" style="height:20px;width:20px;"/>&nbsp;<a href="https://www.onemap.gov.sg/" target="_blank" rel="noopener noreferrer">OneMap</a>&nbsp;&copy;&nbsp;contributors&nbsp;&#124;&nbsp;<a href="https://www.sla.gov.sg/" target="_blank" rel="noopener noreferrer">Singapore Land Authority</a>'
}).addTo(map);

// MRT line colors
const lineColors = {
  "Downtown Line": "#0072CE",
  "North East Line": "#9B26B6",
  "North South Line": "#D42E12",
  "Thomson East-Coast Line": "#9D5B25",
  "East West Line": "#009645",
  "Circle Line": "#FFDB58"
};

let allStations = [];
let allBusStops = [];
let busRoutes = [];
let busServices = [];
let allAttractions = [];
let allHawkers = [];
let busStopMarkers = L.layerGroup();
let attractionsLayer = L.layerGroup();
let hawkersLayer = L.layerGroup();
let hawkersVisible = false;
let radius400Circle = null;
let radius800Circle = null;
let currentSelectedMarker = null;
let nearbyBusStopsLayer = L.layerGroup();
let busStopToServices = {}; // Global variable to store bus stop to services mapping

const lineSelect = document.getElementById('mrt-line-select');
const busServiceSelect = document.getElementById('bus-service-select');
const attractionCategorySelect = document.getElementById('attraction-category-select');
const toggleHawkersBtn = document.getElementById('toggle-hawkers');
const sidebar = document.getElementById('sidebar');
const closeSidebarBtn = document.getElementById('close-sidebar');
const attractionDetails = document.getElementById('attraction-details');

lineSelect.disabled = true;
busServiceSelect.disabled = true;
attractionCategorySelect.disabled = true;

// Create cluster group with custom cluster color icon
let clusterGroup = L.markerClusterGroup({
  iconCreateFunction: (cluster) => {
    const count = cluster.getChildCount();
    const markers = cluster.getAllChildMarkers();

    // Get color from first marker
    let color = "#000000";
    if (markers.length > 0) {
      color = markers[0].options.color || "#000000";
    }

    return L.divIcon({
      html: `<div style="
        background-color: ${color};
        color: white;
        border: 2px solid white;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        box-shadow: 0 0 5px rgba(0,0,0,0.5);
      ">${count}</div>`,
      className: 'custom-cluster-icon',
      iconSize: [40, 40]
    });
  }
});

// Function to load JSON data with error handling
async function loadJSON(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading JSON:', error);
    return null;
  }
}

// Function to hide sidebar
function hideSidebar() {
  sidebar.classList.remove('active');
}

// Function to show attraction details in sidebar
function showAttractionDetails(attraction) {
  attractionDetails.innerHTML = `
    <h3>${attraction.PAGETITLE}</h3>
    <p><strong>Category:</strong> ${attraction.Category}</p>
    <p><strong>Address:</strong> ${attraction.Address}</p>
    <p><strong>Overview:</strong> ${attraction.OVERVIEW}</p>
    <p><strong>Website:</strong> <a href="https://${attraction.website}" target="_blank">${attraction.website}</a></p>
  `;
  sidebar.classList.add('active');
}

// Function to clear any existing radius circles and nearby bus stops
function clearRadiusAndNearbyStops() {
  if (radius400Circle) {
    map.removeLayer(radius400Circle);
    radius400Circle = null;
  }
  if (radius800Circle) {
    map.removeLayer(radius800Circle);
    radius800Circle = null;
  }
  nearbyBusStopsLayer.clearLayers();
  map.removeLayer(nearbyBusStopsLayer);
  if (currentSelectedMarker) {
    currentSelectedMarker.setZIndexOffset(0);
    currentSelectedMarker = null;
  }
}

// Function to create bus stop popup content
function createBusStopPopupContent(stop) {
  // Get all services for this stop
  const allServices = busStopToServices[stop.BusStopCode] || new Set();
  const servicesList = Array.from(allServices).sort((a, b) => 
    a.localeCompare(b, undefined, {numeric: true})
  );
  
  const servicesHtml = servicesList.join(', ');
  
  return `
    <strong>Bus Stop ${stop.BusStopCode}</strong><br>
    ${stop.Description}<br>
    ${stop.RoadName}<br>
    <strong>All Bus Services:</strong> ${servicesHtml}
  `;
}

// Function to show nearby bus stops within 800m radius
function showNearbyBusStops(lat, lng) {
  // Clear any existing nearby stops
  nearbyBusStopsLayer.clearLayers();
  map.removeLayer(nearbyBusStopsLayer);
  
  // Calculate distance for each bus stop
  const nearbyStops = allBusStops.filter(stop => {
    const distance = map.distance([lat, lng], [stop.Latitude, stop.Longitude]);
    return distance <= 800; // 800 meters (includes both 400m and 800m)
  });
  
  // Add markers for nearby stops
  nearbyStops.forEach(stop => {
    const marker = L.marker([stop.Latitude, stop.Longitude], {
      icon: new L.Icon({
        iconUrl: 'images/bus_icon.png',
        iconSize: [35, 35],
        iconAnchor: [12, 20],
        popupAnchor: [1, 1],
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        shadowSize: [20, 20]
      }),
      zIndexOffset: 1000 // Bring to front
    }).bindPopup(createBusStopPopupContent(stop));
    
    nearbyBusStopsLayer.addLayer(marker);
  });
  
  // Add the layer to the map
  map.addLayer(nearbyBusStopsLayer);
}

// Function to update attractions on map based on selected category
function updateAttractions(category) {
  attractionsLayer.clearLayers();
  
  const filteredAttractions = category ? 
    allAttractions.filter(attraction => attraction.Category === category) : 
    allAttractions;
  
  // Create custom icon
  const attractionIcon = L.icon({
    iconUrl: 'images/star_icon.png',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30]
  });
  
  filteredAttractions.forEach(attraction => {
    const marker = L.marker(
      [attraction.coordinates[1], attraction.coordinates[0]], 
      { icon: attractionIcon }
    ).on('click', (e) => {
      // Clear previous selections
      clearRadiusAndNearbyStops();
      
      // Set current marker
      currentSelectedMarker = e.target;
      currentSelectedMarker.setZIndexOffset(1000);
      
      // Show details in sidebar
      showAttractionDetails(attraction);
      
      // Create radius circles (400m and 800m)
      radius400Circle = L.circle([attraction.coordinates[1], attraction.coordinates[0]], {
        radius: 400,
        color: '#3388ff',
        fillColor: '#3388ff',
        fillOpacity: 0.3, // 30% opacity
        weight: 2
      }).addTo(map);
      
      radius800Circle = L.circle([attraction.coordinates[1], attraction.coordinates[0]], {
        radius: 800,
        color: '#3388ff',
        fillColor: '#3388ff',
        fillOpacity: 0.15, // 15% opacity
        weight: 2
      }).addTo(map);
      
      // Show nearby bus stops
      showNearbyBusStops(attraction.coordinates[1], attraction.coordinates[0]);
    });
    
    marker.bindPopup(`<strong>${attraction.PAGETITLE}</strong><br>${attraction.Category}`);
    attractionsLayer.addLayer(marker);
  });
  
  map.addLayer(attractionsLayer);
  
  // Zoom to bounds if there are markers
  if (filteredAttractions.length > 0) {
    const bounds = L.latLngBounds(filteredAttractions.map(a => 
      [a.coordinates[1], a.coordinates[0]]
    ));
    map.fitBounds(bounds, {
      padding: [50, 50],
      maxZoom: 15
    });
  }
}

// Function to toggle hawker centers
function toggleHawkers() {
  hawkersVisible = !hawkersVisible;
  
  if (hawkersVisible) {
    // Show hawkers
    toggleHawkersBtn.textContent = 'Hide Hawkers';
    loadHawkers();
  } else {
    // Hide hawkers
    toggleHawkersBtn.textContent = 'Show Hawkers';
    hawkersLayer.clearLayers();
    map.removeLayer(hawkersLayer);
    clearRadiusAndNearbyStops();
  }
}

// Function to load and display hawker centers
function loadHawkers() {
  hawkersLayer.clearLayers();
  
  // Create custom icon for hawkers
  const hawkerIcon = L.icon({
    iconUrl: 'images/food_icon.png',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30]
  });
  
  allHawkers.forEach(hawker => {
    const marker = L.marker(
      [hawker.Coordinates[0], hawker.Coordinates[1]], 
      { icon: hawkerIcon }
    ).on('click', (e) => {
      // Clear previous selections
      clearRadiusAndNearbyStops();
      
      // Set current marker
      currentSelectedMarker = e.target;
      currentSelectedMarker.setZIndexOffset(1000);
      
      // Show popup
      marker.bindPopup(`
        <strong>${hawker.Name}</strong><br>
        <p>${hawker.Address}</p>
        <p>${hawker.Description}</p>
      `).openPopup();
      
      // Create radius circles (400m and 800m)
      radius400Circle = L.circle([hawker.Coordinates[0], hawker.Coordinates[1]], {
        radius: 400,
        color: '#3388ff',
        fillColor: '#3388ff',
        fillOpacity: 0.3, // 30% opacity
        weight: 2
      }).addTo(map);
      
      radius800Circle = L.circle([hawker.Coordinates[0], hawker.Coordinates[1]], {
        radius: 800,
        color: '#3388ff',
        fillColor: '#3388ff',
        fillOpacity: 0.15, // 15% opacity
        weight: 2
      }).addTo(map);
      
      // Show nearby bus stops
      showNearbyBusStops(hawker.Coordinates[0], hawker.Coordinates[1]);
    });
    
    hawkersLayer.addLayer(marker);
  });
  
  map.addLayer(hawkersLayer);
}

// Load all data asynchronously
async function loadAllData() {
  try {
    // Load MRT data
    allStations = await loadJSON('data/cleaned_mrt_stations.json');
    if (lineSelect) lineSelect.disabled = false;
    
    // Load bus data
    const [busStopsData, busRoutesData] = await Promise.all([
      loadJSON('data/all-bus-stops.json'),
      loadJSON('data/all-bus-routes.json')
    ]);
    
    if (busStopsData && busRoutesData) {
      allBusStops = busStopsData;
      busRoutes = busRoutesData;
      
      // Create bus stop to services mapping
      busRoutes.forEach(route => {
        if (!busStopToServices[route.BusStopCode]) {
          busStopToServices[route.BusStopCode] = new Set();
        }
        busStopToServices[route.BusStopCode].add(route.ServiceNo);
      });
      
      // Extract unique bus services
      const uniqueServices = [...new Set(busRoutes.map(route => route.ServiceNo))].sort((a, b) => 
        a.localeCompare(b, undefined, {numeric: true})
      );
      
      // Populate bus service dropdown
      if (busServiceSelect) {
        uniqueServices.forEach(service => {
          const option = document.createElement('option');
          option.value = service;
          option.textContent = service;
          busServiceSelect.appendChild(option);
        });
        
        busServiceSelect.disabled = false;
      }
    }
    
    // Load attractions data
    const attractionsData = await loadJSON('data/attractions.json');
    if (attractionsData && attractionCategorySelect) {
      allAttractions = attractionsData;
      
      // Extract unique categories
      const uniqueCategories = [...new Set(attractionsData.map(attraction => attraction.Category))].sort();
      
      // Populate attraction category dropdown
      uniqueCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        attractionCategorySelect.appendChild(option);
      });
      
      // Add "All" option
      const allOption = document.createElement('option');
      allOption.value = "";
      allOption.textContent = "All Attractions";
      attractionCategorySelect.insertBefore(allOption, attractionCategorySelect.firstChild.nextSibling);
      
      attractionCategorySelect.disabled = false;
      
      // Show all attractions by default
      updateAttractions("");
    }
    
    // Load hawkers data
    const hawkersData = await loadJSON('data/hawker.json');
    if (hawkersData) {
      allHawkers = hawkersData;
      if (toggleHawkersBtn) {
        toggleHawkersBtn.disabled = false;
      }
    }
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

// Call the function to load all data
loadAllData();

// Event listeners
if (lineSelect) {
  lineSelect.addEventListener('change', () => {
    const selectedLine = lineSelect.value;

    // Clear previous markers
    clusterGroup.clearLayers();

    if (!selectedLine) {
      map.removeLayer(clusterGroup);
      return;
    }

    const filtered = allStations.filter(station =>
      station.line.includes(selectedLine)
    );

    // Group exits by station
    const stationGroups = {};
    filtered.forEach(station => {
      if (!stationGroups[station.station]) {
        stationGroups[station.station] = [];
      }
      stationGroups[station.station].push(station);
    });

    // Add markers directly to the cluster group
    Object.keys(stationGroups).forEach(stationName => {
      const exits = stationGroups[stationName];

      exits.forEach(exit => {
        const color = lineColors[selectedLine] || "#000000";

        const marker = L.circleMarker([exit.coordinates[1], exit.coordinates[0]], {
          radius: 15,
          color: color,
          fillColor: color,
          fillOpacity: 0.8,
          weight: 2
        }).on('click', () => {
          hideSidebar();
          marker.bindPopup(`<strong>${exit.station}</strong><br>${exit.exist}`).openPopup();
        });

        clusterGroup.addLayer(marker);
      });
    });

    map.addLayer(clusterGroup);

    // Zoom to bounds
    if (clusterGroup.getLayers().length > 0) {
      map.fitBounds(clusterGroup.getBounds(), {
        padding: [50, 50],
        maxZoom: 15
      });
    }
  });
}

// Bus service selection handler
if (busServiceSelect) {
  busServiceSelect.addEventListener('change', () => {
    const selectedService = busServiceSelect.value;
    
    // Clear previous bus stop markers
    busStopMarkers.clearLayers();
    map.removeLayer(busStopMarkers);
    
    if (!selectedService) return;
    
    // Get all bus stop codes for this service
    const stopCodesForService = busRoutes
      .filter(route => route.ServiceNo === selectedService)
      .map(route => route.BusStopCode);
    
    // Get unique stop codes (in case a stop appears multiple times in the route)
    const uniqueStopCodes = [...new Set(stopCodesForService)];
    
    // Find the bus stop details for these codes
    const stopsToShow = allBusStops.filter(stop => 
      uniqueStopCodes.includes(stop.BusStopCode)
    );
    
    // Add markers for each bus stop
    stopsToShow.forEach(stop => {
      const marker = L.marker([stop.Latitude, stop.Longitude], {
        icon: new L.Icon({
          iconUrl: 'images/bus_icon.png',
          iconSize: [35, 35],
          iconAnchor: [12, 20],
          popupAnchor: [1, 1],
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
          shadowSize: [20, 20]
        })
      }).on('click', () => {
        hideSidebar();
        marker.bindPopup(createBusStopPopupContent(stop)).openPopup();
      });
      
      busStopMarkers.addLayer(marker);
    });
    
    map.addLayer(busStopMarkers);
    
    // Zoom to bounds if there are markers
    if (busStopMarkers.getLayers().length > 0) {
      map.fitBounds(busStopMarkers.getBounds(), {
        padding: [50, 50],
        maxZoom: 15
      });
    }
  });
}

// Attraction category selection handler
if (attractionCategorySelect) {
  attractionCategorySelect.addEventListener('change', () => {
    const selectedCategory = attractionCategorySelect.value;
    updateAttractions(selectedCategory);
  });
}

// Toggle hawkers button handler
if (toggleHawkersBtn) {
  toggleHawkersBtn.addEventListener('click', toggleHawkers);
}

// Close sidebar handler
if (closeSidebarBtn) {
  closeSidebarBtn.addEventListener('click', hideSidebar);
}

// Reference the clear map button
const clearMapBtn = document.getElementById('clear-map');

// Handle clearing all markers and recentering the map
if (clearMapBtn) {
  clearMapBtn.addEventListener('click', () => {
    // Clear all marker layers
    clusterGroup.clearLayers();
    busStopMarkers.clearLayers();
    hawkersLayer.clearLayers();
    attractionsLayer.clearLayers();
    nearbyBusStopsLayer.clearLayers();
    clearRadiusAndNearbyStops();

    // Remove from map if present
    map.removeLayer(clusterGroup);
    map.removeLayer(busStopMarkers);
    map.removeLayer(hawkersLayer);
    map.removeLayer(attractionsLayer);
    map.removeLayer(nearbyBusStopsLayer);

    // Reset dropdowns
    lineSelect.selectedIndex = 0;
    busServiceSelect.selectedIndex = 0;
    attractionCategorySelect.selectedIndex = 0;

    // Reset hawkers toggle
    hawkersVisible = false;
    toggleHawkersBtn.textContent = 'Show Hawkers';

    // Recenter the map
    map.setView([1.3521, 103.8198], 12);
  });
}

// Click handler for the map to clear radius and nearby stops when clicking elsewhere
map.on('click', () => {
  clearRadiusAndNearbyStops();
});
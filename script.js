let map = L.map('map').setView([1.3521, 103.8198], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
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

const lineSelect = document.getElementById('mrt-line-select');
lineSelect.disabled = true; // Disable dropdown initially

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

fetch('data/cleaned_mrt_stations.json')
  .then(response => response.json())
  .then(data => {
    allStations = data;
    lineSelect.disabled = false; // Enable dropdown once data is ready
  });

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
      }).bindPopup(`<strong>${exit.station}</strong><br>Exit: ${exit.exist}`);


      

      
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

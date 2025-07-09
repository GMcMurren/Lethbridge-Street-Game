document.addEventListener('DOMContentLoaded', () => {
  const map = L.map('map', {
  minZoom: 11.5,
  maxZoom: 16,
  maxBounds: [[49.62, -113.05], [49.83, -112.65]],
  maxBoundsViscosity: 1.0
}).setView([49.7, -112.83], 13);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
  }).addTo(map);

  const allStreets = new Map();      // StreetOnly → [{ name, layer, length }]
  const guessedNames = new Map();    // name → [layers]
  const lengthPerName = new Map();   // name → total length for that name
  let totalLength = 0;
  let guessedLength = 0;

  fetch('Lethbridge_City.geojson')
    .then(res => res.json())
    .then(data => {
      L.geoJSON(data, {
        style: { color: "#666", weight: 1.05 },
        onEachFeature: (feature, layer) => {
          const streetOnly = String(feature.properties.StreetOnly || '').trim().toLowerCase();
          const name = String(feature.properties.name || '').trim();
          const length = feature.properties.Shape_Length || 0;

          if (!streetOnly || !name) return;

          totalLength += length;

          if (!allStreets.has(streetOnly)) allStreets.set(streetOnly, []);
          allStreets.get(streetOnly).push({ name, layer, length });

          lengthPerName.set(name, (lengthPerName.get(name) || 0) + length);

          // No tooltip bound here — bind only on guess
        },
        renderer: L.canvas()
      }).addTo(map);
      map.invalidateSize();
    });

  function updateProgress() {
    const percent = (guessedLength / totalLength) * 100;
    document.getElementById('progress').textContent =
      `${guessedNames.size} street names guessed! That's ${percent.toFixed(2)}% of the road network.`;
    document.getElementById('progress-bar').style.width = `${percent}%`;
  }

  function renderGuessedList() {
    const list = document.getElementById('guessed-list');
    list.innerHTML = '';
    const sorted = Array.from(guessedNames.keys()).sort();
    for (const name of sorted) {
      const item = document.createElement('li');
      item.textContent = name;
      item.className = 'guessed-street';
      item.addEventListener('click', () => {
        const group = L.featureGroup(guessedNames.get(name));
        map.fitBounds(group.getBounds().pad(0.2));
      });
      list.appendChild(item);
    }
  }

  document.getElementById('streetInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const input = String(e.target.value).trim().toLowerCase();
      if (!allStreets.has(input)) return;

      const matches = allStreets.get(input);
      matches.forEach(({ name, layer }) => {
        if (!guessedNames.has(name)) {
          guessedNames.set(name, []);
          guessedLength += lengthPerName.get(name) || 0;  // Add full length once per name
        }
        guessedNames.get(name).push(layer);
        layer.setStyle({ color: '#007700', weight: 3 });
        layer.bindTooltip(name, { direction: 'center' });
      });

      renderGuessedList();
      updateProgress();
      e.target.value = '';
    }
  });
});

document.addEventListener('DOMContentLoaded', () => {
  const map = L.map('map', {
    minZoom: 11.5,
    maxZoom: 16,
    maxBounds: [
      [49.62, -113.05],
      [49.83, -112.65]
    ],
    maxBoundsViscosity: 1.0
  }).setView([49.7, -112.83], 13);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
  }).addTo(map);

  const allStreets = new Map(); // streetOnly → [{name, layer, length}]
  const guessedNames = new Map(); // name → [layers]
  const seenLayers = new Set();   // layer IDs to avoid double-counting
  let totalLength = 0;
  let guessedLength = 0;

  let halfCongratsShown = false;
  let fullCongratsShown = false;

  fetch('Lethbridge_City.geojson')
    .then(res => res.json())
    .then(data => {
      L.geoJSON(data, {
        style: { color: "#444", weight: 1.05 },
        onEachFeature: (feature, layer) => {
          const streetOnly = String(feature.properties.StreetOnly || '').trim().toLowerCase();
          const name = String(feature.properties.name || '').trim();
          const length = feature.properties.Shape_Length || 0;

          if (!streetOnly || !name) return;

          totalLength += length;

          if (!allStreets.has(streetOnly)) allStreets.set(streetOnly, []);
          allStreets.get(streetOnly).push({ name, layer, length });
        },
        renderer: L.canvas()
      }).addTo(map);

      restoreProgress();
    });

  function updateProgress() {
    const percent = (guessedLength / totalLength) * 100;

    const progressText = document.getElementById('progress');
    const progressBar = document.getElementById('progress-bar');

    progressText.textContent = `${guessedNames.size} street names guessed! That's ${percent.toFixed(2)}% of the road network.`;
    progressBar.style.width = `${percent}%`;

    if (!halfCongratsShown && percent >= 50) {
      alert("🎉 You're halfway there! Keep going!");
      halfCongratsShown = true;
    }

    if (!fullCongratsShown && percent >= 100) {
      alert("🏆 Incredible! You’ve guessed the entire Lethbridge street network!");
      fullCongratsShown = true;
    }
  }

  function showProgressElements() {
    document.getElementById('progress-wrapper').style.display = 'block';
  }

  function addToGuessedList(name, layer) {
    const list = document.getElementById('guessed-list');
    const li = document.createElement('li');
    li.textContent = name;
    li.className = 'guessed-street';
    li.onclick = () => {
      map.fitBounds(layer.getBounds(), { maxZoom: 16 });
    };
    list.appendChild(li);
  }

  function saveProgress() {
    const guessedArray = Array.from(guessedNames.keys());
    localStorage.setItem('lethbridge_guessed', JSON.stringify(guessedArray));
  }

  function restoreProgress() {
    const saved = JSON.parse(localStorage.getItem('lethbridge_guessed') || '[]');

    for (const savedName of saved) {
      const normalized = savedName.toLowerCase();
      if (allStreets.has(normalized)) {
        const seenNames = new Set();

        for (const { name, layer, length } of allStreets.get(normalized)) {
          const layerId = L.Util.stamp(layer);
          if (!seenLayers.has(layerId)) {
            guessedLength += length;
            seenLayers.add(layerId);
          }

          if (!guessedNames.has(name)) guessedNames.set(name, []);
          guessedNames.get(name).push(layer);

          layer.setStyle({ color: "#007700", weight: 3 });
          layer.bindTooltip(name, { permanent: false, direction: "top" });

          if (!seenNames.has(name)) {
            addToGuessedList(name, layer);
            seenNames.add(name);
          }
        }
      }
    }

    if (guessedNames.size > 0) {
      showProgressElements();
      updateProgress();
    }
  }

  function resetProgress() {
    if (confirm("Are you sure you want to clear all progress?")) {
      localStorage.removeItem('lethbridge_guessed');
      location.reload();
    }
  }

  document.getElementById('streetInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const input = e.target.value.trim().toLowerCase();
      if (allStreets.has(input)) {
        let newGuess = false;
        const seenNames = new Set();

        for (const { name, layer, length } of allStreets.get(input)) {
          const layerId = L.Util.stamp(layer);
          if (!seenLayers.has(layerId)) {
            guessedLength += length;
            seenLayers.add(layerId);
          }

          if (!guessedNames.has(name)) {
            guessedNames.set(name, []);
            newGuess = true;
          }

          guessedNames.get(name).push(layer);
          layer.setStyle({ color: "#007700", weight: 3 });
          layer.bindTooltip(name, { permanent: false, direction: "top" });

          if (!seenNames.has(name)) {
            addToGuessedList(name, layer);
            seenNames.add(name);
          }
        }
        if (newGuess) {
          const wrapper = document.getElementById('progress-wrapper'); 
          if (wrapper.style.display === 'none') {
            showProgressElements();
          }
          updateProgress();
          saveProgress();
        }
      }

      e.target.value = '';
    }
  });

  // Make resetProgress callable from the HTML
  window.resetProgress = resetProgress;
});

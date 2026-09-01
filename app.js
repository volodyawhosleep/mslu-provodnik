const $ = (id) => document.getElementById(id);
const state = { data: null, building: null, floor: null, q: '' };

function floorTitle(building, floorId) {
  const f = building.floors.find((x) => String(x.id) === String(floorId));
  if (!f) return `Этаж ${floorId}`;
  return f.label;
}

function show(view) {
  ['homeView', 'buildingView', 'mapView', 'resultsView'].forEach((id) => {
    $(id).classList.toggle('hidden', id !== view);
  });
  $('backBtn').classList.toggle('hidden', view === 'homeView' && !$('search').value);
}

function setTitle(text) { $('pageTitle').textContent = text; }

function renderHome() {
  setTitle('Проводник');
  show('homeView');
  $('homeView').innerHTML = state.data.buildings.map((b) => `
    <button class="card" data-open="${b.id}">
      <div class="row">
        <div>
          <strong>${b.title}</strong>
          <span>${b.hint} · ${b.floors.length} этаж(а/ей)</span>
        </div>
        <span class="badge">${b.roomsCount} помещений</span>
      </div>
    </button>
  `).join('');
  $('homeView').querySelectorAll('[data-open]').forEach((btn) => {
    btn.onclick = () => openBuilding(btn.dataset.open);
  });
}

function openBuilding(id) {
  state.building = state.data.buildings.find((b) => b.id === id);
  state.floor = state.building.floors[0];
  setTitle(state.building.short);
  show('buildingView');
  const rooms = state.data.rooms.filter((r) => r.building === id);
  $('buildingView').innerHTML = `
    <div class="chips">
      ${state.building.floors.map((f) => `<button class="chip" data-floor="${f.id}">${f.label}</button>`).join('')}
    </div>
    <button class="card" id="openPlan">
      <strong>Открыть план этажа</strong>
      <span>Сначала выбран ${state.building.floors[0].label.toLowerCase()}</span>
    </button>
    ${rooms.slice(0, 40).map(roomCard).join('')}
    ${rooms.length > 40 ? `<p class="fine">Показаны первые 40 помещений. Остальные ищите через строку сверху.</p>` : ''}
  `;
  $('buildingView').querySelectorAll('[data-floor]').forEach((chip) => {
    chip.onclick = () => openMap(id, chip.dataset.floor);
  });
  $('openPlan').onclick = () => openMap(id, state.building.floors[0].id);
  $('buildingView').querySelectorAll('[data-room]').forEach(bindRoom);
}

function roomCard(r) {
  const b = state.data.buildings.find((x) => x.id === r.building);
  return `<button class="card" data-room="${r.building}|${r.floor}|${encodeURIComponent(r.label)}">
    <div class="row">
      <div>
        <div class="room-label">${r.label}</div>
        <div class="room-path">${b.short} · ${floorTitle(b, r.floor)}</div>
      </div>
    </div>
  </button>`;
}

function bindRoom(btn) {
  btn.onclick = () => {
    const [building, floor] = btn.dataset.room.split('|');
    openMap(building, floor, true);
  };
}

function openMap(buildingId, floorId, fromSearch) {
  state.building = state.data.buildings.find((b) => b.id === buildingId);
  state.floor = state.building.floors.find((f) => String(f.id) === String(floorId)) || state.building.floors[0];
  setTitle(state.building.short);
  show('mapView');
  $('mapMeta').textContent = `${state.building.title} · ${state.floor.label}`;
  $('floorChips').innerHTML = state.building.floors.map((f) =>
    `<button class="chip ${String(f.id) === String(state.floor.id) ? 'active' : ''}" data-floor="${f.id}">${f.label}</button>`
  ).join('');
  $('floorChips').querySelectorAll('[data-floor]').forEach((chip) => {
    chip.onclick = () => openMap(buildingId, chip.dataset.floor);
  });
  const img = $('plan');
  img.alt = `${state.building.title}, ${state.floor.label}`;
  img.src = `./${state.floor.file}`;
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    // runtime cache happens in sw on fetch
  }
}

function search(q) {
  state.q = q.trim().toLowerCase();
  if (!state.q) {
    renderHome();
    $('backBtn').classList.add('hidden');
    return;
  }
  setTitle('Поиск');
  show('resultsView');
  const hits = state.data.rooms.filter((r) => {
    const b = state.data.buildings.find((x) => x.id === r.building);
    const hay = `${r.label} ${r.id} ${b.title} ${b.short}`.toLowerCase();
    return hay.includes(state.q);
  });
  $('resultsView').innerHTML = hits.length
    ? hits.slice(0, 80).map(roomCard).join('')
    : `<div class="empty">Аудитория не найдена.<br>Попробуйте номер целиком — например, 308.</div>`;
  $('resultsView').querySelectorAll('[data-room]').forEach(bindRoom);
}

function setupInstallHint() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (ios && !standalone && !localStorage.getItem('hideHint')) {
    $('installHint').classList.remove('hidden');
  }
  $('dismissHint').onclick = () => {
    localStorage.setItem('hideHint', '1');
    $('installHint').classList.add('hidden');
  };
}

$('backBtn').onclick = () => {
  $('search').value = '';
  state.q = '';
  renderHome();
};

$('search').addEventListener('input', (e) => search(e.target.value));

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

fetch('./data.json')
  .then((r) => r.json())
  .then((data) => {
    data.buildings.forEach((b) => {
      b.roomsCount = data.rooms.filter((r) => r.building === b.id).length;
    });
    state.data = data;
    setupInstallHint();
    renderHome();
  })
  .catch(() => {
    $('homeView').innerHTML = '<div class="empty">Не удалось загрузить каталог. Нужен интернет для первого запуска.</div>';
  });

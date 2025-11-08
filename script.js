// ==================== Configuration ====================
const BAR_WIDTH = 0.05;
const SPACING = 0.08;
const CHART_BASE_Y = 0.15;
const MAX_HEIGHT = 0.8;
const CHART_DISTANCE = 1.2;
const CHART_HEIGHT_OFFSET = 0.3;

// ==================== DOM Elements ====================
const scene = document.querySelector('#modelGroup');
const controlPanel = document.getElementById('controlPanel');
const panelHeader = document.getElementById('panelHeader');
const nSlider = document.getElementById('nSlider');
const pSlider = document.getElementById('pSlider');
const nValue = document.getElementById('nValue');
const pValue = document.getElementById('pValue');
const modeBtn = document.getElementById('modeBtn');
const nContainer = document.querySelectorAll('.slider-container')[0];
const pContainer = document.querySelectorAll('.slider-container')[1];
const pLabel = pContainer.querySelector('.slider-label');

let currentMode = 'binomial';
let currentN = 10, currentP = 0.50, currentLambda = 5.0;
let lastN = 10, lastP = 0.50, lastLambda = 5.0;

// ==================== Panel Toggle ====================
let clickCount = 0;
panelHeader.addEventListener('click', () => {
  clickCount++;
  setTimeout(() => {
    if (clickCount === 1) {
      controlPanel.classList.toggle('collapsed');
      controlPanel.classList.toggle('expanded');
    }
    clickCount = 0;
  }, 300);
});

// ==================== Drag Only ====================
AFRAME.registerComponent('drag-only', {
  init: function () {
    const el = this.el;
    let startX, startZ, isDragging = false;

    el.addEventListener('gesturestart', e => {
      if (e.detail.touches === 1) {
        const pos = el.object3D.position;
        startX = pos.x; startZ = pos.z;
        isDragging = true;
        document.body.classList.add('ui-dragging');
      }
    });

    el.addEventListener('gesturechange', e => {
      if (isDragging && e.detail.touches === 1) {
        const delta = e.detail.delta;
        el.object3D.position.x = startX + delta.x * 0.001;
        el.object3D.position.z = startZ + delta.z * 0.001;
      }
    });

    el.addEventListener('gestureend', () => {
      isDragging = false;
      document.body.classList.remove('ui-dragging');
    });
  }
});

// ==================== Camera Follow ====================
AFRAME.registerComponent('camera-follow', {
  tick: function () {
    const el = this.el;
    const camera = this.el.sceneEl.camera;
    if (!camera) return;

    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(camera.quaternion);
    forward.multiplyScalar(CHART_DISTANCE);

    const targetPos = new THREE.Vector3();
    targetPos.copy(camera.position);
    targetPos.add(forward);
    targetPos.y += CHART_HEIGHT_OFFSET;

    el.object3D.position.lerp(targetPos, 0.1);

    const lookAtPos = new THREE.Vector3(camera.position.x, el.object3D.position.y, camera.position.z);
    el.object3D.lookAt(lookAtPos);
  }
});

// ==================== Math Functions ====================
function C(n, k) {
  if (k < 0 || k > n) return 0;
  let res = 1;
  for (let i = 1; i <= k; ++i) res = res * (n - i + 1) / i;
  return Math.round(res * 100000) / 100000;
}

function binomialData(n, p) {
  const data = [];
  for (let k = 0; k <= n; ++k) {
    const pk = C(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
    data.push({ k, pk });
  }
  return data;
}

function poissonData(lambda) {
  if (lambda <= 0) return [{ k: 0, pk: 1 }];
  const data = [];
  let pk = Math.exp(-lambda);
  let cumProb = pk;
  data.push({ k: 0, pk });
  let k = 1;
  while (cumProb < 0.999 || pk > 1e-5) {
    pk = pk * lambda / k;
    data.push({ k, pk });
    cumProb += pk;
    k++;
    if (k > lambda + 50) break;
  }
  return data;
}

// ==================== Draw Chart ====================
function drawChart() {
  while (scene.firstChild) scene.removeChild(scene.firstChild);

  const data = currentMode === 'binomial'
    ? binomialData(currentN, currentP)
    : poissonData(currentLambda);

  const mean = currentMode === 'binomial' ? currentN * currentP : currentLambda;
  const maxProb = data.reduce((m, d) => Math.max(m, d.pk), 0) || 1;
  const scaleY = MAX_HEIGHT / maxProb;

  data.forEach(d => {
    if (d.pk < 1e-8) return;
    const height = Math.max(d.pk * scaleY, 0.001);
    const xPos = (d.k - mean) * SPACING;

    // Bar
    const bar = document.createElement('a-box');
    bar.setAttribute('position', `${xPos} ${CHART_BASE_Y + height / 2} 0`);
    bar.setAttribute('width', BAR_WIDTH);
    bar.setAttribute('depth', BAR_WIDTH);
    bar.setAttribute('height', height);
    bar.setAttribute('color', '#4a90e2');
    bar.setAttribute('class', 'clickable');
    bar.setAttribute('data-k', d.k);
    bar.setAttribute('data-pk', d.pk.toFixed(6));
    scene.appendChild(bar);

    // Label
    const label = document.createElement('a-text');
    label.setAttribute('value', d.k);
    label.setAttribute('position', `${xPos} ${CHART_BASE_Y - 0.03} 0`);
    label.setAttribute('rotation', '-90 0 0');
    label.setAttribute('scale', '0.2 0.2 0.2');
    label.setAttribute('color', '#fff');
    label.setAttribute('align', 'center');
    scene.appendChild(label);
  });

  // Ground Plane
  const groundWidth = (data.length - 1) * SPACING + BAR_WIDTH + 0.1;
  const ground = document.createElement('a-plane');
  ground.setAttribute('position', `0 ${CHART_BASE_Y} 0`);
  ground.setAttribute('rotation', '-90 0 0');
  ground.setAttribute('width', groundWidth);
  ground.setAttribute('depth', 1.2);
  ground.setAttribute('color', '#333');
  ground.setAttribute('opacity', '0.8');
  ground.setAttribute('transparent', 'true');
  scene.appendChild(ground);
}

// ==================== Update Chart ====================
function updateChart() { drawChart(); }

// ==================== Sliders ====================
nSlider.addEventListener('input', () => {
  currentN = +nSlider.value;
  nValue.textContent = currentN;
  updateChart();
});

pSlider.addEventListener('input', () => {
  const val = parseFloat(pSlider.value);
  if (currentMode === 'binomial') currentP = val;
  else currentLambda = val;
  pValue.textContent = val.toFixed(2);
  updateChart();
});

// ==================== Mode Switch ====================
modeBtn.addEventListener('click', () => {
  if (currentMode === 'binomial') {
    lastN = currentN; lastP = currentP;
    currentMode = 'poisson';
    modeBtn.textContent = 'Switch to Binomial';
    nContainer.style.display = 'none';
    pSlider.min = '0.1'; pSlider.max = '30'; pSlider.step = '0.1';
    pSlider.value = lastLambda; currentLambda = lastLambda;
    pLabel.innerHTML = `λ (mean): <span class="slider-value">${lastLambda.toFixed(2)}</span>`;
  } else {
    lastLambda = currentLambda;
    currentMode = 'binomial';
    modeBtn.textContent = 'Switch to Poisson';
    nContainer.style.display = 'block';
    pSlider.min = '0'; pSlider.max = '1'; pSlider.step = '0.01';
    pSlider.value = lastP; currentN = lastN;
    nSlider.value = currentN; nValue.textContent = currentN;
    pLabel.innerHTML = `p (probability): <span class="slider-value">${lastP.toFixed(2)}</span>`;
  }
  updateChart();
});

// ==================== Click for Probability ====================
scene.addEventListener('click', e => {
  if (e.target.classList.contains('clickable')) {
    const k = e.target.getAttribute('data-k');
    const pk = e.target.getAttribute('data-pk');
    alert(`P(X=${k}) = ${pk}`);
  }
});

// ==================== Initialize ====================
window.onload = () => {
  setTimeout(drawChart, 1500);
};

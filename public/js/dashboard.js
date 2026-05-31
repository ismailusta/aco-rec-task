const API = '';

function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const token = window.APP_CONFIG?.apiToken;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function showApiError(message) {
  const banner = document.getElementById('errorBanner');
  const text = document.getElementById('errorBannerText');
  text.textContent = message;
  banner.classList.remove('hidden');
}

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error?.detail || response.statusText;
    showApiError(`API hatasi: ${message}`);
    throw new Error(message);
  }
  return data;
}

const sampleReceipt = {
  machineId: 'ACO-TEST-0001-0001',
  rewardType: 'Aco Recycling Default Reward',
  totalReward: 3.0,
  currency: 'TRY',
  items: [
    { product: 'Glass', quantity: 0, reward: 0 },
    { product: 'Plastic', quantity: 2, reward: 2 },
    { product: 'Metal', quantity: 1, reward: 1 },
    { product: 'Tetrapak', quantity: 0, reward: 0 },
  ],
  qrPayload: 'voucher-001',
};

let lastErrorCode = null;

function setConnectionIndicator(connection) {
  const el = document.getElementById('connectionIndicator');
  const label = document.getElementById('connectionLabel');
  const status = connection?.status || 'disconnected';
  const mode = connection?.mode ? connection.mode.toUpperCase() : 'NONE';

  el.className = `connection-indicator ${status}`;
  label.textContent = `${mode} · ${status}`;
}

function showErrorBanner(error, message) {
  const banner = document.getElementById('errorBanner');
  const text = document.getElementById('errorBannerText');

  if (!error?.code) {
    return;
  }

  if (error.code === lastErrorCode) {
    return;
  }

  lastErrorCode = error.code;
  text.textContent = message || error.detail || error.code;
  banner.classList.remove('hidden');
}

function renderHardware(status) {
  const dl = document.getElementById('hardwareStatus');
  dl.innerHTML = `
    <dt>Paper</dt><dd>${status.hardware.paper}</dd>
    <dt>Cover</dt><dd>${status.hardware.cover}</dd>
    <dt>Temperature</dt><dd>${status.hardware.temperature}</dd>
    <dt>Paper roll</dt><dd>${status.paperRollPercent}%</dd>
    <dt>ETA</dt><dd>${status.etaMs} ms</dd>
    <dt>Last job</dt><dd>${status.lastJob?.jobId || '-'}</dd>
  `;
}

function renderQueue(status) {
  document.getElementById('queueSummary').innerHTML = `
    <span>Pending: ${status.queue.pending}</span>
    <span>Processing: ${status.queue.processing}</span>
    <span>Completed: ${status.queue.completed}</span>
    <span>Failed: ${status.queue.failed}</span>
  `;

  const tbody = document.getElementById('queueBody');
  tbody.innerHTML = (status.jobs || [])
    .map(
      (job) => `
      <tr>
        <td>${job.jobId}</td>
        <td>${job.type}</td>
        <td>${job.status}</td>
        <td>${job.error?.code || '-'}</td>
        <td>
          ${
            job.status === 'failed'
              ? `<button data-reprint="${job.jobId}" type="button">Tekrar Bastır</button>`
              : '-'
          }
        </td>
      </tr>`,
    )
    .join('');

  tbody.querySelectorAll('[data-reprint]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await api('/reprint', {
          method: 'POST',
          body: JSON.stringify({ jobId: button.dataset.reprint }),
        });
        await refresh();
      } catch {
        // error shown in banner
      }
    });
  });
}

function renderFailedJobs(failedJobs) {
  const container = document.getElementById('failedJobs');
  if (!failedJobs?.length) {
    container.innerHTML = '<p class="meta">No failed jobs</p>';
    return;
  }

  container.innerHTML = failedJobs
    .map(
      (job) => `
      <div class="failed-card">
        ${
          job.previewUrl
            ? `<img src="${job.previewUrl}" alt="Failed print preview" />`
            : ''
        }
        <div class="meta">${job.jobId}</div>
        <div class="meta">${job.error?.code || ''}</div>
        <button data-reprint="${job.jobId}" type="button">Tekrar Bastır</button>
      </div>`,
    )
    .join('');

  container.querySelectorAll('[data-reprint]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await api('/reprint', {
          method: 'POST',
          body: JSON.stringify({ jobId: button.dataset.reprint }),
        });
        await refresh();
      } catch {
        // error shown in banner
      }
    });
  });
}

async function renderLogs() {
  const logs = await api('/logs');
  const terminal = document.getElementById('logTerminal');
  terminal.textContent = logs
    .slice(-30)
    .map((entry) => JSON.stringify(entry))
    .join('\n');
  terminal.scrollTop = terminal.scrollHeight;
}

async function refresh() {
  try {
    const status = await api('/status');
    setConnectionIndicator(status.connection);
    showErrorBanner(status.lastError, status.lastErrorMessage);
    renderHardware(status);
    renderQueue(status);
    renderFailedJobs(status.failedJobs);
    await renderLogs();
  } catch (error) {
    console.error(error);
  }
}

async function runAction(action) {
  try {
    await action();
    await refresh();
  } catch {
    // error shown in banner
  }
}

document.getElementById('connectUsb').addEventListener('click', () =>
  runAction(() =>
    api('/connect', {
      method: 'POST',
      body: JSON.stringify({ mode: 'usb' }),
    }),
  ),
);

document.getElementById('connectLan').addEventListener('click', () =>
  runAction(() =>
    api('/connect', {
      method: 'POST',
      body: JSON.stringify({ mode: 'lan' }),
    }),
  ),
);

document.getElementById('simulateJam').addEventListener('click', () =>
  runAction(() =>
    api('/simulate/error', {
      method: 'POST',
      body: JSON.stringify({ code: 'PAPER_JAM' }),
    }),
  ),
);

document.getElementById('clearError').addEventListener('click', () =>
  runAction(() => api('/simulate/clear', { method: 'POST', body: '{}' })),
);

document.getElementById('dismissBanner').addEventListener('click', () => {
  document.getElementById('errorBanner').classList.add('hidden');
});

document.getElementById('printTextForm').addEventListener('submit', (event) => {
  event.preventDefault();
  runAction(() =>
    api('/print/text', {
      method: 'POST',
      body: JSON.stringify({
        text: document.getElementById('printText').value,
        lang: document.getElementById('printLang').value,
        jobId: `text-${Date.now()}`,
      }),
    }),
  );
});

document.getElementById('printReceipt').addEventListener('click', () =>
  runAction(() =>
    api('/print/text', {
      method: 'POST',
      body: JSON.stringify({
        jobId: `receipt-${Date.now()}`,
        lang: document.getElementById('printLang').value,
        receipt: sampleReceipt,
      }),
    }),
  ),
);

document.getElementById('printVoucher').addEventListener('click', () =>
  runAction(async () => {
    const response = await fetch('/samples/voucher.png');
    const blob = await response.blob();
    const base64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });

    await api('/print/image', {
      method: 'POST',
      body: JSON.stringify({
        jobId: `voucher-${Date.now()}`,
        imageBase64: base64,
      }),
    });
  }),
);

refresh();
setInterval(refresh, 2000);

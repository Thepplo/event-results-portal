const WORKER_BASE = "https://gentle-darkness-f7c5.theo-4e3.workers.dev";

const DONUT_TASK_IDS = [
  "Tj4VO5V_f",
  "teu-Hoocx",
  "hynVN5lkv",
  "dbO09epte",
];

const MIXED_TASK_ID = "c7CRRaGrZ";


const INCLUDED_TASK_IDS = new Set([
  "Tj4VO5V_f",
  "teu-Hoocx",
  "hynVN5lkv",
  "dbO09epte",
]);

const TASK_OPTION_LABELS = {
  "Tj4VO5V_f": {
    0: "Was there a brief?",
    1: "Unlock all Modules",
    2: "I don't know",
    3: "Unlock all my allotted Modules",
  },

  "teu-Hoocx": {
    0: "I didn't have a specific strategy",
    1: "Just going and getting the job done",
    2: "We had clear roles & procedures",
    3: "We agreed on policies and how to attack the problem",
    4: "We did an analysis on the main probem we needed to crack",
  },

  
  "hynVN5lkv": {
    0: "We had a clear set of actions",
    1: "We agreed on clear roles",
    2: "We consistently executed what we decided",
    3: "We started in one direction but lost it quickly",
    4: "We nailed it",
  },

  "dbO09epte": {
    0: "1",
    1: "2",
    2: "3",
    3: "4",
    4: "5",
  },
};
const TASK_LABELS = { 
  "Tj4VO5V_f": "What was your goal based on the brief?",
  "teu-Hoocx": "What was your strategy?",
  "hynVN5lkv": "How well did you execute the strategy?",
  "dbO09epte": "How would you score your team's communication during the mission (1-5)?",
  "c7CRRaGrZ": "How satisfied are you with the overall outcome of your team (1-5)?"

 };

const CHART_COLORS = [
  "#2d52b5",
  "#f4c430",
  "#e53846",
  "#3e95eb",
  "#770136",
];

function decodeOption(taskId, raw) {
  const map = TASK_OPTION_LABELS[taskId];
  if (!map) return String(raw);

  const key = String(raw).trim();

  if (map[key] != null) return map[key];
  if (map[Number(key)] != null) return map[Number(key)];

  return key;
}

function normalizeAnswerToOptions(taskId, answer) {
  if (answer === null || answer === undefined) return [];

  if (Array.isArray(answer)) return answer.map(v => decodeOption(taskId, v));

  const s = String(answer).trim();
  if (s.startsWith("[") && s.endsWith("]")) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map(v => decodeOption(taskId, v));
    } catch {}
  }

  return [decodeOption(taskId, s)];
}


function createBarGradient(ctx, color) {
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, lighten(color, 0.6));
  gradient.addColorStop(1, color);
  return gradient;
}

function lighten(hex, amount) {
  const num = parseInt(hex.replace("#",""), 16);
  let r = (num >> 16) + Math.round(255 * amount);
  let g = ((num >> 8) & 0x00FF) + Math.round(255 * amount);
  let b = (num & 0x0000FF) + Math.round(255 * amount);
  r = Math.min(255, r);
  g = Math.min(255, g);
  b = Math.min(255, b);
  return `rgb(${r},${g},${b})`;
}
/* 
function normalizeAnswerToOptions(answer) {
  if (answer === null || answer === undefined) return [];

  if (Array.isArray(answer)) {
    return answer.map(v => String(v).trim()).filter(Boolean);
  }

  if (typeof answer === "number" || typeof answer === "boolean") {
    return [String(answer)];
  }

  const s = String(answer).trim();
  if (!s) return [];

  if (s.startsWith("[") && s.endsWith("]")) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) {
        return parsed.map(v => String(v).trim()).filter(Boolean);
      }
    } catch {
    }
  }

  if (s.includes(",")) {
    const parts = s.split(",").map(p => p.trim()).filter(Boolean);
    if (parts.length > 1) return parts;
  }

  return [s];
} */
function aggregateOptionsByTask(teams, taskIdsSet) {
  const agg = new Map();

  for (const team of teams) {
    for (const a of (team.answers || [])) {
      if (!a.taskId) continue;
      if (taskIdsSet && taskIdsSet.size && !taskIdsSet.has(a.taskId)) continue;

      const opts = normalizeAnswerToOptions(a.taskId, a.answer);

      if (!agg.has(a.taskId)) agg.set(a.taskId, new Map());
      const map = agg.get(a.taskId);

      for (const optLabel of opts) {
        map.set(optLabel, (map.get(optLabel) || 0) + 1);
      }
    }
  }
  return agg;
}

function buildBarRowsFromAnswersScore(teams) {
  return teams.map(t => ({
    teamId: t.id,
    teamName: t.name || t.members?.[0] || "Team",
    score: Number(t.answersScore) || 0,
  }));
}

function collectAllTaskIds(teams) {
  const set = new Set();
  for (const t of teams) {
    for (const a of (t.answers || [])) {
      if (a.taskId) set.add(a.taskId);
    }
  }
  return set;
}

function deriveRestTaskIdSet(teams) {
  const all = collectAllTaskIds(teams);
  for (const id of DONUT_TASK_IDS) all.delete(id);
  all.delete(MIXED_TASK_ID);
  return all;
}

function computeCorrectCountPerTeam(teams, restTaskIdsSet) {
  return teams.map(t => {
    const correct = (t.answers || []).reduce((sum, a) => {
      if (!a.taskId) return sum;
      if (!restTaskIdsSet.has(a.taskId)) return sum;
      return sum + (a.correct === true ? 1 : 0);
    }, 0);

    return {
      teamId: t.id,
      teamName: t.name || t.members?.[0] || "Team",
      correctCount: correct,
    };
  });
}

function parseRatingAndWordFromString(answer) {
  const s = String(answer ?? "").trim();
  if (!s) return { rating: null, word: "" };

  const m = s.match(/^(\d+)\s*(.*)$/);
  if (!m) return { rating: null, word: s };

  const rating = parseInt(m[1], 10);
  const word = (m[2] || "").trim();

  return {
    rating: Number.isFinite(rating) ? rating : null,
    word,
  };
}

function aggregateMixedTask(teams) {
  const ratingCounts = new Map([[1,0],[2,0],[3,0],[4,0],[5,0]]);
  const wordCounts = new Map();

  for (const t of teams) {
    const a = (t.answers || []).find(x => x.taskId === MIXED_TASK_ID);
    if (!a) continue;

    const { rating, word } = parseRatingAndWordFromString(a.answer);

    if (ratingCounts.has(rating)) {
      ratingCounts.set(rating, ratingCounts.get(rating) + 1);
    }

    const cleaned = (word || "")
      .toLowerCase()
      .trim()
      .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

    if (cleaned) wordCounts.set(cleaned, (wordCounts.get(cleaned) || 0) + 1);
  }

  return { ratingCounts, wordCounts };
}
function drawAnswersScoreBarChart(teams) {
  const el = document.getElementById("barCorrect");
  if (!el) return;

  const rows = buildBarRowsFromAnswersScore(teams).sort((a,b) => b.score - a.score);
  const ctx = el.getContext("2d");
  new Chart(el, {
    type: "bar",
    data: {
      labels: rows.map(r => r.teamName),
      datasets: [{
        label: "Score (scored tasks)",
        data: rows.map(r => r.score),
        backgroundColor: rows.map((r, i) =>
          i === 0 ? "#f4c430" : "#2d52b5"
        ),
        borderColor: "#4A4046",
        borderWidth: 1,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } },
        x: {
          ticks: {
            color: "#F3EDEE",
            font: { size: 13, weight: "600", family: "Montserrat, sans-serif" },
          }
        }
      }
    }
  });
}
function drawSatisfactionChart(ratingCounts) {
  const el = document.getElementById("satChart");
  if (!el) return;

  const labels = [1,2,3,4,5].map(String);
  const values = [1,2,3,4,5].map(k => ratingCounts.get(k) || 0);

  new Chart(el, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Satisfaction (1–5)",
        data: values,
        backgroundColor: labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
        borderColor: "#4A4046",
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } }
      }
    }
  });
}
function drawWordCloud(wordCounts, topN = 30) {
  const el = document.getElementById("wordCloudCanvas");
  if (!el) return;
  const FIXED_H = Number(el.getAttribute("height")) || 500;
  el.style.height = `${FIXED_H}px`;
  el.style.maxHeight = `${FIXED_H}px`;
  el.style.display = "block";

  const pairs = Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN);

  const labels = pairs.map(p => p[0]);
  const data = pairs.map(p => p[1]);

  new Chart(el.getContext("2d"), {
    type: "wordCloud",
    data: {
      labels,
      datasets: [{
        label: "Experience words",
        data,
        color: "#ffffff",
        minRotation: -90,
        maxRotation: 0,
        rotationSteps: 2,
        padding: 1,
      }],
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      layout: { padding: 8 },
    },
  });

}
function renderDonutCharts (teams) {
  const donutAgg = aggregateOptionsByTask(teams, new Set(DONUT_TASK_IDS));

  if (!donutAgg.size) {
    return `<div class="card"><h3>Survey Charts</h3><p class="muted">No answers found for selected tasks.</p></div>`;
  }

  const blocks = [];
  for (const [taskId, optionMap] of donutAgg.entries()) {
    const canvasId = `chart_${taskId.replace(/[^a-zA-Z0-9_]/g, "_")}`;
    blocks.push(`
      <div class="donut-card">
        <h3>${TASK_LABELS[taskId] || taskId}</h3>
        <div style="max-width:700px;">
          <canvas id="${canvasId}" height="260"></canvas>
        </div>
        <div class="muted" style="margin-top:8px;">
          ${Array.from(optionMap.entries())
            .sort((a,b)=>b[1]-a[1])
            .map(([opt,count]) => `<div>${escapeHtml(opt)} - <b>${count}</b></div>`)
            .join("")}
        </div>
      </div>
    `);
  }


  return `
  <div class="donut-grid">
    ${blocks.join("")}
  </div>
`;
}

function drawDonutCharts(teams, taskIds) {
  const taskAgg = aggregateOptionsByTask(teams, taskIds);

  for (const [taskId, optionMap] of taskAgg.entries()) {
    const canvasId = `chart_${taskId.replace(/[^a-zA-Z0-9_]/g, "_")}`;
    const el = document.getElementById(canvasId);
    if (!el) continue;

    const labels = Array.from(optionMap.keys());
    const values = labels.map(l => optionMap.get(l));

    const MAX_SLICES = 10;
    let finalLabels = labels;
    let finalValues = values;

    if (labels.length > MAX_SLICES) {
      const pairs = labels.map((l,i)=>({ label:l, value:values[i] }))
                          .sort((a,b)=>b.value-a.value);

      const top = pairs.slice(0, MAX_SLICES - 1);
      const rest = pairs.slice(MAX_SLICES - 1);
      const otherSum = rest.reduce((s,p)=>s+p.value,0);

      finalLabels = top.map(p=>p.label).concat(["Other"]);
      finalValues = top.map(p=>p.value).concat([otherSum]);
    }

    new Chart(el, {
      type: "doughnut",
      data: {
        labels: finalLabels,
        datasets: [{
          data: finalValues,

          backgroundColor: finalLabels.map((_, i) =>
            CHART_COLORS[i % CHART_COLORS.length]
          ),

          borderColor: "#4A4046",
          borderWidth: 1,

          hoverOffset: 2
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          datalabels: {
            color: "#ffffff",
            textShadowColor: "rgba(0,0,0,0.4)",
            textShadowBlur: 4,
            font: {
              weight: "600",
              size: 14
            },
          formatter: (value, context) => {
            const data = context.chart.data.datasets[0].data;
            const total = data.reduce((a,b)=>a+b,0);
            const percentage = total ? (value / total) * 100 : 0;
            return percentage > 5 ? percentage.toFixed(0) + "%" : "";
          }
          },
          tooltip: {

            callbacks: {
              label: (ctx) => {
                const total = ctx.dataset.data.reduce((a,b)=>a+b,0);
                const v = ctx.parsed;
                const pct = total ? Math.round((v/total)*100) : 0;
                return `${ctx.label}: ${v} (${pct}%)`;
              }
            }
          }
        }
      },
      plugins: [ChartDataLabels]
    });
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function qs() {
  return new URLSearchParams(location.search);
}

function setQueryParams(params) {
  const url = new URL(location.href);
  Object.entries(params).forEach(([k, v]) => {
    if (v === null || v === undefined || v === "") url.searchParams.delete(k);
    else url.searchParams.set(k, v);
  });
  history.replaceState({}, "", url.toString());
}

async function fetchResults({ gameId, teamId }) {
  const url = new URL(`${WORKER_BASE}/api/loquiz`);
  url.searchParams.set("gameId", gameId);
  if (teamId) url.searchParams.set("teamId", teamId);
  url.searchParams.set("includeAnswers", "true");

  const resp = await fetch(url.toString(), { method: "GET" });
  const text = await resp.text();

  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error(`Non-JSON response (${resp.status}): ${text.slice(0, 200)}`); }

  if (!resp.ok) {
    throw new Error(`API error (${resp.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

function renderTeam(team) {
  const allAnswers = team.answers || [];
  const answers = INCLUDED_TASK_IDS.size
  ? allAnswers.filter(a => INCLUDED_TASK_IDS.has(a.taskId))
  : allAnswers;
  return `
    <div class="card">
      <h2>${team.name ?? "Team"}</h2>
      <p class="muted">
        Total score: <b>${team.totalScore ?? "-"}</b>
        ${team.correctAnswers != null ? ` • Correct: <b>${team.correctAnswers}</b>` : ""}
        ${team.incorrectAnswers != null ? ` • Incorrect: <b>${team.incorrectAnswers}</b>` : ""}
      </p>
    </div>

    <div class="card">
      <h3>Answer breakdown</h3>
      ${answers.length ? `
        <table>
          <thead><tr><th>Task</th><th>Answer</th><th>Correct</th><th>Score</th></tr></thead>
          <tbody>
            ${answers.map(a => `
              <tr>
                <td>${a.taskId ?? ""}</td>
                <td>${(a.answer ?? "").toString()}</td>
                <td>${a.score ?? ""}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : `<p class="muted">No answers returned. Check that includeAnswers is supported for this game.</p>`}
    </div>
  `;
}

async function run() {
  const app = document.getElementById("app");

  const params = qs();
  const gameId = params.get("gameId");
  const teamId = params.get("teamId");
  const loginCard = document.getElementById("login-card");
  const loadBtn = document.getElementById("loadBtn");

  if (!loadBtn.dataset.bound) {
    loadBtn.dataset.bound = "1";
    loadBtn.addEventListener("click", async () => {
      const g = document.getElementById("gameIdInput").value.trim();
      const t = document.getElementById("teamIdInput").value.trim();
      if (!g) return alert("gameId is required");
      setQueryParams({ gameId: g, teamId: t || "" });
      await run();
    });
  }

  if (!gameId) {
    loginCard.style.display = "flex";
    return;
  }

  const data = await fetchResults({ gameId, teamId });

  if (data.team) {
    if (!data.team) {
      app.textContent = "No team found for that game/team.";
      return;
    }
    loginCard.style.display = "none";
    app.innerHTML = renderTeam(data.team);

    return;
  }

  const teams = data.items || [];
  if (!teams.length) {
    app.textContent = "No teams found for that game.";

    return;
  }
  loginCard.style.display = "none"; 

  const restTaskIdsSet = deriveRestTaskIdSet(teams);
  const correctRows = computeCorrectCountPerTeam(teams, restTaskIdsSet);

  const { ratingCounts, wordCounts } = aggregateMixedTask(teams);

  app.innerHTML = `
    <div class="card">
      <h2>Correct tasks per person</h2>
      <canvas id="barCorrect" height="140"></canvas>
    </div>

    ${renderDonutCharts(teams, DONUT_TASK_IDS)} 

    <div class="card">
      <h2>How satisfied are you with the overall outcome of your team (1-5)?</h2>
      <canvas id="satChart" height="120"></canvas>
    </div>

    <div class="card">
      <h2>One-word experience</h2>
      <canvas id="wordCloudCanvas" height="100vh" max-height="100vh" width="100%"></canvas>
    </div>
  `;

  drawAnswersScoreBarChart(teams)
  drawSatisfactionChart(ratingCounts);
  drawWordCloud(wordCounts);
  drawDonutCharts(teams, DONUT_TASK_IDS);
}

run().catch(err => {
  document.getElementById("app").textContent = `Error: ${err.message}`;
});
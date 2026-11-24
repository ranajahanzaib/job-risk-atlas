const navItems = [
  ["overview", "Overview", "⌂"],
  ["anatomy", "Anatomy lab", "◎"],
  ["explore", "Work landscape", "◌"],
  ["physical-demands", "Physical demands", "↗"],
  ["strength", "Strength", "◇"],
  ["environment", "Environment", "⌁"],
  ["fatal-injuries", "Fatal injuries", "†"],
  ["events", "Event explorer", "◫"],
  ["compare", "Compare work", "⇄"],
  ["data", "Data browser", "▤"],
  ["methodology", "Methodology", "≡"],
  ["sources", "Sources", "↗"],
];
const regionNames = [
  "Shoulders",
  "Arms & hands",
  "Neck",
  "Trunk",
  "Legs & feet",
];
let selectedRegion = "Shoulders";
let toastTimer;

function navMarkup(active) {
  return navItems
    .map(
      ([id, label, icon]) =>
        `<a class="nav-link ${id === active ? "active" : ""}" href="#${id}" ${id === active ? 'aria-current="page"' : ""}><span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span>${["fatal-injuries", "environment", "strength"].includes(id) ? '<span class="nav-badge">—</span>' : ""}</a>`,
    )
    .join("");
}
document.querySelector("#navigation").innerHTML = navMarkup(
  location.hash.slice(1) || "overview",
);
document.querySelector("#mobile-nav").innerHTML = [
  "overview",
  "anatomy",
  "explore",
  "fatal-injuries",
  "data",
]
  .map((id) => navItems.find((item) => item[0] === id))
  .map(
    ([id, label, icon]) =>
      `<a class="nav-link" href="#${id}"><span class="nav-icon">${icon}</span><span>${label === "Fatal injuries" ? "Fatalities" : label}</span></a>`,
  )
  .join("");

const bodyDiagram = `<svg class="body-svg" viewBox="0 0 220 320" role="img" aria-labelledby="bodytitle bodydesc"><title id="bodytitle">Illustrative occupational activity body map</title><desc id="bodydesc">Select a body region to see which published occupational requirements could be associated with that region. This is not a measure of injury or physical load.</desc>
<g class="body-base"><circle cx="110" cy="35" r="22"/><path d="M93 59Q110 54 127 59L140 75 134 135Q131 149 127 157L134 199 143 286Q143 294 135 294H125Q120 294 120 286L110 208 101 286Q101 294 93 294H83Q76 294 77 286L85 199 93 157Q89 145 86 135L80 75Z"/><path d="M82 75 65 83 53 139 38 190Q36 198 43 200Q49 201 52 192L72 151 91 111M138 75 155 83 167 139 182 190Q184 198 177 200Q171 201 168 192L148 151 129 111"/></g>
<g class="body-inner"><path d="M92 76Q110 89 128 76M91 113Q110 124 129 113M88 151Q110 164 132 151M87 199Q110 210 133 199M100 75 106 156M120 75 114 156"/><circle cx="110" cy="86" r="3"/><circle cx="110" cy="157" r="3"/><circle cx="87" cy="77" r="3"/><circle cx="133" cy="77" r="3"/></g>
<g class="body-region" data-region="Shoulders"><path d="M77 70Q110 53 143 70L137 104Q110 115 83 104Z"/></g><g class="body-region" data-region="Arms & hands"><path d="M76 72 56 81 40 148 30 195 51 202 77 150 95 111M144 72 164 81 180 148 190 195 169 202 143 150 125 111"/></g><g class="body-region" data-region="Neck"><path d="M99 52h22v24H99z"/></g><g class="body-region" data-region="Trunk"><path d="M88 91h44v74H88z"/></g><g class="body-region" data-region="Legs & feet"><path d="m89 159 42 0 9 136h-25l-6-75-9 75H75z"/></g>
</svg>`;

function regionButtons() {
  return regionNames
    .map(
      (name) =>
        `<button class="region-button ${name === selectedRegion ? "selected" : ""}" data-region="${name}">${name}</button>`,
    )
    .join("");
}
function emptyPanel(title, unit, source) {
  return `<section class="panel"><div class="panel-head"><span class="panel-title">${title}</span><span class="panel-sub">${unit}</span></div><div class="empty-state"><div class="empty-mark">—</div><h3>Awaiting source data</h3><p>There is no published observation loaded for this view. Missing values are not treated as zero.</p><div class="source-tag">${source}<em>NOT AVAILABLE</em></div></div></section>`;
}
function overview() {
  const req =
    selectedRegion === "Shoulders"
      ? "Reaching overhead · Reaching at or below shoulder level"
      : selectedRegion === "Arms & hands"
        ? "Fine manipulation · Gross manipulation · Handling"
        : selectedRegion === "Neck"
          ? "No direct anatomical measurement in ORS"
          : selectedRegion === "Trunk"
            ? "Stooping · Lifting · Carrying · Sitting"
            : "Standing · Walking · Kneeling · Crouching";
  return `<div class="hero-row"><div><div class="eyebrow">OCCUPATIONAL RESEARCH INSTRUMENT <span>·</span> UNITED STATES</div><h1>Work, examined.</h1><p class="hero-copy">Explore what work asks of the body, and the fatal injuries observed across occupations. Follow the evidence back to its source.</p></div><div class="release-chip"><span></span> ORS 2023 AVAILABLE · CFOI UNAVAILABLE</div></div>
  <div class="workspace"><section class="panel anatomy-panel"><div class="panel-head"><span class="panel-title">Occupational body map</span><span class="panel-sub">ILLUSTRATIVE ACTIVITY MAPPING</span></div><div class="diagram-wrap">${bodyDiagram}<div class="region-list" aria-label="Select body region">${regionButtons()}</div><div class="diagram-note">Illustrative association between job activities and body regions. Not a measure of load, injury, or individual capacity.</div></div><div class="region-detail"><strong>${selectedRegion}</strong> &nbsp; ${req}</div></section>
  <div class="right-stack">${emptyPanel("Physical requirements", "ORS · 2023", "ORS · FINAL SECOND WAVE")}${emptyPanel("Fatal injury rate", "per 100,000 FTE · 2024", "CFOI · 2024")}</div></div>
  <div class="lower-grid">${miniPanel("Strength distribution", "ORS · 2023")}${miniPanel("Working conditions", "ORS · 2023")}${miniPanel("Fatal events", "CFOI · 2024")}</div>
  <div class="method-strip"><span><strong>Different sources, different populations.</strong> ORS describes requirements in its covered workforce. CFOI counts observed fatal work injuries. These datasets are not linked at the worker level.</span><a href="https://www.bls.gov/ors/data.htm" target="_blank" rel="noreferrer">BLS SOURCE ↗</a></div>`;
}
function miniPanel(title, source) {
  return `<section class="panel mini-panel"><div class="panel-head"><span class="panel-title">${title}</span><span class="panel-sub">${source}</span></div><div class="mini-empty"><div class="empty-line wide"></div><div class="empty-line"></div><div class="missing-label">No observation loaded</div></div></section>`;
}

const descriptions = {
  anatomy: [
    "Anatomy laboratory",
    "Explore illustrative links between occupational activities and body regions. These mappings organize published job requirements; they are not biomechanical measurements or injury estimates.",
  ],
  explore: [
    "The occupational landscape",
    "Compare work across official occupational classifications as source data becomes available. No occupations or values are preloaded in this workspace.",
  ],
  "physical-demands": [
    "Physical requirements",
    "Explore published estimates for postures, movement, handling, and other physical requirements. Search an occupation to inspect its ORS 2023 source estimates. CFOI data is still unavailable.",
  ],
  strength: [
    "Strength requirements",
    "Inspect the BLS occupational strength categories and published estimates. Unavailable observations remain unavailable rather than being interpreted as zero.",
  ],
  environment: [
    "Environmental conditions",
    "Review documented workplace conditions from the Occupational Requirements Survey. Indicators will be limited to those present in the selected release.",
  ],
  "fatal-injuries": [
    "Fatal injury observatory",
    "CFOI reports observed fatal occupational injuries. Counts, published hours-based rates, and population scope are distinct measures; no ranking or composite danger score is used here.",
  ],
  events: [
    "Fatal event classifications",
    "Browse official event and exposure classifications when the CFOI occupation workbook is available. Event hierarchy levels must not be added together.",
  ],
  compare: [
    "Compare occupations",
    "Comparison requires published observations for each selected classification. Parent-group data will not be distributed across detailed occupations.",
  ],
  data: [
    "Dataset browser",
    "Search occupations and inspect ORS source observations with workbook sheet and row provenance. CFOI tables are not yet present.",
  ],
  methodology: [
    "Methodology & interpretation",
    "ORS reference year 2023 describes job requirements in the survey’s covered worker population. CFOI reference year 2024 describes fatal injuries. Their scopes differ, and they are not linked records.",
  ],
  sources: [
    "Sources & releases",
    "The initial release targets the final second-wave ORS workbook for reference year 2023 and CFOI occupation events and hours-based rates for reference year 2024.",
  ],
  "fatal-injuries": [
    "Fatal injury observatory",
    "CFOI reports observed fatal occupational injuries. Counts, published hours-based rates, and population scope are distinct measures; no ranking or composite danger score is used here.",
  ],
};
function page(id) {
  const [title, text] = descriptions[id] || descriptions.overview;
  const items =
    id === "sources"
      ? [
          [
            "Occupational Requirements Survey · final second wave",
            "Reference year 2023 · complete XLSX workbook",
            "https://www.bls.gov/ors/data.htm",
          ],
          [
            "Census of Fatal Occupational Injuries · occupation by event",
            "Reference year 2024 · Table A-5 workbook",
            "https://www.bls.gov/iif/fatal-injuries-tables.htm",
          ],
          [
            "CFOI hours-based fatal injury rates",
            "Reference year 2024 · occupation and selected characteristics",
            "https://www.bls.gov/iif/fatal-injuries-tables.htm",
          ],
        ]
      : id === "methodology"
        ? [
            [
              "ORS measures job requirements",
              "Survey estimates describe covered jobs, not worker capabilities or injuries.",
              "https://www.bls.gov/ors/",
            ],
            [
              "CFOI counts fatal occupational injuries",
              "Fatal injury counts and published rates have different denominators and interpretations.",
              "https://www.bls.gov/iif/",
            ],
            [
              "Published rate unit",
              "Fatal injuries per 100,000 full-time equivalent workers. Use official published rates.",
              "https://www.bls.gov/iif/additional-resources/cfoi-hours-based-rates.htm",
            ],
            [
              "Occupational associations do not establish causation",
              "These datasets describe different populations, measurement processes, and reference years.",
              "https://www.bls.gov/iif/definitions/census-of-fatal-occupational-injuries-definitions.htm",
            ],
          ]
        : [
            [
              "ORS observations",
              "Reference year 2023 · unavailable until source workbook acquisition",
              "",
            ],
            [
              "CFOI fatal injury observations",
              "Reference year 2024 · unavailable until source workbook acquisition",
              "",
            ],
            [
              "Occupation reconciliation",
              "SOC-based reviewed matching has not yet been generated",
              "",
            ],
          ];
  return `<div class="page-header"><div class="eyebrow">RESEARCH WORKSPACE <span>·</span> ${id.replaceAll("-", " ").toUpperCase()}</div><h1>${title}</h1><p class="hero-copy">${text}</p></div><div class="page-grid"><section class="panel content-panel"><h2>${id === "sources" ? "Official source releases" : id === "methodology" ? "How to read the evidence" : "Dataset availability"}</h2><div class="data-list">${items.map(([name, desc, href]) => `<div class="data-row"><div><strong>${name}</strong><small>${desc}</small></div>${href ? `<a class="pill source-link" href="${href}" target="_blank" rel="noreferrer">BLS ↗</a>` : '<span class="pill">NOT LOADED</span>'}</div>`).join("")}</div></section><section class="panel content-panel"><h2>Coverage status</h2><p>The ORS 2023 final second-wave workbook has been acquired, inspected, and materialized. CFOI 2024 source workbooks have not been acquired, so related measures remain unavailable.</p><div class="data-list"><div class="data-row"><div><strong>ORS · 2023</strong><small>Final second wave · 128,398 source observations</small></div><span class="pill">AVAILABLE</span></div><div class="data-row"><div><strong>CFOI · 2024</strong><small>Events and occupation rates</small></div><span class="pill">UNAVAILABLE</span></div></div><p style="margin-top:16px">Use the search field to open an occupation profile and inspect its published ORS requirements, standard errors, footnote codes, and source rows.</p></section></div>`;
}
function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
}
function occupationProfile(code) {
  return `<div class="page-header"><div class="eyebrow">OCCUPATION PROFILE <span>·</span> SOC 2018</div><h1 id="occupation-title">Loading occupation…</h1><p class="hero-copy">Published Occupational Requirements Survey observations, reference year 2023. Estimates describe jobs in the survey’s covered population.</p></div><div class="profile-meta" id="occupation-meta">Loading ORS record…</div><section class="panel profile-panel"><div class="panel-head"><span class="panel-title">Physical requirement observations</span><span class="panel-sub">SOURCE ESTIMATES · NOT AN INJURY MEASURE</span></div><div class="profile-table-wrap"><table class="profile-table"><thead><tr><th>Requirement / category</th><th>Published estimate</th><th>Datatype</th><th>Standard error</th><th>Footnote code</th><th>Source row</th></tr></thead><tbody id="requirements-body"><tr><td colspan="6">Loading published observations…</td></tr></tbody></table></div><div class="profile-note">Range or threshold labels are shown exactly as published. A dash indicates the source’s displayed value; no threshold is converted to a midpoint. ORS does not measure injury or individual physical capacity. CFOI comparison is unavailable.</div></section>`;
}
async function loadOccupation(code) {
  localStorage.setItem("jra-occupation-code", code);
  try {
    const [detailResponse, observationsResponse] = await Promise.all([
      fetch(`/api/v1/occupations/${code}`),
      fetch(
        `/api/v1/occupations/${code}/requirements?requirement=${encodeURIComponent("Physical demands")}&limit=200`,
      ),
    ]);
    const detail = await detailResponse.json();
    if (!detailResponse.ok)
      throw new Error(
        detail.error?.message || "Occupation not found in ORS 2023.",
      );
    const result = await observationsResponse.json();
    document.querySelector("#occupation-title").textContent = detail.occupation;
    document.querySelector("#occupation-meta").innerHTML =
      `<span>2018 SOC ${escapeHtml(detail.soc_code)}</span><span>ORS reference year ${detail.reference_year}</span><span>${detail.observation_count.toLocaleString()} published series</span><span>CFOI comparison: unavailable</span>`;
    const body = document.querySelector("#requirements-body");
    if (!result.items?.length) {
      body.innerHTML =
        '<tr><td colspan="6">No physical-demand estimates are published for this classification. This is unavailable data, not a zero estimate.</td></tr>';
      return;
    }
    body.innerHTML = result.items
      .map(
        (row) =>
          `<tr><td>${escapeHtml(row.category)}<small>${escapeHtml(row.estimate_text)}</small></td><td class="num">${escapeHtml(row.estimate_raw)}</td><td>${escapeHtml(row.datatype)}</td><td>${escapeHtml(row.standard_error_raw)}</td><td>${escapeHtml(row.footnote_raw || "—")}${row.footnotes?.map((note) => `<small>${escapeHtml(note.code)} · ${escapeHtml(note.text || "Definition unavailable")}</small>`).join("") || ""}</td><td><small>${escapeHtml(row.source_sheet)} · ${row.source_row}</small></td></tr>`,
      )
      .join("");
    if (result.total > result.items.length)
      body.insertAdjacentHTML(
        "beforeend",
        `<tr><td colspan="6">Showing ${result.items.length} of ${result.total} physical-demand observations. The API supports offset pagination.</td></tr>`,
      );
  } catch (error) {
    document.querySelector("#occupation-title").textContent =
      "Occupation unavailable";
    document.querySelector("#occupation-meta").textContent = error.message;
    document.querySelector("#requirements-body").innerHTML =
      '<tr><td colspan="6">No source observation is available for this occupation code.</td></tr>';
  }
}
function indicatorWorkspace(id, code) {
  const config = {
    "physical-demands": [
      "Physical requirements",
      "Physical demands",
      "Physical requirements",
      "Inspect source estimates for movement, posture, handling, and related job requirements.",
    ],
    strength: [
      "Strength requirements",
      "Physical demands",
      "Strength",
      "Published shares across BLS strength categories. These describe jobs, not worker capability.",
    ],
    environment: [
      "Environmental conditions",
      "Environmental conditions",
      "",
      "Published workplace condition estimates present in the ORS 2023 release.",
    ],
  }[id];
  const [heading, requirement, category, intro] = config;
  const filterText = category
    ? `&category=${encodeURIComponent(category)}`
    : `&requirement=${encodeURIComponent(requirement)}`;
  return `<div class="page-header"><div class="eyebrow">RESEARCH WORKSPACE <span>·</span> ORS 2023</div><h1>${heading}</h1><p class="hero-copy">${intro}</p></div><div class="profile-meta" id="occupation-meta">Loading selected occupation…</div><section class="panel profile-panel"><div class="panel-head"><span class="panel-title" id="indicator-title">${heading}</span><span class="panel-sub">PUBLISHED SOURCE VALUES · 2018 SOC</span></div><div class="profile-table-wrap"><table class="profile-table"><thead><tr><th>Requirement / category</th><th>Published estimate</th><th>Datatype</th><th>Standard error</th><th>Footnote code</th><th>Source row</th></tr></thead><tbody id="requirements-body"><tr><td colspan="6">Loading ORS observations…</td></tr></tbody></table></div><div class="profile-note">${heading} are occupational requirements and conditions, not measures of individual capacity, injury, or health. Original estimate strings and source references are retained.</div></section>`;
}
function seriesExplorer(requirement = "Physical demands") {
  const environment = requirement === "Environmental conditions";
  const heading = environment
    ? "Environmental conditions"
    : "Physical requirements";
  const intro = environment
    ? "Inspect published occupational estimates for working conditions in the ORS 2023 release. These estimates describe job requirements, not exposure concentration or resulting health effects."
    : "Select one published estimate series to inspect its source values across occupations. Each row is an official ORS observation; estimates with different labels or units are never combined.";
  return `<div class="page-header"><div class="eyebrow">RESEARCH WORKSPACE <span>·</span> ORS 2023</div><h1>${heading}</h1><p class="hero-copy">${intro}</p></div><section class="panel content-panel"><div class="explorer-controls"><label>Published estimate<select id="series-select" aria-label="Select a published estimate"><option>Loading source series…</option></select></label><label>Filter occupations<input id="series-search" type="search" placeholder="Occupation or SOC code"></label><button class="pill" id="series-export" type="button" disabled>Export filtered CSV</button></div><div class="profile-meta" id="series-meta">Loading source-defined estimate series…</div><div class="profile-table-wrap"><table class="profile-table"><thead><tr><th>Occupation · 2018 SOC</th><th>Published estimate</th><th>Datatype</th><th>Standard error</th><th>Footnotes</th><th>Source row</th></tr></thead><tbody id="series-body"><tr><td colspan="6">Loading ORS observations…</td></tr></tbody></table></div><div class="explorer-pagination"><button class="pill" id="series-prev" type="button" disabled>Previous</button><span id="series-page">—</span><button class="pill" id="series-next" type="button" disabled>Next</button></div><div class="profile-note">Values are shown as published, including threshold and suppression labels. This survey describes requirements among its covered worker population; it does not measure individual capacity, exposure concentration, or health outcomes.</div></section>`;
}
let seriesState = {
  code: "",
  requirement: "Physical demands",
  offset: 0,
  total: 0,
  term: "",
  timer: 0,
  items: [],
};
const strengthLabels = [
  "sedentary",
  "light work",
  "medium work",
  "heavy work",
  "very heavy work",
];
let strengthState = {
  offset: 0,
  term: "",
  timer: 0,
  items: [],
  categories: [],
};
function strengthExplorer() {
  return `<div class="page-header"><div class="eyebrow">RESEARCH WORKSPACE <span>·</span> ORS 2023</div><h1>Strength requirements</h1><p class="hero-copy">Review the five source-published strength categories by occupation. Cells preserve ORS estimate strings and are not converted into a numeric strength score.</p></div><section class="panel content-panel"><div class="explorer-controls"><label>Filter occupations<input id="strength-search" type="search" placeholder="Occupation or SOC code"></label><button class="pill" id="strength-export" type="button" disabled>Export filtered CSV</button></div><div class="profile-meta" id="strength-meta">Loading ORS strength observations…</div><div class="profile-table-wrap"><table class="profile-table strength-table"><thead id="strength-head"></thead><tbody id="strength-body"><tr><td>Loading published observations…</td></tr></tbody></table></div><div class="explorer-pagination"><button class="pill" id="strength-prev" type="button" disabled>Previous</button><span id="strength-page">—</span><button class="pill" id="strength-next" type="button" disabled>Next</button></div><div class="profile-note">Percentages describe the source-defined categories and may not sum to 100 because of rounding, suppressed values, or unpublished categories. A missing cell means no displayed observation; it is not zero. Source row and standard error are available for each published value.</div></section>`;
}
async function loadStrengthPage() {
  const params = new URLSearchParams({
    limit: "100",
    offset: String(strengthState.offset),
  });
  if (strengthState.term) params.set("q", strengthState.term);
  const response = await fetch(`/api/v1/strength?${params}`);
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error?.message || "Strength data is unavailable.");
  strengthState.total = data.total;
  strengthState.items = data.items;
  strengthState.categories = data.categories;
  const short = strengthLabels.map((label) =>
    data.categories.find((item) => item.toLowerCase().endsWith(label)),
  );
  document.querySelector("#strength-head").innerHTML =
    `<tr><th>Occupation · 2018 SOC</th>${short.map((label, i) => `<th title="${escapeHtml(label || "Not published")}">${["Sedentary", "Light", "Medium", "Heavy", "Very heavy"][i]}<small>${escapeHtml(label || "Not published")}</small></th>`).join("")}</tr>`;
  document.querySelector("#strength-body").innerHTML = data.items.length
    ? data.items
        .map(
          (occupation) =>
            `<tr><td><button class="table-link" type="button" data-occupation="${escapeHtml(occupation.soc_code)}">${escapeHtml(occupation.occupation)}</button><small>2018 SOC ${escapeHtml(occupation.soc_code)}</small></td>${short
              .map((label) => {
                const item = occupation.categories[label];
                return item
                  ? `<td class="num" title="${escapeHtml(item.estimate_text)}">${escapeHtml(item.estimate_raw)}<small>SE ${escapeHtml(item.standard_error_raw)} · row ${item.source_row}${item.footnote_raw ? ` · footnote ${escapeHtml(item.footnote_raw)}` : ""}</small></td>`
                  : '<td class="muted-cell">—<small>Not published</small></td>';
              })
              .join("")}</tr>`,
        )
        .join("")
    : '<tr><td colspan="6">No published strength records match this filter.</td></tr>';
  document.querySelector("#strength-meta").innerHTML =
    `<span>${data.total.toLocaleString()} matching occupational classifications</span><span>ORS reference year ${data.reference_year}</span><span>Source categories shown separately; no composite score</span>`;
  document.querySelector("#strength-page").textContent =
    `${data.total ? strengthState.offset + 1 : 0}–${Math.min(strengthState.offset + data.items.length, data.total)} of ${data.total}`;
  document.querySelector("#strength-prev").disabled =
    strengthState.offset === 0;
  document.querySelector("#strength-next").disabled =
    strengthState.offset + data.items.length >= data.total;
  document.querySelector("#strength-export").disabled = !data.items.length;
}
async function loadStrengthExplorer() {
  try {
    await loadStrengthPage();
  } catch (error) {
    document.querySelector("#strength-body").innerHTML =
      `<tr><td>${escapeHtml(error.message)}</td></tr>`;
  }
}
async function exportStrengthCsv() {
  const params = new URLSearchParams({ limit: "200", offset: "0" });
  if (strengthState.term) params.set("q", strengthState.term);
  let all = [];
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    params.set("offset", String(offset));
    const response = await fetch(`/api/v1/strength?${params}`);
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error?.message || "Strength export unavailable.");
    all.push(...data.items);
    total = data.total;
    offset += data.items.length;
    if (!data.items.length) break;
  }
  const cols = [
    "occupation",
    "soc_code",
    ...strengthState.categories.flatMap((label) => [
      `${label} estimate`,
      `${label} standard error`,
      `${label} footnote codes`,
      `${label} source row`,
    ]),
  ];
  const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [
    cols.map(quote).join(","),
    ...all.map((row) =>
      [
        row.occupation,
        row.soc_code,
        ...strengthState.categories.flatMap((label) => {
          const item = row.categories[label];
          return [
            item?.estimate_raw ?? "",
            item?.standard_error_raw ?? "",
            item?.footnote_raw ?? "",
            item?.source_row ?? "",
          ];
        }),
      ]
        .map(quote)
        .join(","),
    ),
  ].join("\r\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "ors-2023-strength-filtered.csv";
  link.click();
  URL.revokeObjectURL(url);
}
async function loadSeriesPage() {
  if (!seriesState.code) return;
  const params = new URLSearchParams({
    limit: "100",
    offset: String(seriesState.offset),
  });
  if (seriesState.term) params.set("q", seriesState.term);
  const response = await fetch(`/api/v1/series/${seriesState.code}?${params}`);
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error?.message || "Published series unavailable.");
  seriesState.total = data.total;
  seriesState.items = data.items;
  const body = document.querySelector("#series-body");
  body.innerHTML = data.items.length
    ? data.items
        .map(
          (row) =>
            `<tr><td><button type="button" class="table-link" data-occupation="${escapeHtml(row.soc_code)}">${escapeHtml(row.occupation)}</button><small>2018 SOC ${escapeHtml(row.soc_code)}</small></td><td class="num">${escapeHtml(row.estimate_raw)}</td><td>${escapeHtml(row.datatype)}</td><td>${escapeHtml(row.standard_error_raw)}</td><td>${escapeHtml(row.footnote_raw || "—")}${row.footnotes.map((note) => `<small>${escapeHtml(note.code)} · ${escapeHtml(note.text || "Definition unavailable")}</small>`).join("")}</td><td><small>${escapeHtml(row.source_sheet)} · ${row.source_row}</small></td></tr>`,
        )
        .join("")
    : '<tr><td colspan="6">No published observation matches this filter. Missing data is not zero.</td></tr>';
  document.querySelector("#series-meta").innerHTML =
    `<span>${escapeHtml(data.category)}</span><span>${escapeHtml(data.estimate_text)}</span><span>${data.total.toLocaleString()} matching occupations</span><span>ORS reference year 2023</span>`;
  document.querySelector("#series-page").textContent =
    `${data.total ? seriesState.offset + 1 : 0}–${Math.min(seriesState.offset + data.items.length, data.total)} of ${data.total}`;
  document.querySelector("#series-prev").disabled = seriesState.offset === 0;
  document.querySelector("#series-next").disabled =
    seriesState.offset + data.items.length >= data.total;
  document.querySelector("#series-export").disabled = !data.items.length;
}
async function loadSeriesExplorer(requirement = "Physical demands") {
  try {
    seriesState.requirement = requirement;
    const response = await fetch(
      `/api/v1/series?requirement=${encodeURIComponent(requirement)}`,
    );
    const catalog = await response.json();
    if (!response.ok)
      throw new Error(catalog.error?.message || "ORS catalog unavailable.");
    const select = document.querySelector("#series-select");
    select.innerHTML = catalog.items
      .map(
        (item) =>
          `<option value="${escapeHtml(item.estimate_code)}">${escapeHtml(item.category)} · ${escapeHtml(item.estimate_text)} (${item.occupation_count})</option>`,
      )
      .join("");
    seriesState.code = select.value;
    seriesState.offset = 0;
    await loadSeriesPage();
  } catch (error) {
    document.querySelector("#series-body").innerHTML =
      `<tr><td colspan="6">${escapeHtml(error.message)}</td></tr>`;
  }
}
async function exportSeriesCsv() {
  const params = new URLSearchParams({ limit: "500", offset: "0" });
  if (seriesState.term) params.set("q", seriesState.term);
  const response = await fetch(`/api/v1/series/${seriesState.code}?${params}`);
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.error?.message || "Filtered observations could not be exported.",
    );
  const columns = [
    "occupation",
    "soc_code",
    "estimate_text",
    "estimate_raw",
    "datatype",
    "standard_error_raw",
    "footnote_raw",
    "source_sheet",
    "source_row",
  ];
  const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [
    columns.join(","),
    ...data.items.map((row) =>
      columns.map((column) => quote(row[column])).join(","),
    ),
  ].join("\r\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `ors-2023-${seriesState.code}-filtered.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
async function loadIndicatorPage(id, code) {
  const [, requirement, category] = {
    "physical-demands": ["", "Physical demands", ""],
    strength: ["", "Physical demands", "Strength"],
    environment: ["", "Environmental conditions", ""],
  }[id];
  try {
    const detail = await fetch(`/api/v1/occupations/${code}`).then((response) =>
      response.json(),
    );
    if (detail.error) throw new Error(detail.error.message);
    const query = new URLSearchParams({ limit: "200" });
    if (requirement) query.set("requirement", requirement);
    if (category) query.set("category", category);
    const result = await fetch(
      `/api/v1/occupations/${code}/requirements?${query}`,
    ).then((response) => response.json());
    document.querySelector("#occupation-meta").innerHTML =
      `<span>${escapeHtml(detail.occupation)}</span><span>2018 SOC ${escapeHtml(detail.soc_code)}</span><span>ORS reference year 2023</span><span>${result.total} source observations</span>`;
    const body = document.querySelector("#requirements-body");
    if (!result.items?.length) {
      body.innerHTML =
        '<tr><td colspan="6">This classification has no published observations for the selected view.</td></tr>';
      return;
    }
    body.innerHTML = result.items
      .map(
        (row) =>
          `<tr><td>${escapeHtml(row.category)}<small>${escapeHtml(row.estimate_text)}</small></td><td class="num">${escapeHtml(row.estimate_raw)}</td><td>${escapeHtml(row.datatype)}</td><td>${escapeHtml(row.standard_error_raw)}</td><td>${escapeHtml(row.footnote_raw || "—")}${row.footnotes?.map((note) => `<small>${escapeHtml(note.code)} · ${escapeHtml(note.text || "Definition unavailable")}</small>`).join("") || ""}</td><td><small>${escapeHtml(row.source_sheet)} · ${row.source_row}</small></td></tr>`,
      )
      .join("");
  } catch (error) {
    document.querySelector("#occupation-meta").textContent = error.message;
    document.querySelector("#requirements-body").innerHTML =
      '<tr><td colspan="6">No selected ORS occupation is available. Search for an occupation in the top bar.</td></tr>';
  }
}
function updateRegion(name) {
  selectedRegion = name;
  const view = document.querySelector("#view");
  if (
    location.hash === "" ||
    location.hash === "#overview" ||
    location.hash === "#anatomy"
  )
    render();
}
function render() {
  const id = location.hash.slice(1) || "overview";
  const occupationMatch = /^occupation\/(\d{6})$/.exec(id);
  const known = navItems.some((item) => item[0] === id)
    ? id
    : occupationMatch
      ? "overview"
      : "overview";
  const selectedSoc = localStorage.getItem("jra-occupation-code");
  const indicatorPage =
    ["physical-demands", "strength", "environment"].includes(known) &&
    selectedSoc;
  document.querySelector("#crumb-current").textContent = occupationMatch
    ? "Occupation profile"
    : navItems.find((item) => item[0] === known)[1];
  document.querySelector("#navigation").innerHTML = navMarkup(known);
  document
    .querySelectorAll("#mobile-nav .nav-link")
    .forEach((a) => a.classList.toggle("active", a.hash === `#${known}`));
  document.querySelector("#view").innerHTML = occupationMatch
    ? occupationProfile(occupationMatch[1])
    : known === "physical-demands"
      ? seriesExplorer()
      : known === "environment"
        ? seriesExplorer("Environmental conditions")
        : known === "strength"
          ? strengthExplorer()
          : indicatorPage
            ? indicatorWorkspace(known, selectedSoc)
            : known === "overview" || known === "anatomy"
              ? overview()
              : page(known);
  if (occupationMatch) loadOccupation(occupationMatch[1]);
  if (known === "physical-demands") loadSeriesExplorer();
  if (known === "environment") loadSeriesExplorer("Environmental conditions");
  if (known === "strength") loadStrengthExplorer();
  if (indicatorPage) loadIndicatorPage(known, selectedSoc);
  document
    .querySelectorAll(".body-region")
    .forEach((node) =>
      node.classList.toggle("selected", node.dataset.region === selectedRegion),
    );
  document.querySelector("#view").focus({ preventScroll: true });
}
window.addEventListener("hashchange", render);
document.addEventListener("click", (event) => {
  const region = event.target.closest("[data-region]");
  if (region) {
    selectedRegion = region.dataset.region;
    render();
    return;
  }
  if (event.target.id === "series-prev") {
    seriesState.offset = Math.max(0, seriesState.offset - 100);
    loadSeriesPage().catch((error) => showToast(error.message));
  }
  if (event.target.id === "series-next") {
    seriesState.offset += 100;
    loadSeriesPage().catch((error) => showToast(error.message));
  }
  if (event.target.id === "series-export")
    exportSeriesCsv().catch((error) => showToast(error.message));
  if (event.target.id === "strength-prev") {
    strengthState.offset = Math.max(0, strengthState.offset - 100);
    loadStrengthPage().catch((error) => showToast(error.message));
  }
  if (event.target.id === "strength-next") {
    strengthState.offset += 100;
    loadStrengthPage().catch((error) => showToast(error.message));
  }
  if (event.target.id === "strength-export")
    exportStrengthCsv().catch((error) => showToast(error.message));
  const occupation = event.target.closest("[data-occupation]");
  if (occupation) {
    localStorage.setItem("jra-occupation-code", occupation.dataset.occupation);
    location.hash = `#occupation/${occupation.dataset.occupation}`;
  }
});
document.addEventListener("change", (event) => {
  if (event.target.id === "series-select") {
    seriesState.code = event.target.value;
    seriesState.offset = 0;
    loadSeriesPage().catch((error) => showToast(error.message));
  }
});
document.addEventListener("input", (event) => {
  if (event.target.id === "series-search") {
    clearTimeout(seriesState.timer);
    seriesState.timer = setTimeout(() => {
      seriesState.term = event.target.value.trim();
      seriesState.offset = 0;
      loadSeriesPage().catch((error) => showToast(error.message));
    }, 180);
  }
});
document.addEventListener("input", (event) => {
  if (event.target.id === "strength-search") {
    clearTimeout(strengthState.timer);
    strengthState.timer = setTimeout(() => {
      strengthState.term = event.target.value.trim();
      strengthState.offset = 0;
      loadStrengthPage().catch((error) => showToast(error.message));
    }, 180);
  }
});
document.querySelector("#theme-toggle").addEventListener("click", () => {
  document.body.classList.toggle("light");
  localStorage.setItem(
    "jra-theme",
    document.body.classList.contains("light") ? "light" : "dark",
  );
});
if (localStorage.getItem("jra-theme") === "light")
  document.body.classList.add("light");
function showToast(message) {
  const el = document.querySelector("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
}
const search = document.querySelector("#search");
const searchResults = document.querySelector("#search-results");
let searchTimer;
function showSearchMessage(message) {
  searchResults.replaceChildren();
  const item = document.createElement("div");
  item.className = "result-message";
  item.textContent = message;
  searchResults.append(item);
  searchResults.hidden = false;
}
search.addEventListener("input", () => {
  clearTimeout(searchTimer);
  const term = search.value.trim();
  if (term.length < 2) {
    searchResults.hidden = true;
    return;
  }
  searchTimer = setTimeout(async () => {
    try {
      const response = await fetch(
        `/api/v1/occupations?q=${encodeURIComponent(term)}&limit=12`,
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error?.message || "Occupation search unavailable.",
        );
      searchResults.replaceChildren();
      if (!data.items.length) {
        showSearchMessage("No matching ORS 2023 occupational classification.");
        return;
      }
      for (const result of data.items) {
        const button = document.createElement("button");
        button.className = "search-result";
        button.type = "button";
        button.setAttribute("role", "option");
        const label = document.createElement("span");
        label.innerHTML = `<strong>${escapeHtml(result.occupation)}</strong><small>SOC 2018 · ${escapeHtml(result.soc_code)}</small>`;
        const coverage = document.createElement("small");
        coverage.className = "coverage";
        coverage.textContent = "ORS 2023";
        button.append(label, coverage);
        button.addEventListener("click", () => {
          searchResults.hidden = true;
          search.value = result.occupation;
          localStorage.setItem("jra-occupation-code", result.soc_code);
          location.hash = `#occupation/${result.soc_code}`;
        });
        searchResults.append(button);
      }
      searchResults.hidden = false;
    } catch (error) {
      showSearchMessage(error.message);
    }
  }, 130);
});
search.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    const first = searchResults.querySelector("button");
    if (first) {
      event.preventDefault();
      first.click();
    }
  }
  if (event.key === "ArrowDown") {
    const first = searchResults.querySelector("button");
    if (first) {
      event.preventDefault();
      first.focus();
    }
  }
  if (event.key === "Escape") searchResults.hidden = true;
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".search-area")) searchResults.hidden = true;
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    search.focus();
  }
  if (event.key === "Escape") search.blur();
});
fetch("/api/v1/health")
  .then((response) => {
    if (!response.ok) throw new Error("Health check failed");
    return response.json();
  })
  .then((health) => {
    const ready = health.ors_2023_ready;
    const label = ready
      ? "ORS 2023 AVAILABLE · CFOI UNAVAILABLE"
      : "SOURCE DATA MISSING";
    document.querySelector("#rail-status").textContent = label;
    document.querySelector(".status-dot").style.background = ready
      ? "var(--green)"
      : "var(--amber)";
    const releaseChip = document.querySelector(".release-chip");
    if (releaseChip) releaseChip.innerHTML = `<span></span> ${label}`;
  })
  .catch(() => {
    document.querySelector("#rail-status").textContent = "API UNAVAILABLE";
  });
render();

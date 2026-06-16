const officialSources = {
  awardsList: "https://www.fairwork.gov.au/employment-conditions/awards/list-of-awards",
  mapd: "https://www.fwc.gov.au/work-conditions/awards/modern-awards-pay-database",
  mapdApi: "https://developer.fwc.gov.au/",
  nesAnnualLeave: "https://www.fairwork.gov.au/leave/annual-leave"
};

const awardLibrary = (window.awardLibrary || []).sort((a, b) =>
  a.title.localeCompare(b.title)
);

const state = {
  selectedAward: null,
  selectedClauseId: "",
  dynamicClauses: [],
  isLoadingAwardText: false,
  hideIndustryAwards: false,
  lastSearchTerm: "",
  currentView: "clauses"
};

const awardSearch = document.querySelector("#awardSearch");
const awardResults = document.querySelector("#awardResults");
const industryFilterButton = document.querySelector("#industryFilterButton");
const clauseView = document.querySelector("#clauseView");
const officialView = document.querySelector("#officialView");
const ratesView = document.querySelector("#ratesView");
const payGuideView = document.querySelector("#payGuideView");
const tabs = document.querySelectorAll(".tab");
const questionInput = document.querySelector("#questionInput");
const askButton = document.querySelector("#askButton");
const answerTitle = document.querySelector("#answerTitle");
const answerBody = document.querySelector("#answerBody");
const toast = document.querySelector("#toast");
const classificationSelect = document.querySelector("#classificationSelect");
const rateLookupButton = document.querySelector("#rateLookupButton");
const payRateOutput = document.querySelector("#payRateOutput");
const currentAwardCode = document.querySelector("#currentAwardCode");
const currentAwardStatus = document.querySelector("#currentAwardStatus");
const currentAwardUse = document.querySelector("#currentAwardUse");
const officialAwardLink = document.querySelector("#officialAwardLink");
const payGuidePdfLink = document.querySelector("#payGuidePdfLink");
const payGuideDocxLink = document.querySelector("#payGuideDocxLink");
const awardHtmlFrame = document.querySelector("#awardHtmlFrame");
const payGuideFrame = document.querySelector("#payGuideFrame");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2400);
}

function hasSelectedAward() {
  if (!state.selectedAward) {
    showToast("Select an award first");
    return false;
  }
  return true;
}

function awardHtmlUrl(award = state.selectedAward) {
  if (!award) return officialSources.awardsList;
  return `https://awards.fairwork.gov.au/${award.code}.html`;
}

function awardPdfUrl(award = state.selectedAward) {
  if (!award) return officialSources.awardsList;
  return `https://www.fwc.gov.au/documents/modern_awards/pdf/${award.code.toLowerCase()}.pdf`;
}

function payGuideUrl(fileType, award = state.selectedAward) {
  if (!award) return officialSources.mapd;

  const params = new URLSearchParams({
    awardCode: award.code.toLowerCase(),
    fileType
  });

  return `https://calculate.fairwork.gov.au/Download/AwardSummary?${params.toString()}`;
}

function renderEmptyState() {
  currentAwardCode.textContent = "—";
  currentAwardStatus.textContent = "No award selected";
  currentAwardUse.textContent = "Select an award from the list";

  officialAwardLink.href = officialSources.awardsList;
  officialAwardLink.textContent = "Official award";

  payGuidePdfLink.href = officialSources.mapd;
  payGuidePdfLink.textContent = "Pay guide PDF";

  payGuideDocxLink.href = officialSources.mapd;
  payGuideDocxLink.textContent = "Pay guide DOCX";

  awardHtmlFrame.removeAttribute("src");
  payGuideFrame.removeAttribute("src");

  document.querySelector("#viewerTitle").textContent = "Select an award to begin";

  classificationSelect.innerHTML = `<option value="">Select an award first</option>`;

  payRateOutput.innerHTML = `
    <p class="api-note">Select an award before checking pay rates.</p>
  `;

  clauseView.innerHTML = `
    <article class="clause-card is-highlighted">
      <h3>Welcome to Award Assistant</h3>
      <p>Select an award from the award picker to begin.</p>
      <p class="source-note">No award or clause is currently selected.</p>
    </article>
  `;

  answerTitle.textContent = "Ready";
  answerBody.innerHTML = `
    <p>Select an award from the left, then ask a question about clauses, classifications, pay rates or NES comparisons.</p>
  `;

  setView("clauses");
}

function renderAwardResults() {
  const query = awardSearch.value.trim().toLowerCase();
  const terms = query.split(/[^a-z0-9]+/).filter(Boolean);

  const matches = awardLibrary
    .filter((award) => !state.hideIndustryAwards || !/\bindustry\b/i.test(award.title))
    .filter((award) => {
      const haystack = [
        award.code,
        award.shortName || "",
        award.title,
        ...(award.keywords || [])
      ].join(" ").toLowerCase();

      return !query || haystack.includes(query) || terms.every((term) => haystack.includes(term));
    });

  if (!matches.length) {
    awardResults.innerHTML = `
      <p class="source-note">No award match found. Check the official Fair Work A-Z awards list.</p>
    `;
    return;
  }

  awardResults.innerHTML = matches
    .map((award) => {
      const shortName = award.shortName || award.title;
      return `
        <button class="award-result" type="button" data-award="${escapeHtml(award.code)}">
          <strong>${escapeHtml(shortName)}</strong>
          <span>${escapeHtml(award.title)} (${escapeHtml(award.code)})</span>
        </button>
      `;
    })
    .join("");
}

function toggleIndustryFilter() {
  state.hideIndustryAwards = !state.hideIndustryAwards;

  industryFilterButton.setAttribute("aria-pressed", String(state.hideIndustryAwards));
  industryFilterButton.textContent = state.hideIndustryAwards
    ? "View all awards"
    : "View occupational awards only";

  renderAwardResults();
}

function setView(view) {
  state.currentView = view;

  clauseView.hidden = view !== "clauses";
  officialView.hidden = view !== "official";
  ratesView.hidden = view !== "rates";
  payGuideView.hidden = view !== "payGuide";

  tabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.view === view);
  });
}

function selectAward(code) {
  const award = awardLibrary.find((item) => item.code === code);

  if (!award) {
    showToast("Award not found in the A-Z catalogue");
    return;
  }

  state.selectedAward = award;
  state.selectedClauseId = "";
  state.dynamicClauses = [];
  state.isLoadingAwardText = false;
  state.lastSearchTerm = "";

  currentAwardCode.textContent = award.code;
  currentAwardStatus.textContent = "Official source selected";
  currentAwardUse.textContent = "HR clause lookup";

  officialAwardLink.href = awardHtmlUrl(award);
  officialAwardLink.textContent = `${award.code} official award`;

  payGuidePdfLink.href = payGuideUrl("pdf", award);
  payGuidePdfLink.textContent = `${award.code} pay guide PDF`;

  payGuideDocxLink.href = payGuideUrl("docx", award);
  payGuideDocxLink.textContent = `${award.code} pay guide DOCX`;

  awardHtmlFrame.src = `/api/award-html?code=${encodeURIComponent(award.code)}`;
  payGuideFrame.src = payGuideUrl("pdf", award);

  document.querySelector("#viewerTitle").textContent = award.title;

  classificationSelect.innerHTML = `<option value="">Use official MAPD source</option>`;

  payRateOutput.innerHTML = `
    <p class="api-note">
      Use the official FWC Modern Awards Pay Database for pay rates for <strong>${escapeHtml(award.code)}</strong>.
    </p>
    <p>
      <a href="${officialSources.mapd}" target="_blank" rel="noreferrer">Open MAPD extracts</a>
    </p>
  `;

  clauseView.innerHTML = `
    <article class="clause-card is-highlighted">
      <h3>${escapeHtml(award.title)}</h3>
      <p>This award is selected.</p>
      <p>Use the Award viewer tab to view the official award, or ask a question in the panel on the right.</p>
      <p class="source-note">
        Source:
        <a href="${awardHtmlUrl(award)}" target="_blank" rel="noreferrer">official award HTML</a>
        and
        <a href="${awardPdfUrl(award)}" target="_blank" rel="noreferrer">FWC PDF</a>
      </p>
    </article>
  `;

  answerTitle.textContent = "Award selected";
  answerBody.innerHTML = `
    <p><strong>${escapeHtml(award.title)}</strong> is selected.</p>
    <p>Ask a question such as <em>annual leave</em>, <em>classification</em>, <em>overtime</em>, <em>casual loading</em>, or <em>penalty rates</em>.</p>
  `;

  setView("official");
  renderAwardResults();
  showToast(`${award.code} opened`);
}

function renderSearchResults(matches, query, source) {
  if (!matches.length) {
    clauseView.innerHTML = `
      <article class="clause-card is-highlighted">
        <h3>No clear match found</h3>
        <p>No clear match was found for "${escapeHtml(query)}" in the selected award.</p>
        <p class="source-note">
          Open the <a href="${escapeHtml(source || awardHtmlUrl())}" target="_blank" rel="noreferrer">official award</a> and search manually before relying on the result.
        </p>
      </article>
    `;

    answerTitle.textContent = "No clear match";
    answerBody.innerHTML = `
      <p>No clear match was found for "${escapeHtml(query)}". Try a simpler term such as <em>annual leave</em>, <em>overtime</em>, <em>classification</em>, or <em>allowance</em>.</p>
    `;
    return;
  }

  state.dynamicClauses = matches.map((match, index) => ({
    id: match.id || `official-match-${index + 1}`,
    number: match.number || `Match ${index + 1}`,
    title: match.title || `Search result for "${query}"`,
    source: source || awardHtmlUrl(),
    body: Array.isArray(match.body)
      ? match.body
      : [match.text || match.body || "No text returned."]
  }));

  state.selectedClauseId = state.dynamicClauses[0].id;

  clauseView.innerHTML = state.dynamicClauses
    .map((match) => `
      <article id="${escapeHtml(match.id)}" class="clause-card${match.id === state.selectedClauseId ? " is-highlighted" : ""}">
        <h3>${escapeHtml(match.number)}. ${escapeHtml(match.title)}</h3>
        ${match.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
        <p class="source-note">
          Source:
          <a href="${escapeHtml(match.source)}" target="_blank" rel="noreferrer">official award</a>
        </p>
      </article>
    `)
    .join("");

  answerTitle.textContent = "Search results";
  answerBody.innerHTML = `
    <p>Found ${matches.length} match${matches.length === 1 ? "" : "es"} for <strong>${escapeHtml(query)}</strong> in <strong>${escapeHtml(state.selectedAward.title)}</strong>.</p>
  `;

  setView("clauses");
}

async function askAward() {
  if (!hasSelectedAward()) return;

  const query = questionInput.value.trim();

  if (!query) {
    showToast("Type a question first");
    return;
  }

  state.isLoadingAwardText = true;
  state.lastSearchTerm = query;

  clauseView.innerHTML = `
    <article class="clause-card is-highlighted">
      <h3>Searching ${escapeHtml(state.selectedAward.title)}</h3>
      <p>Looking for "${escapeHtml(query)}" in the official award text.</p>
    </article>
  `;

  answerTitle.textContent = "Searching official award";
  answerBody.innerHTML = `
    <p>Searching ${escapeHtml(state.selectedAward.title)} for "${escapeHtml(query)}".</p>
  `;

  setView("clauses");

  try {
    const params = new URLSearchParams({
      code: state.selectedAward.code,
      q: query
    });

    const response = await fetch(`/api/award-search?${params.toString()}`);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Search failed");
    }

    const matches = Array.isArray(payload.matches) ? payload.matches : [];
    renderSearchResults(matches, query, payload.source);
  } catch (error) {
    clauseView.innerHTML = `
      <article class="clause-card is-highlighted">
        <h3>Search unavailable</h3>
        <p>The award search could not run: ${escapeHtml(error.message)}</p>
        <p class="source-note">
          Use the <a href="${awardHtmlUrl()}" target="_blank" rel="noreferrer">official award</a> directly.
        </p>
      </article>
    `;

    answerTitle.textContent = "Search unavailable";
    answerBody.innerHTML = `
      <p>The award search could not run. Open the official award and search manually before relying on the result.</p>
    `;
  } finally {
    state.isLoadingAwardText = false;
  }
}

function selectedResultText() {
  const selected = state.dynamicClauses.find((item) => item.id === state.selectedClauseId);
  if (!selected) return "";
  return `${selected.number}. ${selected.title}\n\n${selected.body.join("\n\n")}\n\nSource: ${selected.source}`;
}

async function copyClause() {
  if (!hasSelectedAward()) return;

  const text = selectedResultText();

  if (!text) {
    showToast("Ask a question first");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    showToast("Result copied");
  } catch {
    showToast("Clipboard unavailable in this browser");
  }
}

function summariseClause() {
  if (!hasSelectedAward()) return;

  const selected = state.dynamicClauses.find((item) => item.id === state.selectedClauseId);

  if (!selected) {
    answerTitle.textContent = "No clause selected";
    answerBody.innerHTML = `
      <p>Ask a question first, then I can summarise the matched text.</p>
    `;
    return;
  }

  answerTitle.textContent = "Summary";
  answerBody.innerHTML = `
    <p><strong>${escapeHtml(selected.title)}</strong></p>
    <p>${escapeHtml(selected.body[0] || "No text available.")}</p>
    <p class="source-note">Check the official award before relying on this summary.</p>
  `;
}

function compareWithNes() {
  if (!hasSelectedAward()) return;

  answerTitle.textContent = "Compare with NES";
  answerBody.innerHTML = `
    <p>Use the NES as the minimum entitlement baseline, then check <strong>${escapeHtml(state.selectedAward.title)}</strong> for award-specific rules about payment, loading, rostering, classifications, overtime, penalties and administration.</p>
    <p class="source-note">
      Source:
      <a href="${officialSources.nesAnnualLeave}" target="_blank" rel="noreferrer">Fair Work Ombudsman annual leave</a>
      and
      <a href="${awardHtmlUrl()}" target="_blank" rel="noreferrer">${escapeHtml(state.selectedAward.code)} official award</a>.
    </p>
  `;
}

function checkClassifications() {
  if (!hasSelectedAward()) return;

  questionInput.value = "classification";
  askAward();
}

function checkPayRates() {
  if (!hasSelectedAward()) return;

  setView("rates");

  payRateOutput.innerHTML = `
    <p class="api-note">
      Use the official FWC Modern Awards Pay Database to check current pay rates for <strong>${escapeHtml(state.selectedAward.code)}</strong>.
    </p>
    <p>
      <a href="${officialSources.mapd}" target="_blank" rel="noreferrer">Open MAPD extracts</a>
    </p>
  `;

  answerTitle.textContent = "Pay rates";
  answerBody.innerHTML = `
    <p>Pay rates should be checked against the current FWC MAPD data and the current award. Award coverage and classification still need to be checked separately.</p>
  `;
}

function handleAction(action) {
  if (action === "copy-clause") copyClause();
  if (action === "summarise-clause") summariseClause();
  if (action === "compare-nes") compareWithNes();
  if (action === "check-classifications") checkClassifications();
  if (action === "check-pay-rates") checkPayRates();
  if (action === "view-pay-guide") {
    if (!hasSelectedAward()) return;
    setView("payGuide");
  }
}

function boot() {
  renderEmptyState();

  if (!awardLibrary.length) {
    awardResults.innerHTML = `
      <p class="source-note">
        No awards loaded. Check that <strong>awards.js</strong> is in the same folder as index.html and loads before app.js.
      </p>
    `;
  } else {
    renderAwardResults();
  }

  console.log("Awards loaded:", awardLibrary.length);

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      if (tab.dataset.view !== "clauses" && !state.selectedAward) {
        showToast("Select an award first");
        return;
      }

      setView(tab.dataset.view);
    });
  });

  askButton.addEventListener("click", askAward);

  questionInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      askAward();
    }
  });

  document.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    handleAction(actionButton.dataset.action);
  });

  rateLookupButton.addEventListener("click", checkPayRates);
}

boot();

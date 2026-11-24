import {
  Activity,
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  BookOpen,
  Boxes,
  ChartNoAxesCombined,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Compass,
  Database,
  Download,
  ExternalLink,
  FileSearch,
  FlaskConical,
  Gauge,
  HeartPulse,
  Layers3,
  Link2,
  Menu,
  Moon,
  MoveUpRight,
  Pause,
  Play,
  RotateCcw,
  Search,
  Shield,
  Sun,
  Users,
  X,
} from "lucide-react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
const EstimateBarChart = lazy(() =>
  import("./Charts").then((module) => ({ default: module.EstimateBarChart })),
);
const LandscapeScatter = lazy(() =>
  import("./Charts").then((module) => ({ default: module.LandscapeScatter })),
);
const BodyScene = lazy(() => import("./BodyScene"));

type Health = {
  status: string;
  ors_2023_ready: boolean;
  cfoi_2024_ready: boolean;
};
type Occupation = {
  soc_code: string;
  occupation: string;
  observation_count: number;
};
type Series = {
  estimate_code: string;
  series_title: string;
  estimate_text: string;
  category: string;
  datatype: string;
  occupation_count: number;
};
type Observation = {
  series_id: string;
  soc_code: string;
  occupation: string;
  requirement?: string;
  category?: string;
  estimate_code: string;
  estimate_text: string;
  datatype?: string;
  estimate_raw: string;
  standard_error_raw: string;
  footnote_raw: string;
  source_sheet: string;
  source_row: number;
  footnotes?: { code: string; text: string }[];
};
type SeriesResponse = {
  items: Observation[];
  total: number;
  reference_year: number;
  category?: string;
  estimate_text?: string;
  datatype?: string;
  provenance?: { workbook: string; sheet: string; source: string };
};
type StrengthRow = {
  soc_code: string;
  occupation: string;
  categories: Record<string, Observation>;
};
type ApiError = { error?: { message?: string } };

const NAV = [
  { id: "overview", label: "Overview", icon: Compass, group: "Atlas" },
  {
    id: "explore",
    label: "Work landscape",
    icon: ChartNoAxesCombined,
    group: "Atlas",
  },
  { id: "occupations", label: "Occupations", icon: Users, group: "Atlas" },
  { id: "anatomy", label: "Anatomy lab", icon: Activity, group: "Research" },
  {
    id: "movement-lab",
    label: "Movement lab",
    icon: MoveUpRight,
    group: "Research",
  },
  {
    id: "compare",
    label: "Compare work",
    icon: ArrowLeftRight,
    group: "Research",
  },
  {
    id: "physical-demands",
    label: "Physical demands",
    icon: MoveUpRight,
    group: "Research",
  },
  { id: "strength", label: "Strength", icon: Gauge, group: "Research" },
  { id: "environment", label: "Environment", icon: Layers3, group: "Research" },
  {
    id: "fatal-injuries",
    label: "Fatal injuries",
    icon: HeartPulse,
    group: "Research",
  },
  { id: "events", label: "Event explorer", icon: Boxes, group: "Research" },
  {
    id: "relationships",
    label: "Relationships",
    icon: FlaskConical,
    group: "Analysis",
  },
  { id: "trends", label: "Trends", icon: BarChart3, group: "Analysis" },
  { id: "data", label: "Data browser", icon: Database, group: "Analysis" },
  { id: "methodology", label: "Methodology", icon: BookOpen, group: "About" },
  { id: "sources", label: "Sources", icon: FileSearch, group: "About" },
  { id: "about", label: "About", icon: CircleHelp, group: "About" },
];
const REGIONS = ["Shoulders", "Arms & hands", "Neck", "Trunk", "Legs & feet"];
const MAP: Record<string, string[]> = {
  Shoulders: ["Reaching overhead", "Reaching at or below shoulder level"],
  "Arms & hands": ["Fine manipulation", "Gross manipulation", "Handling"],
  Neck: ["No direct anatomical measurement in ORS"],
  Trunk: ["Stooping", "Lifting", "Carrying", "Sitting"],
  "Legs & feet": ["Standing", "Walking", "Kneeling", "Crouching"],
};
const FATAL_PAGES = new Set([
  "fatal-injuries",
  "events",
  "relationships",
  "trends",
]);

async function api<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/v1/${path}`, { signal });
  const data = (await response.json()) as T & ApiError;
  if (!response.ok)
    throw new Error(
      data.error?.message || `Request failed (${response.status})`,
    );
  return data;
}
function num(value: string): number | null {
  const normalized = value.trim().replaceAll(",", "");
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const valueAsNumber = Number(normalized);
  return Number.isFinite(valueAsNumber) ? valueAsNumber : null;
}
function csvDownload(
  name: string,
  columns: string[],
  rows: (string | number | null | undefined)[][],
) {
  const quote = (value: string | number | null | undefined) =>
    `"${String(value ?? "").replaceAll('"', '""')}"`;
  const content = [columns, ...rows]
    .map((row) => row.map(quote).join(","))
    .join("\r\n");
  const href = URL.createObjectURL(
    new Blob([content], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 1500);
}
async function fetchSeriesRows(
  code: string,
  requirement: string,
  term: string,
): Promise<Observation[]> {
  const all: Observation[] = [];
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const page = await api<SeriesResponse>(
      `series/${code}?requirement=${encodeURIComponent(requirement)}&q=${encodeURIComponent(term)}&limit=500&offset=${offset}`,
    );
    all.push(...page.items);
    total = page.total;
    offset += page.items.length;
    if (!page.items.length) break;
  }
  return all;
}
async function fetchStrengthRows(
  term: string,
): Promise<{ rows: StrengthRow[]; categories: string[] }> {
  const rows: StrengthRow[] = [];
  let offset = 0;
  let total = Infinity;
  let categories: string[] = [];
  while (offset < total) {
    const page = await api<{
      items: StrengthRow[];
      total: number;
      categories: string[];
    }>(`strength?q=${encodeURIComponent(term)}&limit=200&offset=${offset}`);
    rows.push(...page.items);
    total = page.total;
    categories = page.categories;
    offset += page.items.length;
    if (!page.items.length) break;
  }
  return { rows, categories };
}
function SourceStamp({
  year = 2023,
  source = "BLS · ORS",
}: {
  year?: number;
  source?: string;
}) {
  return (
    <span className="source-stamp">
      <span className="live-dot" />
      {source}
      <i>·</i>
      {year}
    </span>
  );
}
function Panel({
  title,
  meta,
  children,
  className = "",
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-head">
        <h2>{title}</h2>
        {meta && <span>{meta}</span>}
      </header>
      {children}
    </section>
  );
}
function PageHead({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow: string;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {action}
    </div>
  );
}
function EmptyState({
  title,
  body,
  source = "BLS CFOI · 2024",
  href,
}: {
  title: string;
  body: string;
  source?: string;
  href?: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Database size={18} />
      </div>
      <div>
        <h3>{title}</h3>
        <p>{body}</p>
        {href && (
          <a href={href} target="_blank" rel="noreferrer">
            Open official source <ExternalLink size={12} />
          </a>
        )}
      </div>
      <span className="empty-source">{source} · UNAVAILABLE</span>
    </div>
  );
}
function TableLoading({
  label = "Loading official observations…",
}: {
  label?: string;
}) {
  return (
    <div className="table-loading">
      <span className="spinner" />
      {label}
    </div>
  );
}
function OccupationSearch({
  onSelect,
  compact = false,
}: {
  onSelect: (item: Occupation) => void;
  compact?: boolean;
}) {
  const [term, setTerm] = useState("");
  const [items, setItems] = useState<Occupation[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (term.trim().length < 2) {
      setItems([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      api<{ items: Occupation[] }>(
        `occupations?q=${encodeURIComponent(term)}&limit=12`,
        controller.signal,
      )
        .then((result) => {
          setItems(result.items);
          setOpen(true);
        })
        .catch((error) => {
          if (error.name !== "AbortError") setItems([]);
        })
        .finally(() => setLoading(false));
    }, 160);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);
  return (
    <div className={`occupation-search ${compact ? "compact" : ""}`}>
      <Search size={16} aria-hidden="true" />
      <input
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        onFocus={() => items.length && setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if (event.key === "Enter" && items[0]) onSelect(items[0]);
        }}
        placeholder={
          compact ? "Find occupation…" : "Search occupation or SOC code"
        }
        aria-label="Search occupations"
      />
      {loading && <span className="search-loading" />}
      {open && items.length > 0 && (
        <div className="search-popover" role="listbox">
          {items.map((item) => (
            <button
              key={item.soc_code}
              role="option"
              aria-selected="false"
              onClick={() => {
                onSelect(item);
                setOpen(false);
                setTerm("");
              }}
            >
              <span>
                <strong>{item.occupation}</strong>
                <small>2018 SOC {item.soc_code}</small>
              </span>
              <em>ORS 2023</em>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const route = () =>
    location.hash.replace(/^#\/?/, "").split("?")[0] || "overview";
  const [current, setCurrent] = useState(route);
  const [health, setHealth] = useState<Health | null>(null);
  const [theme, setTheme] = useState(
    localStorage.getItem("jra-theme") || "dark",
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Occupation | null>(() => {
    try {
      const saved = localStorage.getItem("jra-selected-occupation");
      return saved ? (JSON.parse(saved) as Occupation) : null;
    } catch {
      return null;
    }
  });
  const [compare, setCompare] = useState<Occupation[]>(() => {
    try {
      const saved = localStorage.getItem("jra-compare");
      return saved ? (JSON.parse(saved) as Occupation[]) : [];
    } catch {
      return [];
    }
  });
  const go = useCallback((id: string) => {
    location.hash = id;
    setCurrent(id);
    setMobileOpen(false);
  }, []);
  useEffect(() => {
    const onHash = () => setCurrent(route());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("jra-theme", theme);
  }, [theme]);
  useEffect(() => {
    api<Health>("health")
      .then(setHealth)
      .catch(() =>
        setHealth({
          status: "offline",
          ors_2023_ready: false,
          cfoi_2024_ready: false,
        }),
      );
  }, []);
  useEffect(() => {
    const searchCompare = new URLSearchParams(location.search).get("compare");
    const hashQuery = location.hash.includes("?")
      ? location.hash.split("?")[1]
      : "";
    const hashCompare = new URLSearchParams(hashQuery).get("compare");
    const raw = searchCompare || hashCompare || "";
    const codes = Array.from(
      new Set(
        raw
          .split(",")
          .map((code) => code.replace("-", "").trim())
          .filter((code) => /^\d{6}$/.test(code)),
      ),
    ).slice(0, 6);
    if (!codes.length) return;
    Promise.all(
      codes.map((code) =>
        api<Occupation>(`occupations/${code}`).catch(() => null),
      ),
    ).then((rows) => {
      const items = rows.filter((item): item is Occupation => item !== null);
      if (items.length) {
        setCompare(items);
        localStorage.setItem("jra-compare", JSON.stringify(items));
      }
    });
  }, [current]);
  const setOccupation = (item: Occupation) => {
    setSelected(item);
    localStorage.setItem("jra-selected-occupation", JSON.stringify(item));
    go(`occupation/${item.soc_code}`);
  };
  const toggleCompare = (item: Occupation) => {
    const next = compare.some((entry) => entry.soc_code === item.soc_code)
      ? compare.filter((entry) => entry.soc_code !== item.soc_code)
      : [...compare, item].slice(-6);
    setCompare(next);
    localStorage.setItem("jra-compare", JSON.stringify(next));
  };
  const shareCompare = async () => {
    const url = new URL(location.href);
    url.searchParams.set(
      "compare",
      compare.map((item) => item.soc_code).join(","),
    );
    url.hash = "compare";
    try {
      await navigator.clipboard.writeText(url.toString());
      setNotice("Comparison link copied.");
    } catch {
      setNotice(url.toString());
    }
  };
  const occupationRoute = /^occupation\/(\d{6})$/.exec(current);
  const routeId = occupationRoute ? "occupations" : current.split("/")[0];
  const navItem = NAV.find((item) => item.id === routeId);
  const showCfoi = FATAL_PAGES.has(routeId);
  const statusText = !health
    ? "Checking releases"
    : health.ors_2023_ready
      ? "ORS 2023 ready"
      : "ORS source missing";
  const mobileLinks = NAV.filter((item) =>
    ["overview", "explore", "anatomy", "fatal-injuries", "data"].includes(
      item.id,
    ),
  );

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <a className="brand" href="#overview" onClick={() => go("overview")}>
          <span className="brand-symbol">
            <Activity size={20} strokeWidth={1.5} />
          </span>
          <span>
            JOB RISK
            <br />
            <b>ATLAS</b>
          </span>
          <span className="brand-version">
            FIELD NOTES
            <br />
            NO. 01 / US
          </span>
        </a>
        <div className="nav-scroller">
          {["Atlas", "Research", "Analysis", "About"].map((group) => (
            <div className="nav-group" key={group}>
              <div className="nav-group-title">{group}</div>
              {NAV.filter((item) => item.group === group).map((item) => {
                const Icon = item.icon;
                const active = item.id === routeId;
                return (
                  <a
                    key={item.id}
                    className={`nav-item ${active ? "active" : ""}`}
                    href={`#${item.id}`}
                    onClick={() => {
                      go(item.id);
                    }}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon size={16} strokeWidth={1.8} />
                    <span>{item.label}</span>
                    {item.id === "fatal-injuries" && (
                      <span className="nav-status">—</span>
                    )}
                  </a>
                );
              })}
            </div>
          ))}
        </div>
        <div className="sidebar-foot">
          <span
            className={`status-led ${health?.ors_2023_ready ? "ready" : ""}`}
          />
          <span className="status-label">DATA STATUS</span>
          <strong>{statusText}</strong>
          <a href="#sources">
            Source notes <ArrowRight size={12} />
          </a>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <button
            className="mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X /> : <Menu />}
          </button>
          <div className="breadcrumbs">
            <span>ATLAS</span>
            <i>/</i>
            <b>
              {occupationRoute
                ? selected?.occupation || "Occupation profile"
                : navItem?.label || "Overview"}
            </b>
          </div>
          <div className="topbar-actions">
            <OccupationSearch compact onSelect={setOccupation} />
            <button
              className="theme-button"
              aria-label="Toggle color theme"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>
        <div className="content-wrap">
          {showCfoi && (
            <div className="data-alert">
              <Shield size={14} />
              <span>
                <b>CFOI 2024 is not loaded.</b> Official workbook access is
                blocked here; this workspace does not show fabricated figures.
              </span>
              <a
                href="https://www.bls.gov/iif/fatal-injuries-tables.htm"
                target="_blank"
                rel="noreferrer"
              >
                BLS releases <ExternalLink size={12} />
              </a>
            </div>
          )}
          {occupationRoute ? (
            <OccupationPage
              code={occupationRoute[1]}
              selected={selected}
              setOccupation={setOccupation}
              onCompare={toggleCompare}
              compare={compare}
            />
          ) : routeId === "overview" ? (
            <Overview health={health} />
          ) : routeId === "explore" ? (
            <ExplorePage onSelect={setOccupation} />
          ) : routeId === "occupations" ? (
            <OccupationsPage onSelect={setOccupation} />
          ) : routeId === "physical-demands" ? (
            <SeriesPage domain="Physical demands" />
          ) : routeId === "environment" ? (
            <SeriesPage domain="Environmental conditions" />
          ) : routeId === "strength" ? (
            <StrengthPage onSelect={setOccupation} />
          ) : routeId === "anatomy" ? (
            <AnatomyPage selected={selected} />
          ) : routeId === "movement-lab" ? (
            <MovementPage />
          ) : routeId === "compare" ? (
            <ComparePage
              occupations={compare}
              onAdd={toggleCompare}
              onRemove={toggleCompare}
              onShare={shareCompare}
            />
          ) : routeId === "data" ? (
            <DataPage onSelect={setOccupation} />
          ) : routeId === "methodology" ||
            routeId === "sources" ||
            routeId === "about" ? (
            <DocsPage id={routeId} />
          ) : FATAL_PAGES.has(routeId) ? (
            <UnavailablePage id={routeId} />
          ) : (
            <Overview health={health} />
          )}
        </div>
      </main>
      <nav className="mobile-nav" aria-label="Primary">
        {mobileLinks.map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.id}
              className={routeId === item.id ? "active" : ""}
              href={`#${item.id}`}
              onClick={() => go(item.id)}
            >
              <Icon size={17} />
              <span>{item.label.replace("Work ", "")}</span>
            </a>
          );
        })}
      </nav>
      {notice && (
        <div
          role="status"
          aria-live="polite"
          className="app-toast"
          onClick={() => setNotice("")}
        >
          {notice}
        </div>
      )}
    </div>
  );
}

function Overview({ health }: { health: Health | null }) {
  const [catalog, setCatalog] = useState<Series[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    api<{ items: Series[] }>(
      "series?requirement=Physical%20demands",
      controller.signal,
    )
      .then((data) => setCatalog(data.items))
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const metrics = [
    {
      label: "ORS observations",
      value: health?.ors_2023_ready ? "128,398" : "—",
      foot: "Final second wave · 2023",
      icon: Database,
    },
    {
      label: "Occupational codes",
      value: health?.ors_2023_ready ? "500" : "—",
      foot: "2018 SOC · includes aggregates",
      icon: Users,
    },
    {
      label: "Requirement series",
      value: catalog.length ? String(catalog.length) : "—",
      foot: "Source-defined physical demands",
      icon: Activity,
    },
    {
      label: "Fatal injury release",
      value: "Unavailable",
      foot: "CFOI 2024 · not acquired",
      icon: HeartPulse,
    },
  ];
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            OCCUPATIONAL RESEARCH INSTRUMENT <span>·</span> UNITED STATES
          </div>
          <h1>
            Work,
            <br />
            <em>examined.</em>
          </h1>
          <p>
            Explore the physical requirements of work through the evidence
            published by the U.S. Bureau of Labor Statistics.
          </p>
          <div className="hero-cta">
            <a className="button button-primary" href="#explore">
              Explore the atlas <ArrowRight size={15} />
            </a>
            <SourceStamp />
          </div>
        </div>
        <div
          className="hero-art"
          aria-label="Abstract occupational movement and measurement illustration"
        >
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="axis axis-x" />
          <div className="axis axis-y" />
          <div className="axis-label axis-label-x">
            OCCUPATIONAL REQUIREMENTS
          </div>
          <div className="axis-label axis-label-y">OBSERVED CONDITIONS</div>
          <div className="figure">
            <span className="figure-head" />
            <span className="figure-body" />
            <span className="figure-arm left" />
            <span className="figure-arm right" />
            <span className="figure-leg left" />
            <span className="figure-leg right" />
          </div>
          <div className="art-point point-a">
            01 <i>REACH</i>
          </div>
          <div className="art-point point-b">
            02 <i>LOAD</i>
          </div>
          <div className="art-caption">
            MEASURED WORK
            <br />
            NOT WORKER RISK
          </div>
        </div>
      </section>
      <div className="metrics-grid">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div className="metric" key={metric.label}>
              <div className="metric-label">
                <Icon size={14} />
                {metric.label}
              </div>
              <strong>{metric.value}</strong>
              <small>{metric.foot}</small>
            </div>
          );
        })}
      </div>
      <div className="overview-grid">
        <Panel
          title="Explore by research question"
          meta="ORS 2023 · SELECT A WORKSPACE"
        >
          <div className="question-list">
            {[
              [
                "01",
                "What physical demands are published?",
                "physical-demands",
                "Movement · posture · handling",
              ],
              [
                "02",
                "How are strength categories distributed?",
                "strength",
                "Five source-defined categories",
              ],
              [
                "03",
                "What conditions are documented?",
                "environment",
                "Only indicators present in the release",
              ],
              [
                "04",
                "How do occupations compare?",
                "compare",
                "Exact SOC classifications · ORS only",
              ],
            ].map(([n, title, link, note]) => (
              <a className="question-row" href={`#${link}`} key={link}>
                <span className="question-number">{n}</span>
                <span>
                  <strong>{title}</strong>
                  <small>{note}</small>
                </span>
                <ArrowRight size={15} />
              </a>
            ))}
          </div>
        </Panel>
        <Panel title="Data coverage" meta="RELEASE STATUS">
          <div className="coverage-card">
            <div className="coverage-head">
              <span className="coverage-year">2023</span>
              <span>
                <b>Occupational Requirements Survey</b>
                <small>Final second-wave release</small>
              </span>
              <span className="coverage-ready">AVAILABLE</span>
            </div>
            <div className="coverage-track">
              <i style={{ width: "100%" }} />
            </div>
            <p>
              Published requirements are available with original estimate
              strings, standard errors, footnotes, and workbook-row references.
            </p>
          </div>
          <div className="coverage-card muted">
            <div className="coverage-head">
              <span className="coverage-year">2024</span>
              <span>
                <b>Census of Fatal Occupational Injuries</b>
                <small>Occupation events and hours-based rates</small>
              </span>
              <span className="coverage-missing">NOT LOADED</span>
            </div>
            <div className="coverage-track">
              <i style={{ width: "0%" }} />
            </div>
            <p>
              Awaiting official BLS workbooks. Fatal injury counts, rates, and
              events are not displayed.
            </p>
            <a
              href="https://www.bls.gov/iif/fatal-injuries-tables.htm"
              target="_blank"
              rel="noreferrer"
            >
              View source release <ExternalLink size={12} />
            </a>
          </div>
        </Panel>
      </div>
      <div className="bottom-note">
        <Shield size={15} />
        <p>
          <b>Interpret the evidence carefully.</b> ORS describes job
          requirements in a covered worker population. CFOI describes observed
          fatal work injuries. These are different datasets, years, and
          populations; they are not linked records and do not establish
          individual risk or causation.
        </p>
        <a href="#methodology">
          Methodology <ArrowRight size={13} />
        </a>
      </div>
    </>
  );
}

function SeriesPage({ domain }: { domain: string }) {
  const [series, setSeries] = useState<Series[]>([]);
  const [code, setCode] = useState("");
  const [items, setItems] = useState<Observation[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api<{ items: Series[] }>(
      `series?requirement=${encodeURIComponent(domain)}`,
      controller.signal,
    )
      .then((data) => {
        setSeries(data.items);
        setCode((current) =>
          data.items.some((item) => item.estimate_code === current)
            ? current
            : data.items[0]?.estimate_code || "",
        );
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [domain]);
  useEffect(() => {
    if (!code) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api<SeriesResponse>(
      `series/${code}?requirement=${encodeURIComponent(domain)}&q=${encodeURIComponent(term)}&limit=100&offset=${offset}`,
      controller.signal,
    )
      .then((data) => {
        setItems(data.items);
        setTotal(data.total);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [code, term, offset, domain]);
  const chosen = series.find((item) => item.estimate_code === code);
  const numeric = useMemo(
    () =>
      items
        .map((item) => ({
          name: item.occupation,
          value: num(item.estimate_raw),
        }))
        .filter(
          (item): item is { name: string; value: number } =>
            item.value !== null,
        )
        .slice(0, 28),
    [items],
  );
  const title =
    domain === "Physical demands"
      ? "Physical requirements"
      : "Environmental conditions";
  return (
    <>
      <PageHead
        eyebrow={`RESEARCH WORKSPACE · ORS ${2023}`}
        title={title}
        text={
          domain === "Physical demands"
            ? "Inspect a source-defined estimate across occupational classifications. Values remain as published, including thresholds and suppressed labels."
            : "Review documented working conditions in the ORS release. The atlas only presents indicators actually published in this workbook."
        }
        action={<SourceStamp />}
      />
      <Panel
        title="Source series explorer"
        meta={`${series.length.toLocaleString()} SOURCE SERIES`}
        className="explorer-panel"
      >
        <div className="explorer-controls">
          <label className="control-label">
            Published measure
            <select
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                setOffset(0);
              }}
              aria-label="Published measure"
            >
              {series.map((item) => (
                <option key={item.estimate_code} value={item.estimate_code}>
                  {item.category} · {item.estimate_text} (
                  {item.occupation_count})
                </option>
              ))}
            </select>
          </label>
          <label className="control-label">
            Filter occupations
            <input
              type="search"
              value={term}
              onChange={(event) => {
                setTerm(event.target.value);
                setOffset(0);
              }}
              placeholder="Occupation or SOC code"
            />
          </label>
          <button
            className="button button-soft"
            disabled={!items.length}
            onClick={async () => {
              const all = await fetchSeriesRows(code, domain, term);
              csvDownload(
                `ors-2023-${code}.csv`,
                [
                  "occupation",
                  "soc_code",
                  "estimate_text",
                  "estimate_raw",
                  "datatype",
                  "standard_error_raw",
                  "footnote_raw",
                  "source_sheet",
                  "source_row",
                ],
                all.map((item) => [
                  item.occupation,
                  item.soc_code,
                  item.estimate_text,
                  item.estimate_raw,
                  item.datatype,
                  item.standard_error_raw,
                  item.footnote_raw,
                  item.source_sheet,
                  item.source_row,
                ]),
              );
            }}
          >
            <Download size={14} /> Export filtered CSV
          </button>
        </div>
        {chosen && (
          <div className="series-summary">
            <span>
              <b>{chosen.category}</b>
              <small>{chosen.estimate_text}</small>
            </span>
            <span>
              <b>{chosen.datatype}</b>
              <small>Published unit</small>
            </span>
            <span>
              <b>{chosen.occupation_count.toLocaleString()}</b>
              <small>Classifications with observations</small>
            </span>
            <span>
              <b>2018 SOC</b>
              <small>Classification</small>
            </span>
          </div>
        )}
        {loading ? (
          <TableLoading />
        ) : error ? (
          <div className="inline-error">{error}</div>
        ) : (
          <>
            {numeric.length > 2 && (
              <div className="chart-block">
                <div className="chart-title">
                  <span>Numeric observations on this page</span>
                  <small>
                    Raw numeric values only · other published labels remain in
                    the table
                  </small>
                </div>
                <div className="chart-wrap">
                  <Suspense fallback={<TableLoading label="Loading chart…" />}>
                    <EstimateBarChart data={numeric} />
                  </Suspense>
                </div>
              </div>
            )}
            <ObservationTable
              rows={items}
              onOccupation={(item) => {
                location.hash = `occupation/${item.soc_code}`;
              }}
            />
            <Pagination
              total={total}
              offset={offset}
              count={items.length}
              setOffset={setOffset}
            />
          </>
        )}
        <p className="panel-footnote">
          Source: BLS ORS final second-wave 2023 workbook. Original estimate
          strings and standard errors are retained. A missing observation is not
          zero.{" "}
          <a
            href="https://www.bls.gov/ors/data.htm"
            target="_blank"
            rel="noreferrer"
          >
            Release documentation <ExternalLink size={11} />
          </a>
        </p>
      </Panel>
    </>
  );
}

function ObservationTable({
  rows,
  onOccupation,
}: {
  rows: Observation[];
  onOccupation: (row: Observation) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Occupation · 2018 SOC</th>
            <th>Published estimate</th>
            <th>Type</th>
            <th>Standard error</th>
            <th>Footnote</th>
            <th>Source row</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={row.series_id}>
                <td>
                  <button
                    className="text-link"
                    onClick={() => onOccupation(row)}
                  >
                    {row.occupation}
                  </button>
                  <small>{row.soc_code}</small>
                </td>
                <td className="number-cell">
                  {row.estimate_raw || "—"}
                  <small>{row.estimate_text}</small>
                </td>
                <td>{row.datatype || "—"}</td>
                <td>{row.standard_error_raw || "—"}</td>
                <td>
                  {row.footnote_raw || "—"}
                  {row.footnotes?.map((note) => (
                    <small key={note.code}>
                      {note.code}: {note.text}
                    </small>
                  ))}
                </td>
                <td>
                  <small>
                    {row.source_sheet} · {row.source_row}
                  </small>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6} className="empty-row">
                No published observation matches this filter. Missing data is
                not zero.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
function Pagination({
  total,
  offset,
  count,
  setOffset,
}: {
  total: number;
  offset: number;
  count: number;
  setOffset: (value: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        {total
          ? `${(offset + 1).toLocaleString()}–${Math.min(offset + count, total).toLocaleString()} of ${total.toLocaleString()}`
          : "No records"}
      </span>
      <div>
        <button
          className="button button-soft"
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - 100))}
        >
          <ChevronLeft size={14} />
          Previous
        </button>
        <button
          className="button button-soft"
          disabled={offset + count >= total}
          onClick={() => setOffset(offset + 100)}
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function StrengthPage({ onSelect }: { onSelect: (item: Occupation) => void }) {
  const [rows, setRows] = useState<StrengthRow[]>([]);
  const [term, setTerm] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api<{ items: StrengthRow[]; total: number; categories: string[] }>(
      `strength?q=${encodeURIComponent(term)}&limit=100&offset=${offset}`,
      controller.signal,
    )
      .then((data) => {
        setRows(data.items);
        setTotal(data.total);
        setCategories(data.categories);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [term, offset]);
  const labelEndings = [
    "sedentary",
    "light work",
    "medium work",
    "heavy work",
    "very heavy work",
  ];
  const selectedCategories = labelEndings.map(
    (suffix) =>
      categories.find((label) => label.toLowerCase().endsWith(suffix)) || "",
  );
  return (
    <>
      <PageHead
        eyebrow="RESEARCH WORKSPACE · ORS 2023"
        title="Strength requirements"
        text="Review the five BLS-published strength categories across occupations. Estimates remain source text; no numeric strength score is inferred."
        action={<SourceStamp />}
      />
      <Panel
        title="Occupational strength distribution"
        meta="PUBLISHED CATEGORIES · NO COMPOSITE SCORE"
        className="explorer-panel"
      >
        <div className="explorer-controls">
          <label className="control-label">
            Filter occupations
            <input
              type="search"
              value={term}
              onChange={(event) => {
                setTerm(event.target.value);
                setOffset(0);
              }}
              placeholder="Occupation or SOC code"
            />
          </label>
          <button
            className="button button-soft"
            disabled={!rows.length}
            onClick={async () => {
              const all = await fetchStrengthRows(term);
              csvDownload(
                "ors-2023-strength.csv",
                [
                  "occupation",
                  "soc_code",
                  ...all.categories.flatMap((label) => [
                    `${label} estimate`,
                    `${label} standard error`,
                    `${label} footnote`,
                    `${label} source row`,
                  ]),
                ],
                all.rows.map((row) => [
                  row.occupation,
                  row.soc_code,
                  ...all.categories.flatMap((label) => {
                    const cell = row.categories[label];
                    return [
                      cell?.estimate_raw,
                      cell?.standard_error_raw,
                      cell?.footnote_raw,
                      cell?.source_row,
                    ];
                  }),
                ]),
              );
            }}
          >
            <Download size={14} /> Export filtered CSV
          </button>
        </div>
        {loading ? (
          <TableLoading />
        ) : (
          <>
            <div className="table-wrap">
              <table className="strength-table">
                <thead>
                  <tr>
                    <th>Occupation · 2018 SOC</th>
                    {selectedCategories.map((label, index) => (
                      <th key={label || index}>
                        {
                          [
                            "Sedentary",
                            "Light",
                            "Medium",
                            "Heavy",
                            "Very heavy",
                          ][index]
                        }
                        <small>{label || "Not published"}</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.soc_code}>
                      <td>
                        <button
                          className="text-link"
                          onClick={() =>
                            onSelect({
                              soc_code: row.soc_code,
                              occupation: row.occupation,
                              observation_count: 0,
                            })
                          }
                        >
                          {row.occupation}
                        </button>
                        <small>{row.soc_code}</small>
                      </td>
                      {selectedCategories.map((label) => {
                        const cell = row.categories[label];
                        return (
                          <td key={label} className="number-cell">
                            {cell?.estimate_raw ?? "—"}
                            <small>
                              {cell
                                ? `SE ${cell.standard_error_raw || "—"} · row ${cell.source_row}`
                                : "Not published"}
                            </small>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {!rows.length && (
                    <tr>
                      <td colSpan={6} className="empty-row">
                        No published strength records match that search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              total={total}
              offset={offset}
              count={rows.length}
              setOffset={setOffset}
            />
          </>
        )}
        <p className="panel-footnote">
          Percentages may not sum to 100 because of rounding, suppression, or
          unpublished categories. Original values and source rows are retained.
        </p>
      </Panel>
    </>
  );
}

function OccupationPage({
  code,
  selected,
  setOccupation,
  onCompare,
  compare,
}: {
  code: string;
  selected: Occupation | null;
  setOccupation: (item: Occupation) => void;
  onCompare: (item: Occupation) => void;
  compare: Occupation[];
}) {
  const [profile, setProfile] = useState<Occupation | null>(null);
  const [rows, setRows] = useState<Observation[]>([]);
  const [category, setCategory] = useState("Physical demands");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    Promise.all([
      api<Occupation & { reference_year: number }>(
        `occupations/${code}`,
        controller.signal,
      ),
      api<SeriesResponse>(
        `occupations/${code}/requirements?requirement=${encodeURIComponent(category)}&limit=200`,
        controller.signal,
      ),
    ])
      .then(([p, data]) => {
        setProfile(p);
        setRows(data.items);
        if (!selected || selected.soc_code !== code) setOccupation(p);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [code, category]);
  const item = profile || selected;
  const inCompare = compare.some((entry) => entry.soc_code === code);
  return (
    <>
      <PageHead
        eyebrow="OCCUPATION PROFILE · 2018 SOC"
        title={item?.occupation || "Occupation profile"}
        text="Source observations from the Occupational Requirements Survey, reference year 2023. ORS describes covered jobs, not individual capabilities or injuries."
        action={
          <button
            className={`button ${inCompare ? "button-selected" : "button-primary"}`}
            disabled={!item}
            onClick={() => item && onCompare(item)}
          >
            {inCompare ? <Check size={15} /> : <ArrowLeftRight size={15} />}
            {inCompare ? "In comparison" : "Add to comparison"}
          </button>
        }
      />
      <div className="profile-meta">
        <span>
          <b>2018 SOC</b>
          {code}
        </span>
        <span>
          <b>Dataset</b>ORS · 2023
        </span>
        <span>
          <b>Fatal injury data</b>Unavailable
        </span>
        <span>
          <b>Match status</b>No CFOI crosswalk
        </span>
      </div>
      <Panel
        title="Published occupational requirements"
        meta={`${rows.length.toLocaleString()} OBSERVATIONS`}
      >
        <div className="tab-row">
          {[
            "Physical demands",
            "Environmental conditions",
            "Education, training, and experience",
            "Cognitive and mental requirements",
          ].map((name) => (
            <button
              key={name}
              className={category === name ? "active" : ""}
              onClick={() => setCategory(name)}
            >
              {name}
            </button>
          ))}
        </div>
        {loading ? (
          <TableLoading />
        ) : error ? (
          <EmptyState
            title="Occupation record unavailable"
            body={error}
            source="BLS ORS · 2023"
            href="https://www.bls.gov/ors/data.htm"
          />
        ) : (
          <ObservationTable rows={rows} onOccupation={() => {}} />
        )}
        <p className="panel-footnote">
          Threshold, range, and suppression labels remain as published.
          Estimates are not converted to midpoints. CFOI comparisons are not
          available for this classification.
        </p>
      </Panel>
      <div className="two-column">
        <Panel title="Interpretation" meta="READ BEFORE COMPARING">
          <p className="prose">
            ORS estimates describe requirements in the survey’s covered worker
            population. They do not measure personal capability, ergonomic load,
            injury prevalence, or health outcomes.
          </p>
          <p className="prose">
            Occupation codes use the 2018 Standard Occupational Classification.
            The same code in another source would not by itself prove matching
            population coverage.
          </p>
        </Panel>
        <Panel title="Fatal injury record" meta="CFOI · 2024">
          <EmptyState
            title="No matched fatal injury statistics"
            body="The CFOI workbooks have not been acquired or reconciled to ORS classifications. This unavailable state is not a zero count or rate."
          />
        </Panel>
      </div>
    </>
  );
}

function AnatomyPage({ selected }: { selected: Occupation | null }) {
  const [region, setRegion] = useState(REGIONS[0]);
  const mapping = MAP[region];
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(false);
  const regionTerms: Record<string, string[]> = {
    Shoulders: ["reaching overhead", "reaching at or below shoulder"],
    "Arms & hands": ["fine manipulation", "gross manipulation", "handling"],
    Neck: [],
    Trunk: ["stooping", "lifting", "carrying", "sitting"],
    "Legs & feet": ["standing", "walking", "kneeling", "crouching", "crawling"],
  };
  useEffect(() => {
    if (!selected) {
      setObservations([]);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    api<SeriesResponse>(
      `occupations/${selected.soc_code}/requirements?requirement=Physical%20demands&limit=200`,
      controller.signal,
    )
      .then((data) => {
        const terms = regionTerms[region];
        setObservations(
          data.items.filter((row) =>
            terms.some((term) =>
              row.estimate_text.toLowerCase().includes(term),
            ),
          ),
        );
      })
      .catch(() => setObservations([]))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [region, selected?.soc_code]);
  const mapPaths = [
    "M78 75Q120 59 162 75L154 118Q120 133 86 118Z",
    "M77 81 54 96 37 180 26 253 56 263 82 186 102 138M163 81 186 96 203 180 214 253 184 263 158 186 138 138",
    "M101 58h38v30h-38z",
    "M91 117h58v70H91z",
    "M91 184h58l15 185h-32l-12-105-13 105H73z",
  ];
  return (
    <>
      <PageHead
        eyebrow="SIGNATURE EXPLORER · ILLUSTRATIVE"
        title="Work and the body"
        text="Use body regions as a lens for exploring published job activities. These links are editorial groupings, not measured anatomy, injury, or biomechanical load."
        action={<SourceStamp />}
      />
      <div className="anatomy-layout">
        <Panel
          title="Interactive body map"
          meta="SCHEMATIC MODEL · DRAG TO ROTATE"
          className="body-panel"
        >
          <div className="body-stage">
            <div className="body-coordinate coord-top">
              ILLUSTRATIVE MODEL <span>FIG. 01</span>
            </div>
            <Suspense
              fallback={
                <div className="canvas-fallback">
                  <span className="spinner" />
                  Loading 3D view…
                </div>
              }
            >
              <BodyScene selected={region} onSelect={setRegion} />
            </Suspense>
            <div className="body-coordinate coord-bottom">
              REGION SELECTED{" "}
              <span>
                {String(REGIONS.indexOf(region) + 1).padStart(2, "0")} / 05
              </span>
            </div>
          </div>
          <div className="region-selector">
            {REGIONS.map((name, index) => (
              <button
                key={name}
                className={region === name ? "selected" : ""}
                onClick={() => setRegion(name)}
              >
                <span>0{index + 1}</span>
                {name}
              </button>
            ))}
          </div>
          <details className="map-fallback">
            <summary>Open the 2D accessible map</summary>
            <div className="fallback-map">
              <svg
                className="human-map"
                viewBox="0 0 240 400"
                role="img"
                aria-label="Illustrative human body diagram with selectable regions"
              >
                <g className="human-outline">
                  <circle cx="120" cy="40" r="23" />
                  <path d="M100 66Q120 59 140 66L157 81 148 154Q144 173 140 187L151 244 164 365Q165 376 153 376H139Q133 376 132 366L120 264 108 366Q107 376 95 376H80Q69 376 72 365L85 244 98 187Q94 172 90 154L82 81Z" />
                  <path d="M83 82 62 94 48 177 31 251Q28 262 38 265Q47 267 51 257L75 192 100 133M157 82 178 94 192 177 209 251Q212 262 202 265Q193 267 189 257L165 192 140 133" />
                </g>
                <g className="region-hotspots">
                  {REGIONS.map((name, index) => (
                    <path
                      key={name}
                      className={region === name ? "chosen" : ""}
                      onClick={() => setRegion(name)}
                      role="button"
                      tabIndex={0}
                      aria-label={`Select ${name}`}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setRegion(name);
                        }
                      }}
                      d={mapPaths[index]}
                    />
                  ))}
                </g>
              </svg>
            </div>
          </details>
        </Panel>
        <div className="anatomy-side">
          <Panel title={region} meta="ACTIVITY ASSOCIATIONS">
            <p className="prose">
              Potentially related ORS requirement labels. The association helps
              navigate source data and should not be interpreted as a measured
              anatomical demand.
            </p>
            <div className="mapping-list">
              {mapping.map((label, index) => (
                <div key={label}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{label}</strong>
                  <ArrowRight size={13} />
                </div>
              ))}
            </div>
            {selected ? (
              <>
                <a
                  className="button button-primary full-width"
                  href={`#occupation/${selected.soc_code}`}
                >
                  Inspect {selected.occupation}
                  <ArrowRight size={14} />
                </a>
                <div className="region-observations">
                  <div className="eyebrow">
                    {selected.occupation} · ORS 2023
                  </div>
                  {loading ? (
                    <TableLoading label="Loading mapped observations…" />
                  ) : observations.length ? (
                    observations.slice(0, 8).map((row) => (
                      <div key={row.series_id}>
                        <span>{row.estimate_text}</span>
                        <b>{row.estimate_raw || "—"}</b>
                        <small>
                          {row.datatype} · row {row.source_row}
                        </small>
                      </div>
                    ))
                  ) : (
                    <p className="micro-note">
                      No matching published physical-demand label for this
                      occupation and region. This is unavailable data, not a
                      zero value.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="selection-hint">
                <Search size={14} /> Search an occupation to inspect its
                published ORS observations.
              </div>
            )}
          </Panel>
          <Panel title="Method note" meta="SCOPE">
            <p className="prose">
              The ORS does not measure muscle activity, joint forces, spinal
              compression, or body-region injury. Selecting a region cannot
              establish a worker’s exposure or health outcome.
            </p>
            <a className="inline-link" href="#methodology">
              Read anatomical mapping method <ArrowRight size={13} />
            </a>
          </Panel>
        </div>
      </div>
    </>
  );
}

function MovementPage() {
  const [activity, setActivity] = useState<"reach" | "stoop" | "lift">("reach");
  const [phase, setPhase] = useState(35);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () => setPhase((value) => (value >= 100 ? 0 : value + 1)),
      65,
    );
    return () => clearInterval(timer);
  }, [playing]);
  const label =
    activity === "reach"
      ? "Reaching overhead"
      : activity === "stoop"
        ? "Stooping and crouching"
        : "Lifting or carrying";
  const t = phase / 100;
  const shoulderY =
    activity === "reach"
      ? 89 - 55 * t
      : activity === "stoop"
        ? 89 + 28 * t
        : 89 + 20 * t;
  const handY =
    activity === "reach"
      ? 135 - 100 * t
      : activity === "stoop"
        ? 140 + 38 * t
        : 142 + 20 * t;
  const trunkTilt =
    activity === "stoop" ? 26 * t : activity === "lift" ? 8 * t : 0;
  return (
    <>
      <PageHead
        eyebrow="MOVEMENT LAB · ILLUSTRATIVE"
        title="A movement, in context"
        text="Explore a simple kinematic illustration of selected activity labels. The motion is schematic and does not represent measured force, exposure, or a recommended technique."
        action={<span className="coverage-chip">ILLUSTRATIVE MOTION</span>}
      />
      <div className="movement-layout">
        <Panel
          title={label}
          meta="SCHEMATIC · NOT BIOMECHANICS"
          className="movement-panel"
        >
          <div className="movement-controls">
            {[
              ["reach", "Reach"],
              ["stoop", "Stoop"],
              ["lift", "Lift / carry"],
            ].map(([id, name]) => (
              <button
                key={id}
                className={activity === id ? "active" : ""}
                onClick={() => {
                  setActivity(id as typeof activity);
                  setPhase(35);
                  setPlaying(false);
                }}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="movement-stage">
            <div className="movement-label">
              ACTIVITY FRAME{" "}
              <span>{String(Math.round(t * 100)).padStart(2, "0")}%</span>
            </div>
            <svg
              viewBox="0 0 620 290"
              role="img"
              aria-label={`${label} movement illustration, frame ${phase} percent`}
            >
              <defs>
                <linearGradient id="motionGlow" x1="0" x2="1">
                  <stop stopColor="#83d5c8" stopOpacity=".1" />
                  <stop offset="1" stopColor="#83d5c8" stopOpacity=".75" />
                </linearGradient>
              </defs>
              <path d="M62 242H558" stroke="var(--line)" strokeWidth="1" />
              <path
                d="M145 235C220 206 251 114 310 88S425 81 482 42"
                fill="none"
                stroke="url(#motionGlow)"
                strokeWidth="1"
                strokeDasharray="4 6"
              />
              <g
                transform={`rotate(${trunkTilt} 312 117)`}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle
                  cx="312"
                  cy={shoulderY - 38}
                  r="17"
                  fill="var(--panel)"
                />
                <path
                  d={`M312 ${shoulderY - 20}L312 151M312 ${shoulderY}L${activity === "reach" ? 284 : 274} ${shoulderY + 11}L${activity === "reach" ? 254 : 246} ${handY}M312 ${shoulderY}L340 ${shoulderY + 12}L${activity === "reach" ? 370 : 384} ${activity === "reach" ? handY + 5 : handY}`}
                />
                <path
                  d="M312 151L287 193L276 238M312 151L337 193L350 238"
                  stroke="var(--muted)"
                />
                <circle
                  cx={activity === "reach" ? 254 : 246}
                  cy={handY}
                  r="6"
                  fill="var(--amber)"
                  stroke="none"
                />
                <circle
                  cx={activity === "reach" ? 370 : 384}
                  cy={activity === "reach" ? handY + 5 : handY}
                  r="6"
                  fill="var(--amber)"
                  stroke="none"
                />
              </g>
              {activity === "lift" && (
                <g transform={`translate(0 ${-25 * t})`}>
                  <rect
                    x="221"
                    y="189"
                    width="52"
                    height="42"
                    fill="var(--panel-raised)"
                    stroke="var(--amber)"
                  />
                  <path
                    d="M237 189v-9q0-10 10-10t10 10v9"
                    fill="none"
                    stroke="var(--amber)"
                    strokeWidth="2"
                  />
                </g>
              )}
              <path
                d="M285 238h-22m88 0h22"
                stroke="var(--amber)"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <text
                x="65"
                y="264"
                fill="var(--muted)"
                fontSize="9"
                fontFamily="monospace"
              >
                SCHEMATIC MOVEMENT TRACE · NO FORCE SCALE
              </text>
            </svg>
          </div>
          <div className="movement-toolbar">
            <button
              className="button button-primary"
              onClick={() => setPlaying((value) => !value)}
            >
              {playing ? <Pause size={14} /> : <Play size={14} />}
              {playing ? "Pause motion" : "Play motion"}
            </button>
            <button
              className="button button-soft"
              onClick={() => {
                setPlaying(false);
                setPhase(0);
              }}
            >
              <RotateCcw size={14} />
              Reset
            </button>
            <label className="phase-control">
              Frame
              <input
                type="range"
                min="0"
                max="100"
                value={phase}
                onChange={(event) => {
                  setPhase(Number(event.target.value));
                  setPlaying(false);
                }}
              />
              <span>{phase}%</span>
            </label>
          </div>
          <div className="movement-note">
            <Shield size={14} />
            <span>
              Illustrations are not derived from ORS measurements. The selected
              activity label is the evidence reference; the pose animation is
              conceptual.
            </span>
          </div>
        </Panel>
        <aside className="movement-aside">
          <Panel title="Activity source labels" meta="ORS 2023">
            <div className="mapping-list">
              {MAP["Shoulders"].concat(MAP.Trunk.slice(0, 2)).map((item) => (
                <div key={item}>
                  <span>↗</span>
                  <strong>{item}</strong>
                  <ArrowRight size={13} />
                </div>
              ))}
            </div>
            <a href="#physical-demands" className="inline-link">
              Inspect published activity estimates <ArrowRight size={13} />
            </a>
          </Panel>
          <div className="method-card">
            <Activity size={20} />
            <span className="eyebrow">READ THE MODEL</span>
            <h3>What it can show</h3>
            <p>
              This control demonstrates label changes and body-region
              navigation. It does not estimate range of motion, repetition,
              load, exertion, or injury likelihood.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}

function ExplorePage({ onSelect }: { onSelect: (item: Occupation) => void }) {
  const [catalog, setCatalog] = useState<Series[]>([]);
  const [code, setCode] = useState("");
  const [rows, setRows] = useState<Observation[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api<{ items: Series[] }>("series?requirement=Physical%20demands")
      .then((data) => {
        setCatalog(data.items);
        setCode(data.items[0]?.estimate_code || "");
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!code) return;
    api<SeriesResponse>(`series/${code}?limit=500`)
      .then((data) => setRows(data.items))
      .catch((e) => setError(e.message));
  }, [code]);
  const points = useMemo(
    () =>
      rows
        .map((row) => ({
          x: num(row.estimate_raw),
          y: num(row.standard_error_raw),
          name: row.occupation,
          code: row.soc_code,
        }))
        .filter(
          (p): p is { x: number; y: number; name: string; code: string } =>
            p.x !== null && p.y !== null,
        ),
    [rows],
  );
  const selectedSeries = catalog.find((item) => item.estimate_code === code);
  return (
    <>
      <PageHead
        eyebrow="OCCUPATIONAL LANDSCAPE · ORS 2023"
        title="The work landscape"
        text="Explore one published ORS estimate across occupational classifications. This view describes source estimates; it is not a danger ranking."
        action={<SourceStamp />}
      />
      <Panel
        title="Occupation distribution"
        meta="SOURCE ESTIMATE · ONE MEASURE AT A TIME"
      >
        <div className="explorer-controls">
          <label className="control-label">
            Select a physical-demand measure
            <select
              value={code}
              onChange={(event) => setCode(event.target.value)}
            >
              {catalog.map((item) => (
                <option key={item.estimate_code} value={item.estimate_code}>
                  {item.category} · {item.estimate_text} · {item.datatype}
                </option>
              ))}
            </select>
          </label>
          <span className="coverage-chip">
            {selectedSeries?.occupation_count.toLocaleString() || "—"}{" "}
            occupations
          </span>
        </div>
        {error ? (
          <div className="inline-error">{error}</div>
        ) : points.length > 1 ? (
          <div className="scatter-layout">
            <div className="scatter-chart">
              <Suspense fallback={<TableLoading label="Loading chart…" />}>
                <LandscapeScatter
                  data={points}
                  onSelect={(point) =>
                    onSelect({
                      soc_code: point.code,
                      occupation: point.name,
                      observation_count: 0,
                    })
                  }
                />
              </Suspense>
            </div>
            <div className="chart-aside">
              <span className="eyebrow">READ THE PLOT</span>
              <h3>{selectedSeries?.category}</h3>
              <p>
                {selectedSeries?.estimate_text}{" "}
                <small>· {selectedSeries?.datatype}</small>
              </p>
              <div className="legend-line">
                <i />
                Each mark represents an occupation with a numeric published
                estimate and standard error.
              </div>
              <p className="micro-note">
                Suppressed and threshold values are omitted from this numeric
                plot and remain visible in the source table.
              </p>
              <button
                className="button button-soft"
                onClick={() =>
                  csvDownload(
                    "ors-2023-landscape.csv",
                    ["occupation", "soc_code", "estimate", "standard_error"],
                    points.map((point) => [
                      point.name,
                      point.code,
                      point.x,
                      point.y,
                    ]),
                  )
                }
              >
                <Download size={14} /> Export points
              </button>
            </div>
          </div>
        ) : (
          <EmptyState
            title="No numeric points available"
            body="This measure may only contain suppressed, threshold, or unavailable values. The table values remain available in the physical requirements workspace."
            source="BLS ORS · 2023"
          />
        )}
        <div className="chart-table-link">
          <a href="#physical-demands">
            Open all published values <ArrowRight size={13} />
          </a>
        </div>
      </Panel>
      <div className="bottom-note">
        <Shield size={15} />
        <p>
          Occupation-level observations are not independent worker records. This
          plot does not support individual-level or causal conclusions.
        </p>
        <a href="#methodology">
          Methodology <ArrowRight size={13} />
        </a>
      </div>
    </>
  );
}

function OccupationsPage({
  onSelect,
}: {
  onSelect: (item: Occupation) => void;
}) {
  const [rows, setRows] = useState<Occupation[]>([]);
  const [term, setTerm] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api<{ items: Occupation[]; total: number }>(
      `occupations?q=${encodeURIComponent(term)}&limit=50&offset=${offset}`,
      controller.signal,
    )
      .then((data) => {
        setRows(data.items);
        setTotal(data.total);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [term, offset]);
  return (
    <>
      <PageHead
        eyebrow="DIRECTORY · 2018 SOC"
        title="Occupations"
        text="Search official occupational classifications represented in the ORS 2023 workbook. Dataset coverage varies by occupation; an absent record is not a zero estimate."
        action={<SourceStamp />}
      />
      <Panel
        title="Occupation directory"
        meta={`${total.toLocaleString()} CLASSIFICATIONS`}
      >
        <div className="explorer-controls">
          <label className="control-label">
            Search titles and SOC codes
            <input
              type="search"
              value={term}
              onChange={(event) => {
                setTerm(event.target.value);
                setOffset(0);
              }}
              placeholder="e.g. electrician, truck driver, 47-2061"
            />
          </label>
        </div>
        {loading ? (
          <TableLoading />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Occupation</th>
                    <th>2018 SOC</th>
                    <th>ORS observations</th>
                    <th>Other datasets</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.soc_code}>
                      <td>
                        <button
                          className="text-link"
                          onClick={() => onSelect(row)}
                        >
                          {row.occupation}
                        </button>
                      </td>
                      <td>{row.soc_code}</td>
                      <td>{row.observation_count.toLocaleString()}</td>
                      <td>
                        <span className="status-pill good">ORS 2023</span>
                        <span className="status-pill">CFOI unavailable</span>
                      </td>
                      <td>
                        <button
                          className="icon-action"
                          onClick={() => onSelect(row)}
                          aria-label={`Open ${row.occupation}`}
                        >
                          <ArrowRight size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              total={total}
              offset={offset}
              count={rows.length}
              setOffset={setOffset}
            />
          </>
        )}
      </Panel>
    </>
  );
}

function ComparePage({
  occupations,
  onAdd,
  onRemove,
  onShare,
}: {
  occupations: Occupation[];
  onAdd: (item: Occupation) => void;
  onRemove: (item: Occupation) => void;
  onShare: () => void;
}) {
  const [records, setRecords] = useState<Record<string, Observation[]>>({});
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all(
      occupations.map((item) =>
        api<SeriesResponse>(
          `occupations/${item.soc_code}/requirements?requirement=Physical%20demands&limit=200`,
        )
          .then((data) => [item.soc_code, data.items] as const)
          .catch(() => [item.soc_code, []] as const),
      ),
    )
      .then((result) => {
        if (active) setRecords(Object.fromEntries(result));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [occupations]);
  const keys = useMemo(
    () =>
      Array.from(
        new Set(
          Object.values(records)
            .flat()
            .map((row) => row.estimate_code),
        ),
      ).slice(0, 24),
    [records],
  );
  return (
    <>
      <PageHead
        eyebrow="COMPARISON WORKSPACE · ORS ONLY"
        title="Compare the nature of work"
        text="Compare exact 2018 SOC records using published ORS requirements. CFOI measures cannot be included until a verified crosswalk and source data are available."
        action={
          <div className="head-actions">
            <span className="coverage-chip">
              {occupations.length} / 6 selected
            </span>
            <button
              className="button button-soft"
              onClick={onShare}
              disabled={!occupations.length}
            >
              <Link2 size={14} />
              Copy share link
            </button>
          </div>
        }
      />
      <Panel title="Selected occupations" meta="EXACT OCCUPATION CODES">
        <div className="compare-toolbar">
          <OccupationSearch onSelect={onAdd} />
          <span className="micro-note">
            Select up to six occupations. Parent group statistics are never
            copied to detailed roles.
          </span>
        </div>
        {occupations.length ? (
          <div className="compare-tags">
            {occupations.map((item) => (
              <div className="compare-tag" key={item.soc_code}>
                <span>
                  <b>{item.occupation}</b>
                  <small>2018 SOC {item.soc_code}</small>
                </span>
                <button
                  onClick={() => onRemove(item)}
                  aria-label={`Remove ${item.occupation}`}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="selection-hint">
            <ArrowLeftRight size={15} /> Search and add occupations to begin a
            comparison.
          </div>
        )}
        {loading && <TableLoading />}
        {occupations.length > 0 && !loading && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Requirement series</th>
                  {occupations.map((item) => (
                    <th key={item.soc_code}>
                      {item.occupation}
                      <small>{item.soc_code}</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => {
                  const first = Object.values(records)
                    .flat()
                    .find((row) => row.estimate_code === key);
                  return (
                    <tr key={key}>
                      <td>
                        {first?.category}
                        <small>{first?.estimate_text}</small>
                      </td>
                      {occupations.map((item) => {
                        const row = records[item.soc_code]?.find(
                          (obs) => obs.estimate_code === key,
                        );
                        return (
                          <td key={item.soc_code} className="number-cell">
                            {row?.estimate_raw ?? "—"}
                            <small>
                              {row?.datatype || "No published observation"}
                            </small>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {!keys.length && (
                  <tr>
                    <td colSpan={occupations.length + 1} className="empty-row">
                      No comparable source series are available for these
                      selected classifications.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <div className="bottom-note">
        <Shield size={15} />
        <p>
          Only identical source estimate codes are aligned. Unavailable cells
          remain unavailable. Different units or estimate definitions are never
          averaged or combined.
        </p>
        <a href="#methodology">
          Matching rules <ArrowRight size={13} />
        </a>
      </div>
    </>
  );
}

function DataPage({ onSelect }: { onSelect: (item: Occupation) => void }) {
  const [tab, setTab] = useState("occupations");
  const [series, setSeries] = useState<Series[]>([]);
  const [selectedSeries, setSelectedSeries] = useState("");
  const [rows, setRows] = useState<Observation[]>([]);
  const [term, setTerm] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const requirement =
      tab === "environment" ? "Environmental conditions" : "Physical demands";
    api<{ items: Series[] }>(
      `series?requirement=${encodeURIComponent(requirement)}`,
      controller.signal,
    )
      .then((data) => {
        setSeries(data.items);
        setSelectedSeries(data.items[0]?.estimate_code || "");
      })
      .catch(() => {
        setSeries([]);
        setSelectedSeries("");
      });
    return () => controller.abort();
  }, [tab]);
  useEffect(() => {
    if (!["observations", "environment"].includes(tab) || !selectedSeries)
      return;
    const controller = new AbortController();
    const requirement =
      tab === "environment" ? "Environmental conditions" : "Physical demands";
    api<SeriesResponse>(
      `series/${selectedSeries}?requirement=${encodeURIComponent(requirement)}&q=${encodeURIComponent(term)}&limit=100`,
      controller.signal,
    )
      .then((data) => setRows(data.items))
      .catch(() => setRows([]));
    return () => controller.abort();
  }, [tab, selectedSeries, term]);
  const [occupations, setOccupations] = useState<Occupation[]>([]);
  useEffect(() => {
    if (tab !== "occupations") return;
    const controller = new AbortController();
    api<{ items: Occupation[] }>("occupations?limit=100", controller.signal)
      .then((data) => setOccupations(data.items))
      .catch(() => setOccupations([]));
    return () => controller.abort();
  }, [tab]);
  return (
    <>
      <PageHead
        eyebrow="SOURCE INSPECTOR · ORS 2023"
        title="Data browser"
        text="Inspect occupation classifications and original source observations. Exported values include codes and preserve the published estimate strings."
        action={<SourceStamp />}
      />
      <Panel title="Browse the source records" meta="SOURCE-FAITHFUL VALUES">
        <div className="tab-row">
          {[
            ["occupations", "Occupations"],
            ["observations", "Physical demand observations"],
            ["environment", "Environmental observations"],
            ["coverage", "Coverage & validation"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {["observations", "environment"].includes(tab) && (
          <div className="explorer-controls">
            <label className="control-label">
              Published measure
              <select
                value={selectedSeries}
                onChange={(event) => setSelectedSeries(event.target.value)}
              >
                {series.map((item) => (
                  <option value={item.estimate_code} key={item.estimate_code}>
                    {item.category} · {item.estimate_text}
                  </option>
                ))}
              </select>
            </label>
            <label className="control-label">
              Search records
              <input
                type="search"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Occupation or SOC code"
              />
            </label>
            <button
              className="button button-soft"
              onClick={async () => {
                const requirement =
                  tab === "environment"
                    ? "Environmental conditions"
                    : "Physical demands";
                const all = await fetchSeriesRows(
                  selectedSeries,
                  requirement,
                  term,
                );
                csvDownload(
                  "ors-2023-observations.csv",
                  [
                    "occupation",
                    "soc_code",
                    "estimate_text",
                    "estimate_raw",
                    "datatype",
                    "standard_error_raw",
                    "footnote_raw",
                    "source_sheet",
                    "source_row",
                  ],
                  all.map((row) => [
                    row.occupation,
                    row.soc_code,
                    row.estimate_text,
                    row.estimate_raw,
                    row.datatype,
                    row.standard_error_raw,
                    row.footnote_raw,
                    row.source_sheet,
                    row.source_row,
                  ]),
                );
              }}
            >
              <Download size={14} />
              Export filtered data
            </button>
          </div>
        )}
        {tab === "occupations" ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Occupation</th>
                  <th>2018 SOC</th>
                  <th>Observations</th>
                  <th>Coverage</th>
                </tr>
              </thead>
              <tbody>
                {occupations.map((item) => (
                  <tr key={item.soc_code}>
                    <td>
                      <button
                        className="text-link"
                        onClick={() => onSelect(item)}
                      >
                        {item.occupation}
                      </button>
                    </td>
                    <td>{item.soc_code}</td>
                    <td>{item.observation_count}</td>
                    <td>ORS 2023</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === "observations" || tab === "environment" ? (
          <ObservationTable
            rows={rows}
            onOccupation={(row) =>
              onSelect({
                soc_code: row.soc_code,
                occupation: row.occupation,
                observation_count: 0,
              })
            }
          />
        ) : tab === "coverage" ? (
          <div className="coverage-list">
            <div>
              <Check size={14} />
              <span>
                <b>ORS workbook</b>
                <small>
                  2023 · final second wave · 128,398 observations · 500
                  occupation codes
                </small>
              </span>
              <em>VALIDATED</em>
            </div>
            <div>
              <X size={14} />
              <span>
                <b>CFOI occupation events</b>
                <small>
                  2024 · source URL catalogued; workbook not acquired
                </small>
              </span>
              <em className="missing">UNAVAILABLE</em>
            </div>
            <div>
              <X size={14} />
              <span>
                <b>CFOI hours-based rates</b>
                <small>
                  2024 · official workbook request blocked (HTTP 403)
                </small>
              </span>
              <em className="missing">UNAVAILABLE</em>
            </div>
            <div>
              <ClipboardList size={14} />
              <span>
                <b>ORS source provenance</b>
                <small>
                  Workbook, sheet, row, footnote, source URL, and SHA-256
                  acquisition manifest
                </small>
              </span>
              <em>AVAILABLE</em>
            </div>
          </div>
        ) : null}
      </Panel>
    </>
  );
}

function UnavailablePage({ id }: { id: string }) {
  const config: Record<
    string,
    { title: string; text: string; icon: typeof HeartPulse }
  > = {
    "fatal-injuries": {
      title: "Fatal injury observatory",
      text: "Counts and official hours-based fatal injury rates require the CFOI 2024 occupation tables.",
      icon: HeartPulse,
    },
    events: {
      title: "Event and exposure explorer",
      text: "The CFOI occupation event hierarchy is not loaded. Parent and child event categories will stay separate.",
      icon: Boxes,
    },
    relationships: {
      title: "Statistical relationships",
      text: "This ecological analysis requires compatible ORS estimates, CFOI fatal injury measures, and reviewed occupational matches.",
      icon: FlaskConical,
    },
    trends: {
      title: "Historical fatal injury trends",
      text: "No compatible multi-year CFOI series is loaded. The dashboard will not connect observations across classification or method changes.",
      icon: ChartNoAxesCombined,
    },
  };
  const item = config[id] || config["fatal-injuries"];
  const Icon = item.icon;
  return (
    <>
      <PageHead
        eyebrow="RESEARCH WORKSPACE · AWAITING SOURCE DATA"
        title={item.title}
        text={item.text}
        action={<SourceStamp year={2024} source="BLS · CFOI" />}
      />
      <div className="unavailable-layout">
        <Panel title="Release and analysis status" meta="NO VALUES DISPLAYED">
          <EmptyState
            title="Official CFOI workbook unavailable"
            body="The BLS 2024 workbooks are listed on the official release page, but download requests are returning HTTP 403 in this environment. The endpoint and pipeline are catalogued; this view stays empty until the source files are acquired and validated."
            href="https://www.bls.gov/iif/fatal-injuries-tables.htm"
          />
          <div className="unavailable-actions">
            <a
              className="button button-soft"
              href="https://www.bls.gov/iif/fatal-injuries-tables.htm"
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={14} />
              Open BLS release
            </a>
            <a className="button button-soft" href="#data">
              <Database size={14} />
              View dataset status
            </a>
          </div>
        </Panel>
        <div className="method-card">
          <Icon size={20} />
          <span className="eyebrow">SCIENTIFIC SAFEGUARD</span>
          <h3>Unavailable is not zero</h3>
          <p>
            Fatal counts, published rates, event categories, and cross-source
            correlations are intentionally absent. No rate is calculated from
            unrelated count or employment data.
          </p>
        </div>
      </div>
      <div className="bottom-note">
        <Shield size={15} />
        <p>
          Any future comparison must use verified occupational classifications
          and report population coverage. Occupational associations do not
          establish causation.
        </p>
        <a href="#methodology">
          Methodology <ArrowRight size={13} />
        </a>
      </div>
    </>
  );
}

function DocsPage({ id }: { id: string }) {
  const isSources = id === "sources",
    isAbout = id === "about";
  const title = isSources
    ? "Sources & releases"
    : isAbout
      ? "About Job Risk Atlas"
      : "Methodology & interpretation";
  const text = isSources
    ? "Official BLS releases used by the atlas, their reference years, and current acquisition status."
    : isAbout
      ? "A research interface for investigating what work asks of people, grounded in official occupational data."
      : "Read the ORS and CFOI measures in context. The sources describe different populations and measurement processes.";
  return (
    <>
      <PageHead
        eyebrow={
          isSources
            ? "DATA PROVENANCE"
            : isAbout
              ? "PROJECT"
              : "SCIENTIFIC METHOD"
        }
        title={title}
        text={text}
      />
      <div className="docs-grid">
        <Panel
          title={
            isSources
              ? "Official releases"
              : isAbout
                ? "Project principles"
                : "How to interpret the data"
          }
          meta={
            isSources
              ? "SOURCE LINKS"
              : isAbout
                ? "PURPOSE"
                : "SCIENTIFIC SCOPE"
          }
        >
          {isSources ? (
            <div className="source-list">
              <a
                href="https://www.bls.gov/ors/data.htm"
                target="_blank"
                rel="noreferrer"
              >
                <span>
                  <b>Occupational Requirements Survey</b>
                  <small>
                    Final second wave · reference year 2023 · acquired and
                    materialized
                  </small>
                </span>
                <ExternalLink size={15} />
              </a>
              <a
                href="https://www.bls.gov/iif/fatal-injuries-tables.htm"
                target="_blank"
                rel="noreferrer"
              >
                <span>
                  <b>Census of Fatal Occupational Injuries</b>
                  <small>
                    Occupation by event and hours-based rates · reference year
                    2024 · download blocked
                  </small>
                </span>
                <ExternalLink size={15} />
              </a>
              <a
                href="https://www.bls.gov/soc/"
                target="_blank"
                rel="noreferrer"
              >
                <span>
                  <b>Standard Occupational Classification</b>
                  <small>
                    2018 SOC codes retained from ORS source workbook
                  </small>
                </span>
                <ExternalLink size={15} />
              </a>
            </div>
          ) : (
            <div className="prose-block">
              <h3>
                {isAbout
                  ? "Evidence before ranking"
                  : "ORS describes job requirements"}
              </h3>
              <p>
                {isAbout
                  ? "Job Risk Atlas is designed as an occupational research instrument, not a ranking of dangerous jobs. It makes source coverage visible and keeps published values traceable to their original workbook rows."
                  : "The final second-wave ORS 2023 estimates describe job requirements in its covered worker population. They do not measure individual capacity, biomechanical load, or injury outcomes."}
              </p>
              <h3>
                {isAbout ? "Source status" : "CFOI records fatal work injuries"}
              </h3>
              <p>
                {isAbout
                  ? "ORS 2023 has been acquired and materialized. CFOI 2024 is listed in the acquisition manifest but the official XLSX endpoint returns HTTP 403 in this environment."
                  : "CFOI 2024 counts observed fatal work injuries and provides published hours-based rates. Counts, rates, shares, and individual probabilities are distinct measures."}
              </p>
              <h3>Classification and population coverage</h3>
              <p>
                Occupation names are not sufficient for cross-source matching.
                ORS and CFOI have different reference years and population
                coverage. Parent group statistics are never assigned to detailed
                occupations.
              </p>
              <h3>Body-region mapping</h3>
              <p>
                Anatomical region labels organize activity descriptions for
                browsing. They are illustrative associations, not measured
                anatomical loads, injuries, or individual health assessments.
              </p>
              <h3>Ecological relationships</h3>
              <p>
                Associations between occupational-level measures do not
                establish causation or imply an individual worker’s probability
                of injury.
              </p>
            </div>
          )}
        </Panel>
        <Panel title="Coverage ledger" meta="CURRENT DATA STATE">
          <div className="coverage-ledger">
            <div>
              <span className="led ready" />
              <span>
                <b>ORS final second wave</b>
                <small>2023 · 128,398 observations · local SQLite</small>
              </span>
              <strong>READY</strong>
            </div>
            <div>
              <span className="led off" />
              <span>
                <b>CFOI occupation events</b>
                <small>2024 · no acquired workbook</small>
              </span>
              <strong className="off-text">NOT LOADED</strong>
            </div>
            <div>
              <span className="led off" />
              <span>
                <b>CFOI hours-based rates</b>
                <small>2024 · no acquired workbook</small>
              </span>
              <strong className="off-text">NOT LOADED</strong>
            </div>
            <div>
              <span className="led ready" />
              <span>
                <b>Source provenance</b>
                <small>
                  Acquisition manifest, workbook sheet and row references
                </small>
              </span>
              <strong>READY</strong>
            </div>
          </div>
          <p className="panel-footnote">
            No BLS affiliation or endorsement is implied. Source tables remain
            authoritative.
          </p>
        </Panel>
      </div>
    </>
  );
}

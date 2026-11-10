const { useState, useEffect, useMemo, useRef, Fragment } = React;


// ---------- constantes ----------
const WEEKDAYS = ["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];
const MONTHS = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const CATEGORY_ORDER = ["sopa","carne","peixe","massa","arroz","acomp"];
const CATEGORY_META = {
  sopa:  { label: "Sopas",              color: "#8A5A44" },
  carne: { label: "Pratos de carne",     color: "#8E4A38" },
  peixe: { label: "Pratos de peixe",     color: "#2F6F76" },
  massa: { label: "Pratos de massa",     color: "#C08A2E" },
  arroz: { label: "Pratos de arroz",     color: "#A98B4E" },
  acomp: { label: "Acompanhamentos",     color: "#5C7A5E" },
};
const PRINCIPAL_CATEGORIES = [
  { value: "carne", label: "Carne" },
  { value: "peixe", label: "Peixe" },
  { value: "massa", label: "Massa" },
  { value: "arroz", label: "Arroz" },
];
const ALL_CATEGORY_OPTIONS = ["sopa","carne","peixe","massa","arroz","acomp"].map((c) => ({ value: c, label: { sopa: "Sopa", carne: "Carne", peixe: "Peixe", massa: "Massa", arroz: "Arroz", acomp: "Acompanhamento" }[c] }));

// ---------- helpers ----------
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const normalize = (s) => (s || "").trim().toLowerCase();
const parseDateInput = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const toISO = (date) => { const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, "0"); const d = String(date.getDate()).padStart(2, "0"); return `${y}-${m}-${d}`; };
const buildDateRange = (startStr, endStr) => {
  const start = parseDateInput(startStr), end = parseDateInput(endStr);
  const days = []; let cur = new Date(start);
  while (cur <= end) { days.push(toISO(cur)); cur.setDate(cur.getDate() + 1); }
  return days;
};
const formatDatePT = (dateStr) => { const d = parseDateInput(dateStr); return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`; };
const formatShort = (dateStr) => { const d = parseDateInput(dateStr); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`; };
const emptyMeal = () => ({
  sopa: { name: "", recipeId: null },
  principal: { name: "", category: null, recipeId: null },
  acompanhamento: { name: "", recipeId: null },
  extras: [],
});
const guessCategory = (name) => {
  const n = normalize(name);
  const sopa = ["sopa","caldo verde","canja","creme de"];
  const peixe = ["peixe","bacalhau","salmão","salmao","atum","robalo","pescada","sardinha","polvo","lulas","lula","camarão","camarao","marisco","dourada"];
  const massa = ["massa","esparguete","lasanha","piza","pizza","macarrão","macarrao","penne","fusilli","talharim"];
  const arroz = ["arroz"];
  const carne = ["carne","frango","vaca","porco","peru","borrego","costeleta","bife","febras","coelho","pato","salsicha"];
  if (sopa.some((k) => n.includes(k))) return "sopa";
  if (peixe.some((k) => n.includes(k))) return "peixe";
  if (massa.some((k) => n.includes(k))) return "massa";
  if (arroz.some((k) => n.includes(k))) return "arroz";
  if (carne.some((k) => n.includes(k))) return "carne";
  return null;
};
const shareWhatsApp = (text) => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank"); // mantida por compatibilidade, mas os botões usam agora links <a> diretos

// ---------- normalização de ingredientes (nome + unidade) para a lista de compras ----------
const stripAccents = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Tipos de unidade: "w" = peso (convertido para g), "v" = volume (convertido para ml), "c" = contagem
const UNIT_TABLE = {
  g: ["w", 1], gr: ["w", 1], grama: ["w", 1], gramas: ["w", 1],
  kg: ["w", 1000], quilo: ["w", 1000], quilos: ["w", 1000],
  ml: ["v", 1], cl: ["v", 10], dl: ["v", 100], l: ["v", 1000], lt: ["v", 1000], litro: ["v", 1000], litros: ["v", 1000],
  "colher de sopa": ["v", 15, true], "colheres de sopa": ["v", 15, true], "colher sopa": ["v", 15, true], "colheres sopa": ["v", 15, true], "c sopa": ["v", 15, true], csopa: ["v", 15, true], cs: ["v", 15, true],
  "colher de cha": ["v", 5, true], "colheres de cha": ["v", 5, true], "colher cha": ["v", 5, true], "colheres cha": ["v", 5, true], "c cha": ["v", 5, true], cc: ["v", 5, true],
  "colher de sobremesa": ["v", 10, true], "colheres de sobremesa": ["v", 10, true],
  "colher de cafe": ["v", 2.5, true], "colheres de cafe": ["v", 2.5, true],
  chavena: ["v", 240, true], chavenas: ["v", 240, true], copo: ["v", 200, true], copos: ["v", 200, true],
};
const COUNT_ALIASES = {
  "": "un", un: "un", unid: "un", unidade: "un", unidades: "un",
  dente: "dente", dentes: "dente", ramo: "ramo", ramos: "ramo", folha: "folha", folhas: "folha",
  vagem: "vagem", vagens: "vagem", molho: "molho", molhos: "molho", lata: "lata", latas: "lata",
  fatia: "fatia", fatias: "fatia", pitada: "pitada", pitadas: "pitada", pacote: "pacote", pacotes: "pacote",
  qb: "qb", "q b": "qb",
};
const parseUnit = (u) => {
  const s = stripAccents(String(u || "").toLowerCase()).replace(/\([^)]*\)/g, " ").replace(/\./g, "").replace(/\s+/g, " ").trim();
  if (UNIT_TABLE[s]) { const [kind, factor, measure] = UNIT_TABLE[s]; return { kind, factor, measure: !!measure }; }
  if (COUNT_ALIASES[s] !== undefined) return { kind: "c", label: COUNT_ALIASES[s] };
  return { kind: "c", label: s };
};
const parseQty = (q) => {
  const s = String(q ?? "").trim().replace(",", ".");
  if (!s) return null;
  let m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/); if (m) return +m[1] + +m[2] / +m[3];
  m = s.match(/^(\d+)\/(\d+)$/); if (m) return +m[1] / +m[2];
  m = s.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/); if (m) return Math.max(+m[1], +m[2]);
  if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  return null;
};

// Limpeza do nome: tira descritivos (fresco, picado, médio...) e junta sinónimos
const DESCRIPTORS = /\b(fresc[oa]s?|picad[oa]s?|mo[ií]d[oa]s?|laminad[oa]s?|m[eé]di[oa]s?|grandes?|pequen[oa]s?|preta)\b/gi;
const ING_ALIASES = [
  [/^dentes? de alho$/, "alho"],
  [/^folhas? de louro$/, "louro"],
  [/^alho[- ]franc[eê]s/, "alho-francês"],
  [/^pimenta/, "pimenta"],
  [/^leite de c[oô]co$/, "leite de coco"],
  [/^noz[- ]moscada$/, "noz-moscada"],
  [/^piri[- ]?piri$/, "piri-piri"],
  [/^org[aã]os?$/, "orégãos"],
  [/^couve[- ]flor$/, "couve-flor"],
  [/^colorau/, "colorau"],
];
const cleanName = (name) => {
  const n = String(name || "").toLowerCase().replace(/\([^)]*\)/g, " ").replace(DESCRIPTORS, " ").replace(/\s+/g, " ").trim();
  for (const [re, to] of ING_ALIASES) if (re.test(n)) return to;
  return n;
};
const plainName = (display) => stripAccents(display).replace(/-/g, " ");
const ingKey = (display) => { let n = plainName(display); if (n.length > 3 && n.endsWith("s") && !/(frances|ss)$/.test(n)) n = n.slice(0, -1); return n; };

// Estimativas usadas só quando é preciso juntar unidades diferentes
const DENSITY = { manteiga: 1, margarina: 1, acucar: 0.85, farinha: 0.55, "queijo ralado": 0.4, natas: 1 };
const dens = (key) => DENSITY[key] ?? DENSITY[key.split(" ")[0]] ?? 1;
// Colheres só são convertidas em gramas nestes ingredientes; nos outros (ervas, especiarias...) ficam em colheres
const CONVERT_SPOON_RE = /^(manteiga|margarina|queijo|natas|acucar)/;
// Em alguns ingredientes, "unidade" quer dizer outra coisa
const UNIT_OVERRIDE = { alho: { un: "dente" }, louro: { un: "folha" } };
const AVG_WEIGHT_G = { cebola: 150, cenoura: 100, batata: 150, "alho frances": 150, tomate: 120, "couve flor": 800, chuchu: 300, malagueta: 10, limao: 100, pimento: 150, "pimento verde": 150, "pimento vermelho": 150 };
const avgWeight = (key, label) => {
  if (label === "dente" && key === "alho") return 5;
  if (label === "un") return AVG_WEIGHT_G[key] || null;
  return null;
};
const LIQUID_RE = /^(agua|azeite|oleo|leite|caldo|vinho|sumo|molho de soja|polpa de tomate|vinagre|cerveja|natas)\b/;

const trimNum = (n) => String(Math.round(n * 100) / 100).replace(".", ",");
const roundApprox = (n) => { const step = n < 100 ? 5 : n < 1000 ? 10 : 100; return Math.round(n / step) * step || n; };
const fmtAmount = (n, unit, approx) => {
  const v = approx ? roundApprox(n) : n;
  const prefix = approx ? "~" : "";
  if (v >= 1000) return `${prefix}${trimNum(v / 1000)} ${unit === "g" ? "kg" : "l"}`;
  return `${prefix}${trimNum(v)} ${unit}`;
};
const fmtSpoons = (ml) => {
  const sopa = ml / 15;
  if (Number.isInteger(sopa * 2)) return `${trimNum(sopa)} ${sopa === 1 ? "colher" : "colheres"} de sopa`;
  const cha = ml / 5;
  return `${trimNum(cha)} ${cha === 1 ? "colher" : "colheres"} de chá`;
};
const COUNT_PLURAL = { un: "un", dente: "dentes", ramo: "ramos", folha: "folhas", vagem: "vagens", molho: "molhos", lata: "latas", fatia: "fatias", pitada: "pitadas", pacote: "pacotes" };
const fmtCount = (n, label) => {
  const num = trimNum(n);
  if (label === "un") return `${num} un`;
  if (COUNT_PLURAL[label]) return `${num} ${n === 1 ? label : COUNT_PLURAL[label]}`;
  return label ? `${num} ${label}` : num;
};

const SECTION_ORDER = ["Legumes e ervas", "Carne e peixe", "Laticínios, massas e arroz", "Líquidos e conservas", "Outros e temperos"];
const mkRe = (terms) => new RegExp("\\b(" + terms.join("|") + ")s?\\b");
const CATEGORY_RULES = [
  ["Líquidos e conservas", mkRe(["agua", "azeite", "oleo", "vinho", "vinagre", "sumo", "caldo", "polpa", "molho de soja", "massa de pimentao", "leite de coco", "feijao", "grao", "cerveja"])],
  ["Outros e temperos", mkRe(["provence", "oregao", "colorau", "paprica", "sal", "flor de sal", "pimenta", "noz moscada", "piri piri", "canela", "cominho", "caril", "acafrao"])],
  ["Carne e peixe", mkRe(["carne", "vaca", "porco", "lombinho", "cachaco", "frango", "pato", "bacon", "peixe", "bacalhau", "salmao", "atum", "pescada", "camarao", "lula", "polvo", "chourico", "presunto", "salsicha", "peru", "borrego", "coelho", "febra", "bife", "costeleta", "entrecosto", "fiambre", "marisco", "dourada", "robalo", "sardinha"])],
  ["Laticínios, massas e arroz", mkRe(["leite", "manteiga", "margarina", "queijo", "mozzarella", "bechamel", "natas", "iogurte", "ovo", "massa", "lasanha", "esparguete", "macarrao", "arroz", "pao"])],
  ["Legumes e ervas", mkRe(["alho", "cebola", "cenoura", "batata", "tomate", "pimento", "couve", "chuchu", "espinafre", "cogumelo", "malagueta", "gengibre", "coentro", "alecrim", "erva", "louro", "salsa", "hortela", "manjericao", "alface", "curgete", "abobora", "brocolo", "ervilha", "nabo", "beterraba", "limao", "laranja", "maca", "banana", "aipo", "funcho", "rucula", "agriao", "pepino", "espargo"])],
];
const categorizeIngredient = (display) => {
  const plain = plainName(display);
  for (const [section, re] of CATEGORY_RULES) if (re.test(plain)) return section;
  return "Outros e temperos";
};
const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Junta todos os ingredientes: um só item por ingrediente, com unidades convertidas e somadas
function buildShoppingSections(rawIngredients) {
  const map = {};
  rawIngredients.forEach((ing) => {
    const display = cleanName(ing.name);
    if (!display) return;
    const key = ingKey(display);
    if (!map[key]) map[key] = { key, name: display, w: 0, v: 0, counts: {}, texts: [] };
    const m = map[key];
    if (display.length < m.name.length) m.name = display; // prefere a forma mais curta (singular)
    const unit = parseUnit(ing.unit);
    const qtyStr = String(ing.quantity ?? "").trim();
    const qty = parseQty(qtyStr);
    if (qty === null) {
      const isQb = !qtyStr || /^q\.?\s?b\.?$/i.test(qtyStr) || (unit.kind === "c" && unit.label === "qb");
      if (!isQb) { const t = `${qtyStr} ${String(ing.unit || "").trim()}`.trim(); if (!m.texts.includes(t)) m.texts.push(t); }
      return;
    }
    if (unit.kind === "w") m.w += qty * unit.factor;
    else if (unit.kind === "v") { m.v += qty * unit.factor; if (unit.measure) m.vMeasure = true; }
    else if (unit.label === "qb") { /* q.b. não conta */ }
    else {
      let label = unit.label || "un";
      if (UNIT_OVERRIDE[key] && UNIT_OVERRIDE[key][label]) label = UNIT_OVERRIDE[key][label];
      m.counts[label] = (m.counts[label] || 0) + qty;
    }
  });

  const sections = {};
  Object.values(map).forEach((m) => {
    const plain = plainName(m.name);
    const liquid = LIQUID_RE.test(plain);
    const rest = { ...m.counts };
    let amount = null, unit = null, approx = false;
    if (liquid) {
      if (m.w > 0 || m.v > 0) { amount = m.v + m.w; unit = "ml"; if (m.w > 0) approx = true; }
    } else if (m.w > 0 || m.v > 0) {
      let g = m.w;
      let volumeText = null;
      if (m.v > 0) {
        if (m.w > 0 || CONVERT_SPOON_RE.test(m.key) || !m.vMeasure) { g += m.v * dens(m.key); approx = approx || m.vMeasure || m.w > 0; }
        else volumeText = fmtSpoons(m.v);
      }
      Object.keys(rest).forEach((label) => { const aw = avgWeight(m.key, label); if (aw && (g > 0 || volumeText === null)) { g += rest[label] * aw; approx = true; delete rest[label]; } });
      if (g > 0) { amount = g; unit = "g"; }
      if (volumeText) m.texts.unshift(volumeText);
    }
    const parts = [];
    if (amount !== null) parts.push(fmtAmount(amount, unit, approx));
    Object.entries(rest).forEach(([label, n]) => parts.push(fmtCount(n, label)));
    m.texts.forEach((t) => parts.push(t));
    const qty = parts.length ? parts.join(" + ") : "q.b.";
    const section = categorizeIngredient(m.name);
    (sections[section] = sections[section] || []).push({ key: m.key, name: capitalize(m.name), qty });
  });
  return SECTION_ORDER.filter((s) => sections[s]).map((s) => ({
    title: s,
    items: sections[s].sort((a, b) => a.name.localeCompare(b.name, "pt")),
  }));
}

// ---------- chamadas à API ----------
async function readJsonFromApi(response) {
  if (!response.ok) {
    let bodyText = "";
    try { bodyText = await response.text(); } catch (e) {}
    throw new Error(`HTTP ${response.status}: ${bodyText.slice(0, 300)}`);
  }
  const data = await response.json();
  const text = (data.content || []).map((b) => (b.type === "text" ? b.text : "")).join("\n").trim();
  if (!text) throw new Error(`Resposta sem texto. content: ${JSON.stringify(data.content).slice(0, 300)}`);
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  const jsonStr = match ? match[0] : cleaned;
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`JSON inválido: ${jsonStr.slice(0, 300)}`);
  }
}

async function searchRecipeOnline(dishName) {
  const response = await fetch("/api/search-recipe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dishName }),
  });
  return readJsonFromApi(response);
}

// Reduz a fotografia (máx. 1600 px) para o envio ser rápido, mesmo com rede fraca
const fileToResizedBase64 = (file, maxSide = 1600, quality = 0.85) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error("Não consegui ler a fotografia."));
  reader.onload = () => {
    const img = new Image();
    img.onerror = () => reject(new Error("Não consegui abrir a fotografia (formato não suportado?)."));
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve({ media_type: "image/jpeg", data: canvas.toDataURL("image/jpeg", quality).split(",")[1] });
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

async function parseRecipePhotos(files) {
  const images = await Promise.all(files.map((f) => fileToResizedBase64(f)));
  const response = await fetch("/api/parse-recipe-photo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images }),
  });
  if (response.status === 404) throw new Error("O servidor ainda não está preparado para ler fotografias (falta atualizar o server.js).");
  if (response.status === 413) throw new Error("A fotografia é demasiado grande para o servidor. Tenta com menos fotos.");
  return readJsonFromApi(response);
}

// ---------- editor de ingredientes reutilizável ----------
function IngredientEditor({ ingredients, onChange }) {
  const update = (id, field, value) => onChange(ingredients.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  const remove = (id) => onChange(ingredients.filter((i) => i.id !== id));
  const add = () => onChange([...ingredients, { id: uid(), name: "", quantity: "", unit: "" }]);
  return (
    <div className="ing-editor">
      {ingredients.map((ing) => (
        <div className="ing-row" key={ing.id}>
          <input className="ing-name" value={ing.name} placeholder="ingrediente" onChange={(e) => update(ing.id, "name", e.target.value)} />
          <input className="ing-qty" value={ing.quantity} placeholder="qtd" onChange={(e) => update(ing.id, "quantity", e.target.value)} />
          <input className="ing-unit" list="unit-list" value={ing.unit} placeholder="un." onChange={(e) => update(ing.id, "unit", e.target.value)} />
          <button className="icon-btn danger" onClick={() => remove(ing.id)} aria-label="Remover ingrediente">✕</button>
        </div>
      ))}
      <button className="text-btn" onClick={add}>➕ Adicionar ingrediente</button>
    </div>
  );
}

function App() {
  const [allDays, setAllDays] = useState({});
  const [range, setRange] = useState({ startDate: "", endDate: "" });
  const [singleDay, setSingleDay] = useState(false);
  const [dishes, setDishes] = useState({});
  const [recipes, setRecipes] = useState({});
  const [checked, setChecked] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("plano");
  const [draftStart, setDraftStart] = useState("");
  const [draftEnd, setDraftEnd] = useState("");
  const [searchState, setSearchState] = useState({});
  const [expandedSlots, setExpandedSlots] = useState({});
  const [recipeFilter, setRecipeFilter] = useState("");
  const [expandedRecipes, setExpandedRecipes] = useState({});
  const [editingRecipeId, setEditingRecipeId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [userCode, setUserCode] = useState(() => { try { return window.localStorage.getItem("userCode") || ""; } catch (e) { return ""; } });
  const [codeInput, setCodeInput] = useState("");
  const syncTimer = useRef(null);

  // ---------- carregar dados persistidos (código pessoal > servidor; senão localStorage) ----------
  useEffect(() => {
    (async () => {
      let serverData = null;
      if (userCode) {
        try {
          const res = await fetch(`/api/data/${encodeURIComponent(userCode)}`);
          if (res.ok) { const j = await res.json(); serverData = j.data; }
        } catch (e) {}
      }
      if (serverData) {
        setAllDays(serverData.allDays || {});
        setDishes(serverData.dishes || {});
        setRecipes(serverData.recipes || {});
        setChecked(serverData.checked || {});
        const rg = serverData.range || { startDate: "", endDate: "" };
        setRange(rg); setDraftStart(rg.startDate || ""); setDraftEnd(rg.endDate || "");
      } else {
        // Importação automática do plano antigo (versão anterior guardava tudo numa única chave "plan")
        let legacyPlan = null;
        try { const r = await window.storage.get("plan"); if (r) legacyPlan = JSON.parse(r.value); } catch (e) {}
        let hasAllDays = false;
        try { const r = await window.storage.get("allDays"); if (r) { const parsed = JSON.parse(r.value); setAllDays(parsed); hasAllDays = Object.keys(parsed || {}).length > 0; } } catch (e) {}
        if (!hasAllDays && legacyPlan && Array.isArray(legacyPlan.days)) {
          const migrated = {};
          legacyPlan.days.forEach((d) => { if (d && d.date) migrated[d.date] = d; });
          setAllDays(migrated);
        }
        try { const r = await window.storage.get("dishes"); if (r) setDishes(JSON.parse(r.value)); } catch (e) {}
        try { const r = await window.storage.get("recipes"); if (r) setRecipes(JSON.parse(r.value)); } catch (e) {}
        try { const r = await window.storage.get("checked"); if (r) setChecked(JSON.parse(r.value)); } catch (e) {}
        let hasRange = false;
        try { const r = await window.storage.get("range"); if (r) { const rg = JSON.parse(r.value); setRange(rg); setDraftStart(rg.startDate || ""); setDraftEnd(rg.endDate || ""); hasRange = !!rg.startDate; } } catch (e) {}
        if (!hasRange && legacyPlan && legacyPlan.startDate) {
          const rg = { startDate: legacyPlan.startDate, endDate: legacyPlan.endDate || legacyPlan.startDate };
          setRange(rg); setDraftStart(rg.startDate); setDraftEnd(rg.endDate);
        }
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => { if (loaded) window.storage.set("allDays", JSON.stringify(allDays), false).catch(() => {}); }, [allDays, loaded]);
  useEffect(() => { if (loaded) window.storage.set("dishes", JSON.stringify(dishes), false).catch(() => {}); }, [dishes, loaded]);
  useEffect(() => { if (loaded) window.storage.set("recipes", JSON.stringify(recipes), false).catch(() => {}); }, [recipes, loaded]);
  useEffect(() => { if (loaded) window.storage.set("checked", JSON.stringify(checked), false).catch(() => {}); }, [checked, loaded]);
  useEffect(() => { if (loaded) window.storage.set("range", JSON.stringify(range), false).catch(() => {}); }, [range, loaded]);

  // ---------- sincronização com o servidor (código pessoal), com atraso para não sobrecarregar ----------
  useEffect(() => {
    if (!loaded || !userCode) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      fetch(`/api/data/${encodeURIComponent(userCode)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allDays, dishes, recipes, checked, range }),
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(syncTimer.current);
  }, [allDays, dishes, recipes, checked, range, loaded, userCode]);

  // ---------- plano ----------
  const applyRange = () => {
    if (!draftStart) return;
    const end = singleDay ? draftStart : (draftEnd || draftStart);
    if (draftStart > end) return;
    setRange({ startDate: draftStart, endDate: end });
  };

  const displayedDays = useMemo(() => {
    if (!range.startDate) return [];
    return buildDateRange(range.startDate, range.endDate).map((date) => allDays[date] || { date, meals: { almoco: emptyMeal(), jantar: emptyMeal() } });
  }, [range, allDays]);

  const upsertDish = (name, category) => {
    const key = normalize(name);
    if (!key) return;
    setDishes((d) => ({ ...d, [key]: { name: name.trim(), category } }));
  };

  const patchSlot = (dateISO, mealType, slotKey, patch) => {
    setAllDays((all) => {
      const day = all[dateISO] || { date: dateISO, meals: { almoco: emptyMeal(), jantar: emptyMeal() } };
      const meal = { ...day.meals[mealType] };
      if (slotKey === "sopa" || slotKey === "principal" || slotKey === "acompanhamento") {
        meal[slotKey] = { ...meal[slotKey], ...patch };
      } else {
        meal.extras = (meal.extras || []).map((ex) => (ex.id === slotKey ? { ...ex, ...patch } : ex));
      }
      return { ...all, [dateISO]: { ...day, meals: { ...day.meals, [mealType]: meal } } };
    });
  };

  const findSlot = (dateISO, mealType, slotKey) => {
    const day = allDays[dateISO];
    if (!day) return null;
    if (slotKey === "sopa" || slotKey === "principal" || slotKey === "acompanhamento") return day.meals[mealType][slotKey];
    return (day.meals[mealType].extras || []).find((e) => e.id === slotKey) || null;
  };

  const updateSlotName = (dateISO, mealType, slotKey, value) => patchSlot(dateISO, mealType, slotKey, { name: value, recipeId: null });

  const blurSlotName = (dateISO, mealType, slotKey, value, fixedCategory, currentCategory) => {
    const name = value.trim();
    if (!name) return;
    const category = fixedCategory || currentCategory || guessCategory(name) || "acomp";
    upsertDish(name, category);
  };

  const setSlotCategory = (dateISO, mealType, slotKey, category) => {
    patchSlot(dateISO, mealType, slotKey, { category });
    const slot = findSlot(dateISO, mealType, slotKey);
    if (slot) upsertDish(slot.name, category);
  };

  const linkRecipeToSlot = (dateISO, mealType, slotKey, recipeId, category, name) => {
    const isFixed = slotKey === "sopa" || slotKey === "acompanhamento";
    patchSlot(dateISO, mealType, slotKey, { name, recipeId, ...(isFixed ? {} : { category }) });
  };

  const unlinkSlot = (dateISO, mealType, slotKey) => patchSlot(dateISO, mealType, slotKey, { recipeId: null });

  const addExtraDish = (dateISO, mealType) => {
    setAllDays((all) => {
      const day = all[dateISO] || { date: dateISO, meals: { almoco: emptyMeal(), jantar: emptyMeal() } };
      const meal = { ...day.meals[mealType] };
      meal.extras = [...(meal.extras || []), { id: uid(), name: "", category: null, recipeId: null }];
      return { ...all, [dateISO]: { ...day, meals: { ...day.meals, [mealType]: meal } } };
    });
  };

  const removeExtraDish = (dateISO, mealType, id) => {
    setAllDays((all) => {
      const day = all[dateISO];
      if (!day) return all;
      const meal = { ...day.meals[mealType] };
      meal.extras = (meal.extras || []).filter((e) => e.id !== id);
      return { ...all, [dateISO]: { ...day, meals: { ...day.meals, [mealType]: meal } } };
    });
  };

  // ---------- pesquisa de receitas ----------
  const stateKeyFor = (dateISO, mealType, slotKey) => `${dateISO}|${mealType}|${slotKey}`;

  const handleSearchClick = (dateISO, mealType, slotKey, name) => {
    const key = stateKeyFor(dateISO, mealType, slotKey);
    const norm = normalize(name);
    const existing = Object.values(recipes).find((r) => normalize(r.name) === norm);
    if (existing) setSearchState((s) => ({ ...s, [key]: { status: "existing", recipe: existing } }));
    else runWebSearch(dateISO, mealType, slotKey, name);
  };

  const runWebSearch = async (dateISO, mealType, slotKey, name) => {
    const key = stateKeyFor(dateISO, mealType, slotKey);
    setSearchState((s) => ({ ...s, [key]: { status: "loading" } }));
    try {
      const result = await searchRecipeOnline(name);
      const ingredients = (result.ingredients || []).map((ing) => ({ id: uid(), name: ing.name || "", quantity: ing.quantity ?? "", unit: ing.unit || "" }));
      setSearchState((s) => ({ ...s, [key]: { status: "review", draft: { name: result.name || name, category: result.category || null, ingredients, sourceUrl: result.sourceUrl || "", prep: result.prep || "" } } }));
    } catch (e) {
      setSearchState((s) => ({ ...s, [key]: { status: "error", message: String(e && e.message ? e.message : e) } }));
    }
  };

  const openManualEntry = (dateISO, mealType, slotKey, name) => {
    const key = stateKeyFor(dateISO, mealType, slotKey);
    const existingRecipe = null;
    setSearchState((s) => ({ ...s, [key]: { status: "review", draft: { name, category: null, ingredients: [], sourceUrl: "", prep: "" } } }));
  };

  const cancelSearch = (dateISO, mealType, slotKey) => {
    const key = stateKeyFor(dateISO, mealType, slotKey);
    setSearchState((s) => { const n = { ...s }; delete n[key]; return n; });
  };

  const useExistingRecipe = (dateISO, mealType, slotKey) => {
    const key = stateKeyFor(dateISO, mealType, slotKey);
    const st = searchState[key];
    if (!st || st.status !== "existing") return;
    const r = st.recipe;
    linkRecipeToSlot(dateISO, mealType, slotKey, r.id, r.category, r.name);
    cancelSearch(dateISO, mealType, slotKey);
  };

  const mapCategoryForSlot = (fixedCategory, rawApiCategory, name, currentSlotCategory) => {
    if (fixedCategory) return fixedCategory;
    const raw = normalize(rawApiCategory).replace(/^acompanhamentos?$/, "acomp");
    if (CATEGORY_ORDER.includes(raw)) return raw;
    return currentSlotCategory || guessCategory(name) || "carne";
  };

  const saveDraftRecipe = (dateISO, mealType, slotKey) => {
    const key = stateKeyFor(dateISO, mealType, slotKey);
    const st = searchState[key];
    if (!st || st.status !== "review") return;
    const draft = st.draft;
    const fixedCategory = slotKey === "sopa" ? "sopa" : slotKey === "acompanhamento" ? "acomp" : null;
    const currentSlot = findSlot(dateISO, mealType, slotKey);
    const category = mapCategoryForSlot(fixedCategory, draft.category, draft.name, currentSlot ? currentSlot.category : null);
    const id = uid();
    const recipe = { id, name: draft.name, category, ingredients: draft.ingredients, sourceUrl: draft.sourceUrl, prep: draft.prep, createdAt: Date.now() };
    setRecipes((r) => ({ ...r, [id]: recipe }));
    upsertDish(draft.name, category);
    linkRecipeToSlot(dateISO, mealType, slotKey, id, category, draft.name);
    cancelSearch(dateISO, mealType, slotKey);
  };

  const updateDraftIngredients = (dateISO, mealType, slotKey, ingredients) => {
    const key = stateKeyFor(dateISO, mealType, slotKey);
    setSearchState((s) => ({ ...s, [key]: { ...s[key], draft: { ...s[key].draft, ingredients } } }));
  };

  const updateDraftField = (dateISO, mealType, slotKey, field, value) => {
    const key = stateKeyFor(dateISO, mealType, slotKey);
    setSearchState((s) => ({ ...s, [key]: { ...s[key], draft: { ...s[key].draft, [field]: value } } }));
  };

  const toggleExpandSlot = (key) => setExpandedSlots((s) => ({ ...s, [key]: !s[key] }));

  // ---------- lista de compras (um só item por ingrediente, unidades convertidas) ----------
  const shoppingSections = useMemo(() => {
    const all = [];
    displayedDays.forEach((day) => {
      ["almoco", "jantar"].forEach((mealType) => {
        const meal = day.meals[mealType];
        const slots = [meal.sopa, meal.principal, meal.acompanhamento, ...(meal.extras || [])];
        slots.forEach((slot) => {
          if (!slot || !slot.recipeId) return;
          const recipe = recipes[slot.recipeId];
          if (!recipe) return;
          recipe.ingredients.forEach((ing) => all.push(ing));
        });
      });
    });
    return buildShoppingSections(all);
  }, [displayedDays, recipes]);

  const shoppingRangeLabel = range.startDate ? `${formatShort(range.startDate)} a ${formatShort(range.endDate)}` : "";

  const buildShoppingShareText = () => {
    const blocks = shoppingSections.map((sec) => `${sec.title}\n${sec.items.map((i) => `- ${i.name}: ${i.qty}`).join("\n")}`);
    return `🛒 Lista de compras${shoppingRangeLabel ? ` (${shoppingRangeLabel})` : ""}\n\n${blocks.join("\n\n")}`;
  };

  const exportShoppingPDF = () => {
    const JsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!JsPDF) { alert("A biblioteca de PDF ainda não carregou. Espera uns segundos e tenta de novo (precisa de internet)."); return; }
    const doc = new JsPDF({ unit: "mm", format: "a4" });
    const W = 210, M = 20, BOTTOM = 280;
    let y = 22;
    doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(45, 90, 61);
    doc.text("Lista de compras", W / 2, y, { align: "center" }); y += 7;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(120, 120, 120);
    doc.text(`${shoppingRangeLabel}${shoppingRangeLabel ? " · " : ""}quantidades arredondadas (~ = estimativa)`, W / 2, y, { align: "center" }); y += 10;
    shoppingSections.forEach((sec) => {
      if (y + 20 > BOTTOM) { doc.addPage(); y = 22; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(45, 90, 61);
      doc.text(sec.title, M, y); y += 6;
      sec.items.forEach((item) => {
        if (y + 7 > BOTTOM) { doc.addPage(); y = 22; }
        doc.setDrawColor(45, 90, 61); doc.setLineWidth(0.3); doc.rect(M, y - 3.6, 3.8, 3.8);
        doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(30, 30, 30);
        doc.text(item.name, M + 7, y);
        doc.setTextColor(70, 70, 70);
        doc.text(item.qty, W - M, y, { align: "right" });
        doc.setDrawColor(204, 204, 204); doc.setLineWidth(0.15); doc.line(M + 7, y + 2, W - M, y + 2);
        y += 7;
      });
      y += 4;
    });
    doc.save(`lista-de-compras${range.startDate ? `_${range.startDate}_${range.endDate}` : ""}.pdf`);
  };

  const buildPlanShareText = () => {
    const rangeLabel = range.startDate ? ` (${formatShort(range.startDate)} a ${formatShort(range.endDate)})` : "";
    const fmt = (m) => [m.sopa.name, m.principal.name, m.acompanhamento.name, ...(m.extras || []).map((e) => e.name)].filter(Boolean).join(" | ") || "—";
    const dayLines = displayedDays.map((day) => `${formatDatePT(day.date)}\nAlmoço: ${fmt(day.meals.almoco)}\nJantar: ${fmt(day.meals.jantar)}`);

    const usedIds = new Set();
    displayedDays.forEach((day) => {
      ["almoco", "jantar"].forEach((mealType) => {
        const meal = day.meals[mealType];
        [meal.sopa, meal.principal, meal.acompanhamento, ...(meal.extras || [])].forEach((slot) => {
          if (slot && slot.recipeId) usedIds.add(slot.recipeId);
        });
      });
    });
    const usedRecipes = Array.from(usedIds).map((id) => recipes[id]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, "pt"));
    const recipesBlock = usedRecipes.length ? `\n\n———\n📖 Receitas do período\n\n${usedRecipes.map((r) => buildRecipeShareText(r)).join("\n\n")}` : "";

    return `📅 Plano de refeições${rangeLabel}\n\n${dayLines.join("\n\n")}${recipesBlock}`;
  };

  const buildRecipeShareText = (recipe) => {
    const lines = recipe.ingredients.map((i) => `- ${i.name}${i.quantity ? `: ${i.quantity}${i.unit ? " " + i.unit : ""}` : ""}`);
    return `🍲 ${recipe.name}\n\nIngredientes:\n${lines.join("\n")}${recipe.prep ? `\n\nPreparação: ${recipe.prep}` : ""}${recipe.sourceUrl ? `\n\nFonte: ${recipe.sourceUrl}` : ""}`;
  };

  const buildRecipeBookShareText = (onlyCategory) => {
    const cats = onlyCategory ? [onlyCategory] : CATEGORY_ORDER;
    const blocks = cats.map((c) => {
      const list = recipesByCategory[c];
      if (!list || !list.length) return null;
      return `— ${CATEGORY_META[c].label} —\n\n${list.map((r) => buildRecipeShareText(r)).join("\n\n")}`;
    }).filter(Boolean);
    return `📖 Livro de receitas\n\n${blocks.join("\n\n")}`;
  };

  // ---------- receita por fotografia ----------
  const [photoState, setPhotoState] = useState({ status: "idle" });
  const handlePhotoFiles = async (fileList) => {
    const files = Array.from(fileList || []).slice(0, 4);
    if (!files.length) return;
    setPhotoState({ status: "loading" });
    try {
      const result = await parseRecipePhotos(files);
      const ingredients = (result.ingredients || []).map((ing) => ({ id: uid(), name: ing.name || "", quantity: ing.quantity ?? "", unit: ing.unit || "" }));
      if (!ingredients.length) throw new Error("Não encontrei ingredientes na fotografia. Tenta uma foto mais nítida, de frente e com boa luz.");
      const rawCat = normalize(result.category).replace(/^acompanhamentos?$/, "acomp");
      const name = result.name || "";
      const category = CATEGORY_ORDER.includes(rawCat) ? rawCat : (guessCategory(name) || "carne");
      setPhotoState({ status: "review", draft: { name, category, ingredients, prep: result.prep || "" } });
    } catch (e) {
      setPhotoState({ status: "error", message: String(e && e.message ? e.message : e) });
    }
  };
  const updatePhotoDraft = (patch) => setPhotoState((s) => ({ ...s, draft: { ...s.draft, ...patch } }));
  const savePhotoRecipe = () => {
    const d = photoState.draft;
    if (!d || !d.name.trim()) { alert("Dá um nome à receita antes de guardar."); return; }
    const id = uid();
    const recipe = { id, name: d.name.trim(), category: d.category || "carne", ingredients: d.ingredients.filter((i) => i.name.trim()), sourceUrl: "", prep: d.prep || "", createdAt: Date.now() };
    setRecipes((r) => ({ ...r, [id]: recipe }));
    upsertDish(recipe.name, recipe.category);
    setPhotoState({ status: "idle" });
  };

  // ---------- livro de receitas ----------
  const recipesByCategory = useMemo(() => {
    const groups = {}; CATEGORY_ORDER.forEach((c) => (groups[c] = []));
    Object.values(recipes).forEach((r) => { if (groups[r.category]) groups[r.category].push(r); });
    if (recipeFilter.trim()) {
      const f = normalize(recipeFilter);
      CATEGORY_ORDER.forEach((c) => (groups[c] = groups[c].filter((r) => normalize(r.name).includes(f))));
    }
    CATEGORY_ORDER.forEach((c) => groups[c].sort((a, b) => a.name.localeCompare(b.name, "pt")));
    return groups;
  }, [recipes, recipeFilter]);

  const startEditRecipe = (recipe) => { setEditingRecipeId(recipe.id); setEditDraft({ ...recipe, ingredients: recipe.ingredients.map((i) => ({ ...i })) }); };
  const cancelEditRecipe = () => { setEditingRecipeId(null); setEditDraft(null); };
  const saveEditRecipe = () => {
    setRecipes((r) => ({ ...r, [editDraft.id]: editDraft }));
    upsertDish(editDraft.name, editDraft.category);
    cancelEditRecipe();
  };
  const deleteRecipe = (id) => {
    if (!window.confirm("Apagar esta receita do livro de receitas?")) return;
    setRecipes((r) => { const n = { ...r }; delete n[id]; return n; });
  };

  const allDishNames = useMemo(() => Object.values(dishes).map((d) => d.name), [dishes]);

  const handlePickExistingRecipe = (dateISO, mealType, slotKey, recipeId) => {
    if (!recipeId) return;
    const r = recipes[recipeId];
    if (!r) return;
    linkRecipeToSlot(dateISO, mealType, slotKey, r.id, r.category, r.name);
  };

  const pickerCategoriesFor = (kind) => {
    if (kind === "sopa") return ["sopa"];
    if (kind === "acomp") return ["acomp"];
    if (kind === "principal") return ["carne", "peixe", "massa", "arroz"];
    return CATEGORY_ORDER;
  };

  // ---------- render de um campo de refeição ----------
  const renderSlot = (dateISO, mealType, slotKey, slot, placeholder, kind) => {
    const key = stateKeyFor(dateISO, mealType, slotKey);
    const st = searchState[key];
    const linkedRecipe = slot.recipeId ? recipes[slot.recipeId] : null;
    const fixedCategory = kind === "sopa" ? "sopa" : kind === "acomp" ? "acomp" : null;
    const categoryOptions = kind === "principal" ? PRINCIPAL_CATEGORIES : kind === "extra" ? ALL_CATEGORY_OPTIONS : null;
    const currentCategory = fixedCategory || slot.category || guessCategory(slot.name) || (kind === "extra" ? "acomp" : "carne");
    const showCategorySelect = !!categoryOptions && slot.name.trim();

    return (
      <div className="slot">
        <div className="slot-row">
          <input
            className="slot-input"
            list="dish-names"
            value={slot.name}
            placeholder={placeholder}
            onChange={(e) => updateSlotName(dateISO, mealType, slotKey, e.target.value)}
            onBlur={(e) => blurSlotName(dateISO, mealType, slotKey, e.target.value, fixedCategory, currentCategory)}
          />
          {showCategorySelect && (
            <select className="cat-select" value={currentCategory} onChange={(e) => setSlotCategory(dateISO, mealType, slotKey, e.target.value)}>
              {categoryOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          )}
          <button className="icon-btn" disabled={!slot.name.trim()} onClick={() => handleSearchClick(dateISO, mealType, slotKey, slot.name)} aria-label="Pesquisar receita">
            🔍
          </button>
          {kind === "extra" && (
            <button className="icon-btn danger" onClick={() => removeExtraDish(dateISO, mealType, slotKey)} aria-label="Remover prato">🗑️</button>
          )}
        </div>

        {!linkedRecipe && pickerCategoriesFor(kind).some((c) => (recipesByCategory[c] || []).length > 0) && (
          <select
            className="recipe-picker"
            value=""
            onChange={(e) => handlePickExistingRecipe(dateISO, mealType, slotKey, e.target.value)}
          >
            <option value="">📖 Escolher receita já existente…</option>
            {pickerCategoriesFor(kind).map((c) => (recipesByCategory[c] || []).length > 0 && (
              <optgroup key={c} label={CATEGORY_META[c].label}>
                {recipesByCategory[c].map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </optgroup>
            ))}
          </select>
        )}

        {!linkedRecipe && !st && slot.name.trim() && (
          <button className="text-btn" onClick={() => openManualEntry(dateISO, mealType, slotKey, slot.name)}>➕ Adicionar ingredientes à mão</button>
        )}

        {linkedRecipe && (
          <div className="recipe-chip">
            <button className="chip-main" onClick={() => toggleExpandSlot(key)}>
              📖 {linkedRecipe.ingredients.length} ingredientes
              {expandedSlots[key] ? "▾" : "▸"}
            </button>
            <a className="icon-btn ghost" href={`https://wa.me/?text=${encodeURIComponent(buildRecipeShareText(linkedRecipe))}`} target="_blank" rel="noopener noreferrer" aria-label="Partilhar receita">💬</a>
            <button className="icon-btn ghost" onClick={() => unlinkSlot(dateISO, mealType, slotKey)} aria-label="Desassociar receita">✕</button>
          </div>
        )}
        {linkedRecipe && expandedSlots[key] && (
          <ul className="ing-list-mini">
            {linkedRecipe.ingredients.map((i) => <li key={i.id}>{i.name}{i.quantity ? ` — ${i.quantity}${i.unit ? " " + i.unit : ""}` : ""}</li>)}
          </ul>
        )}

        {st && st.status === "loading" && <div className="search-panel"><span className="spin">⏳</span> A pesquisar receita na web…</div>}

        {st && st.status === "error" && (
          <div className="search-panel error">
            <p>Não foi possível encontrar uma receita.</p>
            {st.message && <p style={{ fontSize: 11, wordBreak: "break-word" }}>{st.message}</p>}
            <div className="btn-row">
              <button className="text-btn" onClick={() => runWebSearch(dateISO, mealType, slotKey, slot.name)}>Tentar de novo</button>
              <button className="text-btn" onClick={() => cancelSearch(dateISO, mealType, slotKey)}>Fechar</button>
            </div>
          </div>
        )}

        {st && st.status === "existing" && (
          <div className="search-panel">
            <p>Já existe uma receita guardada para <strong>{st.recipe.name}</strong>.</p>
            <div className="btn-row">
              <button className="text-btn primary" onClick={() => useExistingRecipe(dateISO, mealType, slotKey)}>✓ Usar esta</button>
              <button className="text-btn" onClick={() => runWebSearch(dateISO, mealType, slotKey, slot.name)}>Pesquisar nova</button>
              <button className="text-btn" onClick={() => cancelSearch(dateISO, mealType, slotKey)}>Fechar</button>
            </div>
          </div>
        )}

        {st && st.status === "review" && (
          <div className="search-panel">
            <input className="slot-input draft-name-input" value={st.draft.name} placeholder="Nome do prato" onChange={(e) => updateDraftField(dateISO, mealType, slotKey, "name", e.target.value)} />
            <IngredientEditor ingredients={st.draft.ingredients} onChange={(ings) => updateDraftIngredients(dateISO, mealType, slotKey, ings)} />
            <textarea className="prep-textarea" placeholder="Modo de preparação (opcional)" value={st.draft.prep} onChange={(e) => updateDraftField(dateISO, mealType, slotKey, "prep", e.target.value)} />
            <div className="btn-row">
              <button className="text-btn primary" onClick={() => saveDraftRecipe(dateISO, mealType, slotKey)}>✓ Guardar receita</button>
              <button className="text-btn" onClick={() => cancelSearch(dateISO, mealType, slotKey)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!userCode) {
    return (
      <div className="app">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
          :root { --paper: #EEF0E6; --card: #FFFFFF; --border: #D8D6C6; --ink: #262622; --ink-soft: #6B6A5F; --accent: #3F6355; --accent-dark: #2E4A40; }
          * { box-sizing: border-box; }
          .app { font-family: 'IBM Plex Sans', sans-serif; background: var(--paper); color: var(--ink); min-height: 100vh; padding: 14px 12px 40px; max-width: 480px; margin: 0 auto; }
          h1 { font-family: 'Fraunces', serif; font-size: 22px; font-weight: 600; margin: 4px 0 2px; }
          .subtitle { font-size: 13px; color: var(--ink-soft); margin: 0 0 14px; }
          .card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 14px; margin-bottom: 12px; }
          .card p { margin-top: 0; font-size: 13.5px; }
          input { width: 100%; font-family: 'IBM Plex Sans', sans-serif; font-size: 14px; padding: 9px 10px; border: 1px solid var(--border); border-radius: 7px; background: #FBFAF6; color: var(--ink); margin-bottom: 10px; }
          button { width: 100%; background: var(--accent); color: #fff; border: none; border-radius: 7px; padding: 10px 14px; font-size: 14px; font-weight: 500; cursor: pointer; }
          button:disabled { opacity: 0.5; }
        `}</style>
        <h1>Meal Planner</h1>
        <p className="subtitle">Para os teus dados ficarem disponíveis em qualquer aparelho (telemóvel, tablet, PC), usa um código pessoal — é só teu, guarda-o num sítio seguro.</p>
        <div className="card">
          <p>Já tens um código? Escreve-o aqui:</p>
          <input value={codeInput} placeholder="O teu código" onChange={(e) => setCodeInput(e.target.value)} />
          <button disabled={!codeInput.trim()} onClick={() => { try { window.localStorage.setItem("userCode", codeInput.trim().toUpperCase()); } catch (e) {} window.location.reload(); }}>Continuar com este código</button>
        </div>
        <div className="card">
          <p>Ainda não tens código? Cria um novo (guarda-o bem, vais precisar dele nos outros aparelhos):</p>
          <button onClick={() => { const c = uid().toUpperCase(); window.alert("O teu código pessoal é:\n\n" + c + "\n\nAnota-o ou tira um print — vais precisar dele para acederes aos teus dados a partir de outro aparelho."); try { window.localStorage.setItem("userCode", c); } catch (e) {} window.location.reload(); }}>Criar código novo</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
        :root {
          --paper: #EEF0E6; --card: #FFFFFF; --border: #D8D6C6; --ink: #262622; --ink-soft: #6B6A5F;
          --accent: #3F6355; --accent-dark: #2E4A40; --wa: #25D366; --danger: #A5433A;
        }
        * { box-sizing: border-box; }
        .app { font-family: 'IBM Plex Sans', sans-serif; background: var(--paper); color: var(--ink); min-height: 100%; padding: 14px 12px 40px; max-width: 480px; margin: 0 auto; }
        h1, h2, h3, .serif { font-family: 'Fraunces', serif; }
        h1 { font-size: 22px; font-weight: 600; margin: 4px 0 2px; }
        .subtitle { font-size: 13px; color: var(--ink-soft); margin: 0 0 14px; }
        .tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border); margin-bottom: 16px; }
        .tab-btn { flex: 1; background: none; border: none; padding: 9px 4px; font-family: 'IBM Plex Sans', sans-serif; font-size: 14px; font-weight: 500; color: var(--ink-soft); cursor: pointer; border-bottom: 2px solid transparent; }
        .tab-btn.active { color: var(--accent-dark); border-bottom-color: var(--accent); }
        .card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 12px; margin-bottom: 12px; }
        .period-row { display: flex; gap: 8px; align-items: end; }
        .field { display: flex; flex-direction: column; gap: 4px; flex: 1; }
        .field label { font-size: 12px; color: var(--ink-soft); }
        input[type=date], .slot-input, .cat-select, .ing-name, .ing-qty, .ing-unit, .filter-input {
          font-family: 'IBM Plex Sans', sans-serif; font-size: 14px; padding: 8px 9px; border: 1px solid var(--border); border-radius: 7px; background: #FBFAF6; color: var(--ink);
        }
        .btn-primary { background: var(--accent); color: #fff; border: none; border-radius: 7px; padding: 9px 14px; font-size: 14px; font-weight: 500; cursor: pointer; }
        .btn-primary:disabled { opacity: 0.5; }
        .day-card { margin-bottom: 14px; }
        .day-title { font-size: 15px; font-weight: 600; margin: 0 0 8px; }
        .meal-block { margin-bottom: 10px; }
        .meal-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ink-soft); margin-bottom: 5px; font-weight: 500; }
        .slot { margin-bottom: 8px; }
        .slot-row { display: flex; gap: 6px; align-items: center; }
        .slot-input { flex: 1; min-width: 0; }
        .cat-select { max-width: 84px; font-size: 12px; padding: 8px 4px; }
        .icon-btn { display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 7px; border: 1px solid var(--border); background: #fff; color: var(--accent-dark); cursor: pointer; flex-shrink: 0; }
        .icon-btn:disabled { opacity: 0.4; }
        .icon-btn.ghost { border-color: transparent; background: transparent; width: 28px; height: 28px; }
        .icon-btn.danger { color: var(--danger); border: none; background: none; width: 26px; height: 26px; }
        .recipe-chip { display: flex; align-items: center; gap: 4px; margin-top: 5px; }
        .chip-main { display: flex; align-items: center; gap: 4px; font-size: 12px; background: none; border: none; color: var(--accent-dark); padding: 2px 0; cursor: pointer; }
        .ing-list-mini { margin: 4px 0 0 0; padding-left: 18px; font-size: 12.5px; color: var(--ink-soft); }
        .search-panel { background: #F6F5EE; border: 1px solid var(--border); border-radius: 8px; padding: 9px 10px; margin-top: 6px; font-size: 13px; }
        .search-panel.error { color: var(--danger); }
        .search-panel p { margin: 0 0 6px; }
        .draft-title { font-family: 'Fraunces', serif; font-size: 15px; font-weight: 600; }
        .draft-prep { color: var(--ink-soft); font-size: 12.5px; }
        .draft-name-input { width: 100%; margin-bottom: 6px; font-family: 'Fraunces', serif; font-size: 15px; font-weight: 600; }
        .prep-textarea { width: 100%; min-height: 52px; font-family: 'IBM Plex Sans', sans-serif; font-size: 13px; padding: 8px 9px; border: 1px solid var(--border); border-radius: 7px; background: #FBFAF6; color: var(--ink); resize: vertical; margin-top: 6px; }
        .btn-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
        .text-btn { display: inline-flex; align-items: center; gap: 4px; background: none; border: none; color: var(--accent-dark); font-size: 13px; font-weight: 500; cursor: pointer; padding: 4px 0; }
        .text-btn.primary { background: var(--accent); color: #fff; padding: 7px 10px; border-radius: 6px; }
        .ing-editor { margin-top: 4px; }
        .ing-row { display: flex; gap: 5px; margin-bottom: 5px; align-items: center; }
        .ing-name { flex: 2; min-width: 0; }
        .ing-qty { flex: 1; min-width: 0; }
        .ing-unit { flex: 1; min-width: 0; }
        .spin { display: inline-block; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .share-row { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; margin: 10px 0; }
        .wa-btn, .icon-btn { text-decoration: none; }
        .wa-btn { display: flex; align-items: center; gap: 6px; background: var(--wa); color: #fff; border: none; border-radius: 8px; padding: 9px 14px; font-size: 13.5px; font-weight: 500; cursor: pointer; }
        .empty-state { text-align: center; padding: 30px 10px; color: var(--ink-soft); font-size: 13.5px; }
        .shop-title { font-size: 17px; margin: 0 0 2px; color: var(--accent-dark); }
        .shop-section { font-family: 'Fraunces', serif; font-weight: 600; font-size: 14.5px; color: var(--accent-dark); margin: 14px 0 2px; padding-bottom: 3px; border-bottom: 2px solid var(--accent); }
        .pdf-btn, .photo-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; background: var(--accent); color: #fff; border: none; border-radius: 8px; padding: 9px 14px; font-family: 'IBM Plex Sans', sans-serif; font-size: 14px; font-weight: 500; cursor: pointer; }
        .photo-btn { width: 100%; }
        .shop-item { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 14px; }
        .shop-item:last-child { border-bottom: none; }
        .shop-item.done { color: var(--ink-soft); text-decoration: line-through; }
        .shop-qty { margin-left: auto; font-size: 12.5px; color: var(--ink-soft); }
        .cat-section { margin-bottom: 14px; }
        .cat-header { display: flex; align-items: center; gap: 7px; font-size: 14px; font-weight: 600; margin-bottom: 6px; }
        .cat-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
        .recipe-card { background: var(--card); border: 1px solid var(--border); border-radius: 9px; padding: 9px 10px; margin-bottom: 7px; }
        .recipe-head { display: flex; align-items: center; gap: 6px; cursor: pointer; }
        .recipe-name { font-family: 'Fraunces', serif; font-weight: 600; font-size: 14.5px; flex: 1; }
        .recipe-count { font-size: 12px; color: var(--ink-soft); }
        .recipe-actions { display: flex; gap: 4px; margin-top: 6px; }
        .recipe-picker { width: 100%; margin-top: 5px; font-family: 'IBM Plex Sans', sans-serif; font-size: 12.5px; padding: 6px 8px; border: 1px dashed var(--border); border-radius: 7px; background: #FBFAF6; color: var(--accent-dark); }
        .checkbox-label { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--ink-soft); margin-top: 8px; }
        .checkbox-label input { width: auto; margin: 0; }
        .user-code-footer { text-align: center; font-size: 11.5px; color: var(--ink-soft); margin-top: 24px; }
        .user-code-footer a { color: var(--accent-dark); }
      `}</style>

      <h1>Meal Planner</h1>
      <p className="subtitle">Planeia refeições, guarda receitas e gera a lista de compras.</p>

      <div className="tabs">
        <button className={`tab-btn ${tab === "plano" ? "active" : ""}`} onClick={() => setTab("plano")}>Plano</button>
        <button className={`tab-btn ${tab === "compras" ? "active" : ""}`} onClick={() => setTab("compras")}>Compras</button>
        <button className={`tab-btn ${tab === "receitas" ? "active" : ""}`} onClick={() => setTab("receitas")}>Receitas</button>
      </div>

      <datalist id="dish-names">{allDishNames.map((n) => <option key={n} value={n} />)}</datalist>
      <datalist id="unit-list">
        {["g","kg","ml","l","unidade","dente","fatia","ramo","pitada","chávena","colher de sopa","colher de chá","q.b."].map((u) => <option key={u} value={u} />)}
      </datalist>

      {tab === "plano" && (
        <div>
          <div className="card">
            <div className="period-row">
              <div className="field"><label>Início</label><input type="date" value={draftStart} onChange={(e) => setDraftStart(e.target.value)} /></div>
              {!singleDay && <div className="field"><label>Fim</label><input type="date" value={draftEnd} onChange={(e) => setDraftEnd(e.target.value)} /></div>}
              <button className="btn-primary" disabled={!draftStart || (!singleDay && !draftEnd)} onClick={applyRange}>Ver</button>
            </div>
            <label className="checkbox-label">
              <input type="checkbox" checked={singleDay} onChange={(e) => setSingleDay(e.target.checked)} /> Só este dia
            </label>
          </div>

          {displayedDays.length === 0 && <div className="empty-state">Escolhe uma data (ou período) acima e carrega em "Ver" — todos os dias que já planeaste ficam guardados, por isso podes voltar a qualquer data anterior.</div>}

          {displayedDays.length > 0 && (
            <div className="share-row">
              <a className="wa-btn" href={`https://wa.me/?text=${encodeURIComponent(buildPlanShareText())}`} target="_blank" rel="noopener noreferrer">💬 Partilhar plano</a>
            </div>
          )}

          {displayedDays.map((day) => (
            <div className="day-card card" key={day.date}>
              <p className="day-title">{formatDatePT(day.date)}</p>
              <div className="meal-block">
                <p className="meal-label">Almoço</p>
                {renderSlot(day.date, "almoco", "sopa", day.meals.almoco.sopa, "Sopa", "sopa")}
                {renderSlot(day.date, "almoco", "principal", day.meals.almoco.principal, "Prato principal", "principal")}
                {renderSlot(day.date, "almoco", "acompanhamento", day.meals.almoco.acompanhamento, "Acompanhamento", "acomp")}
                {(day.meals.almoco.extras || []).map((ex) => (
                  <React.Fragment key={ex.id}>{renderSlot(day.date, "almoco", ex.id, ex, "Outro prato", "extra")}</React.Fragment>
                ))}
                <button className="text-btn" onClick={() => addExtraDish(day.date, "almoco")}>➕ Adicionar prato</button>
              </div>
              <div className="meal-block">
                <p className="meal-label">Jantar</p>
                {renderSlot(day.date, "jantar", "sopa", day.meals.jantar.sopa, "Sopa", "sopa")}
                {renderSlot(day.date, "jantar", "principal", day.meals.jantar.principal, "Prato principal", "principal")}
                {renderSlot(day.date, "jantar", "acompanhamento", day.meals.jantar.acompanhamento, "Acompanhamento", "acomp")}
                {(day.meals.jantar.extras || []).map((ex) => (
                  <React.Fragment key={ex.id}>{renderSlot(day.date, "jantar", ex.id, ex, "Outro prato", "extra")}</React.Fragment>
                ))}
                <button className="text-btn" onClick={() => addExtraDish(day.date, "jantar")}>➕ Adicionar prato</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "compras" && (
        <div>
          {shoppingSections.length === 0 && <div className="empty-state">Ainda não há ingredientes. Associa receitas aos pratos no separador Plano.</div>}
          {shoppingSections.length > 0 && (
            <>
              <div className="share-row">
                <a className="wa-btn" href={`https://wa.me/?text=${encodeURIComponent(buildShoppingShareText())}`} target="_blank" rel="noopener noreferrer">💬 Partilhar lista</a>
                <button className="pdf-btn" onClick={exportShoppingPDF}>📄 Descarregar PDF</button>
              </div>
              <div className="card">
                <h2 className="shop-title">Lista de compras</h2>
                {shoppingRangeLabel && <p className="subtitle" style={{ margin: "0 0 4px" }}>{shoppingRangeLabel} · ~ = quantidade estimada</p>}
                {shoppingSections.map((sec) => (
                  <div key={sec.title}>
                    <div className="shop-section">{sec.title}</div>
                    {sec.items.map((item) => (
                      <label className={`shop-item ${checked[item.key] ? "done" : ""}`} key={item.key}>
                        <input type="checkbox" checked={!!checked[item.key]} onChange={(e) => setChecked((c) => ({ ...c, [item.key]: e.target.checked }))} />
                        {item.name}
                        <span className="shop-qty">{item.qty}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "receitas" && (
        <div>
          <div className="card">
            <input className="filter-input" style={{ width: "100%" }} placeholder="Pesquisar receitas guardadas…" value={recipeFilter} onChange={(e) => setRecipeFilter(e.target.value)} />
          </div>
          <div className="card">
            <label className="photo-btn">
              📷 Adicionar receita por foto
              <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { handlePhotoFiles(e.target.files); e.target.value = ""; }} />
            </label>
            <p className="subtitle" style={{ margin: "6px 0 0" }}>Tira uma fotografia à receita (ou escolhe da galeria). Até 4 fotos, se tiver várias páginas.</p>
            {photoState.status === "loading" && <p className="subtitle" style={{ marginTop: 8 }}>⏳ A ler a receita… pode demorar até 30 segundos.</p>}
            {photoState.status === "error" && (
              <div style={{ marginTop: 8 }}>
                <p className="subtitle" style={{ color: "var(--danger)" }}>Não consegui ler a receita. {photoState.message}</p>
                <button className="text-btn" onClick={() => setPhotoState({ status: "idle" })}>Fechar</button>
              </div>
            )}
            {photoState.status === "review" && (
              <div style={{ marginTop: 10 }}>
                <p className="subtitle" style={{ margin: "0 0 6px" }}>Confirma o que a app leu e corrige se for preciso:</p>
                <input className="slot-input" style={{ width: "100%", marginBottom: 6 }} placeholder="Nome da receita" value={photoState.draft.name} onChange={(e) => updatePhotoDraft({ name: e.target.value })} />
                <select className="cat-select" style={{ marginBottom: 6 }} value={photoState.draft.category} onChange={(e) => updatePhotoDraft({ category: e.target.value })}>
                  {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
                </select>
                <IngredientEditor ingredients={photoState.draft.ingredients} onChange={(ings) => updatePhotoDraft({ ingredients: ings })} />
                <textarea className="prep-textarea" placeholder="Modo de preparação (opcional)" value={photoState.draft.prep || ""} onChange={(e) => updatePhotoDraft({ prep: e.target.value })} />
                <div className="btn-row">
                  <button className="text-btn primary" onClick={savePhotoRecipe}>✓ Guardar receita</button>
                  <button className="text-btn" onClick={() => setPhotoState({ status: "idle" })}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
          {Object.keys(recipes).length > 0 && (
            <div className="share-row">
              <a className="wa-btn" href={`https://wa.me/?text=${encodeURIComponent(buildRecipeBookShareText())}`} target="_blank" rel="noopener noreferrer">💬 Partilhar livro completo</a>
            </div>
          )}
          {CATEGORY_ORDER.map((cat) => (
            <div className="cat-section" key={cat}>
              <div className="cat-header">
                <span className="cat-dot" style={{ background: CATEGORY_META[cat].color }} />{CATEGORY_META[cat].label} <span className="recipe-count">({recipesByCategory[cat].length})</span>
                {recipesByCategory[cat].length > 0 && (
                  <a className="icon-btn ghost" style={{ marginLeft: "auto" }} href={`https://wa.me/?text=${encodeURIComponent(buildRecipeBookShareText(cat))}`} target="_blank" rel="noopener noreferrer" aria-label="Partilhar categoria">💬</a>
                )}
              </div>
              {recipesByCategory[cat].length === 0 && <p className="subtitle" style={{ margin: "0 0 8px" }}>Sem receitas guardadas ainda.</p>}
              {recipesByCategory[cat].map((r) => (
                <div className="recipe-card" key={r.id}>
                  {editingRecipeId === r.id ? (
                    <div>
                      <input className="slot-input" style={{ width: "100%", marginBottom: 6 }} value={editDraft.name} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} />
                      <select className="cat-select" style={{ marginBottom: 6 }} value={editDraft.category} onChange={(e) => setEditDraft({ ...editDraft, category: e.target.value })}>
                        {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
                      </select>
                      <IngredientEditor ingredients={editDraft.ingredients} onChange={(ings) => setEditDraft({ ...editDraft, ingredients: ings })} />
                      <textarea className="prep-textarea" placeholder="Modo de preparação (opcional)" value={editDraft.prep || ""} onChange={(e) => setEditDraft({ ...editDraft, prep: e.target.value })} />
                      <div className="btn-row">
                        <button className="text-btn primary" onClick={saveEditRecipe}>✓ Guardar</button>
                        <button className="text-btn" onClick={cancelEditRecipe}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="recipe-head" onClick={() => setExpandedRecipes((s) => ({ ...s, [r.id]: !s[r.id] }))}>
                        <span className="recipe-name">{r.name}</span>
                        <span className="recipe-count">{r.ingredients.length} ing.</span>
                        {expandedRecipes[r.id] ? "▾" : "▸"}
                      </div>
                      {expandedRecipes[r.id] && (
                        <>
                          <ul className="ing-list-mini">
                            {r.ingredients.map((i) => <li key={i.id}>{i.name}{i.quantity ? ` — ${i.quantity}${i.unit ? " " + i.unit : ""}` : ""}</li>)}
                          </ul>
                          {r.prep && <p className="draft-prep">{r.prep}</p>}
                          <div className="recipe-actions">
                            <a className="icon-btn ghost" href={`https://wa.me/?text=${encodeURIComponent(buildRecipeShareText(r))}`} target="_blank" rel="noopener noreferrer" aria-label="Partilhar">💬</a>
                            <button className="text-btn" onClick={() => startEditRecipe(r)}>Editar</button>
                            <button className="text-btn" style={{ color: "var(--danger)" }} onClick={() => deleteRecipe(r.id)}>🗑️ Apagar</button>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <p className="user-code-footer">
        Código: <strong>{userCode}</strong> ·{" "}
        <a href="#" onClick={(e) => { e.preventDefault(); if (window.confirm("Mudar de código? Vais deixar de ver os dados deste código neste aparelho (podes voltar a introduzi-lo mais tarde).")) { try { window.localStorage.removeItem("userCode"); } catch (err) {} window.location.reload(); } }}>mudar código</a>
      </p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

const { useState, useEffect, useMemo, Fragment } = React;


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

// ---------- chamada à API para pesquisa de receitas ----------
async function searchRecipeOnline(dishName) {
  const response = await fetch("/api/search-recipe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dishName }),
  });
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
  const [plan, setPlan] = useState({ startDate: "", endDate: "", days: [] });
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

  // ---------- carregar dados persistidos ----------
  useEffect(() => {
    (async () => {
      try { const r = await window.storage.get("plan"); if (r) { const p = JSON.parse(r.value); setPlan(p); setDraftStart(p.startDate || ""); setDraftEnd(p.endDate || ""); } } catch (e) {}
      try { const r = await window.storage.get("dishes"); if (r) setDishes(JSON.parse(r.value)); } catch (e) {}
      try { const r = await window.storage.get("recipes"); if (r) setRecipes(JSON.parse(r.value)); } catch (e) {}
      try { const r = await window.storage.get("checked"); if (r) setChecked(JSON.parse(r.value)); } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => { if (loaded) window.storage.set("plan", JSON.stringify(plan), false).catch(() => {}); }, [plan, loaded]);
  useEffect(() => { if (loaded) window.storage.set("dishes", JSON.stringify(dishes), false).catch(() => {}); }, [dishes, loaded]);
  useEffect(() => { if (loaded) window.storage.set("recipes", JSON.stringify(recipes), false).catch(() => {}); }, [recipes, loaded]);
  useEffect(() => { if (loaded) window.storage.set("checked", JSON.stringify(checked), false).catch(() => {}); }, [checked, loaded]);

  // ---------- plano ----------
  const generateDays = () => {
    if (!draftStart || !draftEnd || draftStart > draftEnd) return;
    const dates = buildDateRange(draftStart, draftEnd);
    setPlan((prev) => {
      const byDate = {}; prev.days.forEach((d) => (byDate[d.date] = d));
      const days = dates.map((date) => byDate[date] || { date, meals: { almoco: emptyMeal(), jantar: emptyMeal() } });
      return { startDate: draftStart, endDate: draftEnd, days };
    });
  };

  const upsertDish = (name, category) => {
    const key = normalize(name);
    if (!key) return;
    setDishes((d) => ({ ...d, [key]: { name: name.trim(), category } }));
  };

  const patchSlot = (dateISO, mealType, slotKey, patch) => {
    setPlan((p) => ({
      ...p,
      days: p.days.map((d) => {
        if (d.date !== dateISO) return d;
        const meal = { ...d.meals[mealType] };
        if (slotKey === "sopa" || slotKey === "principal" || slotKey === "acompanhamento") {
          meal[slotKey] = { ...meal[slotKey], ...patch };
        } else {
          meal.extras = (meal.extras || []).map((ex) => (ex.id === slotKey ? { ...ex, ...patch } : ex));
        }
        return { ...d, meals: { ...d.meals, [mealType]: meal } };
      }),
    }));
  };

  const findSlot = (dateISO, mealType, slotKey) => {
    const day = plan.days.find((d) => d.date === dateISO);
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
    setPlan((p) => ({
      ...p,
      days: p.days.map((d) => {
        if (d.date !== dateISO) return d;
        const meal = { ...d.meals[mealType] };
        meal.extras = [...(meal.extras || []), { id: uid(), name: "", category: null, recipeId: null }];
        return { ...d, meals: { ...d.meals, [mealType]: meal } };
      }),
    }));
  };

  const removeExtraDish = (dateISO, mealType, id) => {
    setPlan((p) => ({
      ...p,
      days: p.days.map((d) => {
        if (d.date !== dateISO) return d;
        const meal = { ...d.meals[mealType] };
        meal.extras = (meal.extras || []).filter((e) => e.id !== id);
        return { ...d, meals: { ...d.meals, [mealType]: meal } };
      }),
    }));
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

  // ---------- lista de compras ----------
  const shoppingList = useMemo(() => {
    const map = {};
    plan.days.forEach((day) => {
      ["almoco", "jantar"].forEach((mealType) => {
        const meal = day.meals[mealType];
        const slots = [meal.sopa, meal.principal, meal.acompanhamento, ...(meal.extras || [])];
        slots.forEach((slot) => {
          if (!slot || !slot.recipeId) return;
          const recipe = recipes[slot.recipeId];
          if (!recipe) return;
          recipe.ingredients.forEach((ing) => {
            const unit = (ing.unit || "").trim();
            const key = normalize(ing.name) + "|" + normalize(unit);
            if (!map[key]) map[key] = { key, name: ing.name, unit, numeric: 0, hasNumeric: false, texts: [] };
            const qtyStr = String(ing.quantity ?? "").trim();
            const num = parseFloat(qtyStr.replace(",", "."));
            if (!isNaN(num) && /^[\d.,\s]+$/.test(qtyStr)) { map[key].numeric += num; map[key].hasNumeric = true; }
            else if (qtyStr && !map[key].texts.includes(qtyStr)) map[key].texts.push(qtyStr);
          });
        });
      });
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name, "pt"));
  }, [plan, recipes]);

  const displayQty = (item) => {
    const parts = [];
    if (item.hasNumeric) { const n = Number.isInteger(item.numeric) ? item.numeric : Math.round(item.numeric * 100) / 100; parts.push(`${n}${item.unit ? " " + item.unit : ""}`); }
    if (item.texts.length) parts.push(item.texts.join(", "));
    return parts.join(" + ") || "q.b.";
  };

  const buildShoppingShareText = () => {
    const range = plan.startDate ? ` (${formatShort(plan.startDate)} a ${formatShort(plan.endDate)})` : "";
    const lines = shoppingList.map((i) => `- ${i.name}: ${displayQty(i)}`);
    return `🛒 Lista de compras${range}\n\n${lines.join("\n")}`;
  };

  const buildPlanShareText = () => {
    const range = plan.startDate ? ` (${formatShort(plan.startDate)} a ${formatShort(plan.endDate)})` : "";
    const fmt = (m) => [m.sopa.name, m.principal.name, m.acompanhamento.name, ...(m.extras || []).map((e) => e.name)].filter(Boolean).join(" | ") || "—";
    const dayLines = plan.days.map((day) => `${formatDatePT(day.date)}\nAlmoço: ${fmt(day.meals.almoco)}\nJantar: ${fmt(day.meals.jantar)}`);

    const usedIds = new Set();
    plan.days.forEach((day) => {
      ["almoco", "jantar"].forEach((mealType) => {
        const meal = day.meals[mealType];
        [meal.sopa, meal.principal, meal.acompanhamento, ...(meal.extras || [])].forEach((slot) => {
          if (slot && slot.recipeId) usedIds.add(slot.recipeId);
        });
      });
    });
    const usedRecipes = Array.from(usedIds).map((id) => recipes[id]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, "pt"));
    const recipesBlock = usedRecipes.length ? `\n\n———\n📖 Receitas do período\n\n${usedRecipes.map((r) => buildRecipeShareText(r)).join("\n\n")}` : "";

    return `📅 Plano de refeições${range}\n\n${dayLines.join("\n\n")}${recipesBlock}`;
  };

  const buildRecipeShareText = (recipe) => {
    const lines = recipe.ingredients.map((i) => `- ${i.name}${i.quantity ? `: ${i.quantity}${i.unit ? " " + i.unit : ""}` : ""}`);
    return `🍲 ${recipe.name}\n\nIngredientes:\n${lines.join("\n")}${recipe.prep ? `\n\nPreparação: ${recipe.prep}` : ""}${recipe.sourceUrl ? `\n\nFonte: ${recipe.sourceUrl}` : ""}`;
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
        .share-row { display: flex; justify-content: flex-end; margin: 10px 0; }
        .wa-btn, .icon-btn { text-decoration: none; }
        .wa-btn { display: flex; align-items: center; gap: 6px; background: var(--wa); color: #fff; border: none; border-radius: 8px; padding: 9px 14px; font-size: 13.5px; font-weight: 500; cursor: pointer; }
        .empty-state { text-align: center; padding: 30px 10px; color: var(--ink-soft); font-size: 13.5px; }
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
      `}</style>

      <h1>Ementas &amp; Compras</h1>
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
              <div className="field"><label>Fim</label><input type="date" value={draftEnd} onChange={(e) => setDraftEnd(e.target.value)} /></div>
              <button className="btn-primary" disabled={!draftStart || !draftEnd} onClick={generateDays}>Gerar</button>
            </div>
          </div>

          {plan.days.length === 0 && <div className="empty-state">Escolhe um período acima e carrega em "Gerar" para começar.</div>}

          {plan.days.length > 0 && (
            <div className="share-row">
              <a className="wa-btn" href={`https://wa.me/?text=${encodeURIComponent(buildPlanShareText())}`} target="_blank" rel="noopener noreferrer">💬 Partilhar plano</a>
            </div>
          )}

          {plan.days.map((day) => (
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
          {shoppingList.length === 0 && <div className="empty-state">Ainda não há ingredientes. Associa receitas aos pratos no separador Plano.</div>}
          {shoppingList.length > 0 && (
            <>
              <div className="share-row">
                <a className="wa-btn" href={`https://wa.me/?text=${encodeURIComponent(buildShoppingShareText())}`} target="_blank" rel="noopener noreferrer">💬 Partilhar lista</a>
              </div>
              <div className="card">
                {shoppingList.map((item) => (
                  <label className={`shop-item ${checked[item.key] ? "done" : ""}`} key={item.key}>
                    <input type="checkbox" checked={!!checked[item.key]} onChange={(e) => setChecked((c) => ({ ...c, [item.key]: e.target.checked }))} />
                    {item.name}
                    <span className="shop-qty">{displayQty(item)}</span>
                  </label>
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
          {CATEGORY_ORDER.map((cat) => (
            <div className="cat-section" key={cat}>
              <div className="cat-header"><span className="cat-dot" style={{ background: CATEGORY_META[cat].color }} />{CATEGORY_META[cat].label} <span className="recipe-count">({recipesByCategory[cat].length})</span></div>
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
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

// Servidor local muito simples:
// 1) Serve os ficheiros da app (pasta "public").
// 2) Recebe pedidos de pesquisa de receitas e chama a Anthropic API,
//    usando a tua chave de API que fica só aqui no servidor (nunca no browser).

require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;

// Limite maior porque as fotografias de receitas são enviadas em base64
app.use(express.json({ limit: "25mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/search-recipe", async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({
      error: "Falta configurar a chave de API. Cria um ficheiro .env nesta pasta com a linha ANTHROPIC_API_KEY=a-tua-chave (ver README.md).",
    });
  }

  const dishName = (req.body && req.body.dishName) || "";
  if (!dishName.trim()) {
    return res.status(400).json({ error: "Falta o nome do prato." });
  }

  const system = `Pesquisa na internet uma receita real, comum e prática para o prato "${dishName}" (cozinha portuguesa ou popular em Portugal). Responde APENAS com um objeto JSON válido, sem markdown, sem texto antes ou depois, exatamente neste formato:
{"name":"nome do prato","category":"sopa|carne|peixe|massa|arroz|acompanhamento","ingredients":[{"name":"nome do ingrediente","quantity":"quantidade (número ou texto como 'q.b.')","unit":"unidade (ex: g, ml, unidade, colher de sopa; vazio se não aplicável)"}],"sourceUrl":"URL da receita usada","prep":"resumo da preparação em no máximo 2 frases"}
Calcula as quantidades para 4 pessoas. Usa nomes de ingredientes correntes em português.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system,
        messages: [{ role: "user", content: `Prato: ${dishName}` }],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error ? data.error.message : "Erro na Anthropic API", details: data });
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

// ---------- ler uma receita a partir de fotografia(s) ----------
app.post("/api/parse-recipe-photo", async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({ error: "Falta configurar a chave de API (ANTHROPIC_API_KEY)." });
  }
  const images = (req.body && req.body.images) || [];
  const validTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!Array.isArray(images) || images.length === 0 || images.length > 4 ||
      !images.every((i) => i && validTypes.includes(i.media_type) && typeof i.data === "string" && i.data.length > 100)) {
    return res.status(400).json({ error: "Envia entre 1 e 4 imagens (jpeg, png ou webp)." });
  }

  const system = `Vais receber uma ou mais fotografias de UMA receita de cozinha (livro, revista, caderno ou ecrã). Lê o texto e responde APENAS com um objeto JSON válido, sem markdown, sem texto antes ou depois, exatamente neste formato:
{"name":"nome do prato","category":"sopa|carne|peixe|massa|arroz|acompanhamento","ingredients":[{"name":"nome do ingrediente","quantity":"quantidade só com números, ex: 250, 1.5, 1/2; ou 'q.b.'","unit":"unidade"}],"prep":"resumo da preparação em no máximo 3 frases"}
Regras:
- Copia as quantidades tal como estão escritas na receita (não recalcules para outro número de pessoas).
- Usa estas unidades sempre que possível: g, kg, ml, dl, l, unidade, dente, colher de sopa, colher de chá, chávena, fatia, ramo, folha, molho, lata, pitada. Se o ingrediente não tiver quantidade, usa quantity "q.b." e unit vazio.
- O campo "name" só leva o nome do ingrediente (ex: "cebola", "azeite"), sem a quantidade nem notas como "picada".
- Escreve em português de Portugal.
- Se a imagem não tiver uma receita legível, devolve {"name":"","category":"","ingredients":[],"prep":""}.`;

  const content = images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.media_type, data: i.data } }));
  content.push({ type: "text", text: "Lê esta receita e devolve o JSON." });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system,
        messages: [{ role: "user", content }],
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error ? data.error.message : "Erro na Anthropic API", details: data });
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

// ---------- sincronização entre dispositivos (código pessoal) ----------
// Usa o Supabase (base de dados gratuita) como armazenamento remoto, para os dados
// ficarem disponíveis em qualquer telemóvel/tablet/PC que uses com o mesmo código.
// Se SUPABASE_URL / SUPABASE_KEY não estiverem configurados, estes endpoints
// respondem com "não configurado" e a app continua a funcionar apenas localmente.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

app.get("/api/data/:code", async (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(503).json({ error: "Sincronização entre aparelhos não configurada (ver README.md)." });
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/user_data?code=eq.${encodeURIComponent(req.params.code)}&select=data`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) { const t = await r.text(); return res.status(r.status).json({ error: t }); }
    const rows = await r.json();
    res.json({ data: (rows && rows[0] && rows[0].data) || null });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

app.post("/api/data/:code", async (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(503).json({ error: "Sincronização entre aparelhos não configurada (ver README.md)." });
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/user_data`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify([{ code: req.params.code, data: req.body, updated_at: new Date().toISOString() }]),
    });
    if (!r.ok) { const t = await r.text(); return res.status(r.status).json({ error: t }); }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`\nApp a correr! Abre no browser: http://localhost:${PORT}\n`);
});

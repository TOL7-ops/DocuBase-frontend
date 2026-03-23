# AGENT_BUILD_V2.md
# Build Instructions — Personal Knowledge Backend (RAG System)

> **Reference contract:** `SYSTEM_CONTRACT_V2.md` (must be present in context)  
> **Rule:** Do not proceed to the next phase until the current phase passes ALL validation checks.  
> **Rule:** Do not modify any API shape, field name, or response structure defined in the contract.  
> **Rule:** If a validation check fails, fix the current phase before continuing.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| Framework | Express.js |
| Database | SQLite (via `better-sqlite3`) |
| Embeddings + LLM | Ollama (local) — `nomic-embed-text` + `qwen2.5:7b` |
| Math parser | `mathjs` (safe eval replacement for calculator tool) |
| Logger | `pino` (structured JSON logs) |
| UUID | `crypto.randomUUID()` (built-in Node 18+) |

---

## Folder Structure (create before Phase 1)

```
rag-backend/
├── src/
│   ├── index.js              # Express app entry point
│   ├── db.js                 # SQLite setup and migrations
│   ├── logger.js             # Pino structured logger
│   ├── ollama.js             # Ollama client (embeddings + LLM)
│   ├── chunker.js            # Text chunking utility
│   ├── retriever.js          # Cosine similarity search
│   ├── tools/
│   │   ├── calculator.js     # Safe math evaluation
│   │   └── date.js           # Date tool
│   └── routes/
│       ├── documents.js      # POST /documents, GET /documents
│       ├── ask.js            # POST /ask
│       ├── sessions.js       # GET /sessions/:id
│       └── health.js         # GET /health
├── logs/
│   └── app.log               # Structured JSON logs (auto-created)
├── data/
│   └── rag.db                # SQLite database (auto-created)
├── package.json
└── .env                      # OLLAMA_BASE_URL=http://localhost:11434
```

---

## Database Schema (implement in db.js)

```sql
CREATE TABLE IF NOT EXISTS documents (
  document_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chunks (
  chunk_id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  char_start INTEGER NOT NULL,
  char_end INTEGER NOT NULL,
  embedding TEXT NOT NULL,       -- JSON-serialized float array
  FOREIGN KEY (document_id) REFERENCES documents(document_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_turns (
  turn_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  turn_number INTEGER NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sources TEXT NOT NULL,         -- JSON array of chunk_ids
  tool_used TEXT,                -- null or tool name string
  timestamp TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);
```

---

## PHASE 1 — Core Infrastructure

**Goal:** Running server, health check, database, logging.

**Implement:**
1. `db.js` — Initialize SQLite, run schema migrations on startup.
2. `logger.js` — Pino logger writing JSON to `./logs/app.log`.
3. `ollama.js` — Stub client with `ping()` function (checks Ollama reachability via `GET /api/tags`).
4. `index.js` — Express app, mount `GET /health` route.
5. `health.js` route — Call `db` and `ollama.ping()`, return contract-compliant health shape.

**Validation (all must pass):**
- [ ] `node src/index.js` starts without errors on port 3000
- [ ] `GET /health` returns `{ "status": "ok", "ollama": "connected", "db": "connected" }`
- [ ] `GET /health` returns `{ "status": "degraded", "ollama": "unreachable" }` when Ollama is stopped
- [ ] A JSON log entry appears in `./logs/app.log` for the health request

---

## PHASE 2 — Document Storage (No Embeddings)

**Goal:** Store documents in SQLite. No chunking or embeddings yet.

**Implement:**
1. `POST /documents` route — Accept `title` + `content`, validate inputs, store document, return 201.
2. `GET /documents` route — Return list of stored documents.
3. Input validation for both endpoints (return 400 with error shape on invalid input).

**Do NOT implement chunking or embedding in this phase.**  
Set `chunks_indexed: 0` in the POST response as a placeholder.

**Validation (all must pass):**
- [ ] `POST /documents` with valid body returns 201 with a `document_id` UUID
- [ ] `GET /documents` returns the uploaded document in the array
- [ ] `POST /documents` with missing `title` returns `{ "error": "VALIDATION_ERROR" }`
- [ ] `GET /documents` returns `[]` when no documents exist (not 404)

---

## PHASE 3 — Chunking Layer

**Goal:** Chunk document content and store chunks. No embeddings yet.

**Implement:**
1. `chunker.js` — Split text into chunks per contract spec:
   - 512 tokens (≈ 2048 chars)
   - 64 token overlap (≈ 256 chars)
   - Minimum chunk size: 50 tokens (≈ 200 chars)
   - Return array of `{ chunk_id, chunk_index, content, char_start, char_end }`
2. Update `POST /documents` — After saving document, call chunker, store chunks in `chunks` table.
3. Update POST response — Set `chunks_indexed` to actual chunk count (no longer 0).
4. Store chunk content and metadata. Leave `embedding` column as empty string for now.

**Validation (all must pass):**
- [ ] Upload a document with 3000+ characters
- [ ] Query `chunks` table directly — confirm multiple rows exist for the document
- [ ] `POST /documents` response shows `chunks_indexed >= 2`
- [ ] Each chunk has a unique `chunk_id` and correct `chunk_index` sequence

---

## PHASE 4 — Embedding & Vector Index

**Goal:** Generate embeddings for all chunks. Enable similarity search.

**Implement:**
1. `ollama.js` — Add `embed(text)` function:
   - `POST http://localhost:11434/api/embeddings`
   - Body: `{ "model": "nomic-embed-text", "prompt": text }`
   - Returns float array (768 dimensions)
2. Update `POST /documents` — After chunking, call `embed()` for each chunk. Store JSON-serialized embedding in `chunks.embedding`.
3. `retriever.js` — Implement:
   - `cosineSimilarity(vecA, vecB)` — pure function, returns float
   - `topK(queryEmbedding, k=5, threshold=0.30)` — loads all chunks, scores them, returns top-k above threshold sorted by score descending

**Validation (all must pass):**
- [ ] Upload a document — confirm `chunks.embedding` column is populated (not empty string)
- [ ] Call `topK` directly in a test script with a query related to the document
- [ ] Confirm top result has relevance score > 0.30
- [ ] Confirm results are sorted highest score first
- [ ] Unrelated query returns 0 results (all below threshold)

---

## PHASE 5 — Basic /ask Endpoint (Retrieval Only, No LLM)

**Goal:** Wire up POST /ask with retrieval. Return chunks without LLM processing.

**Implement:**
1. `ask.js` route — Validate input, embed the question, call `topK`, return contract-compliant shape.
2. Session handling — If no `session_id`, generate one and insert into `sessions` table.
3. If no chunks retrieved above threshold, return the fallback answer string immediately (no LLM call).
4. For now, set `answer` to `"[RETRIEVAL_ONLY — LLM not yet integrated]"` when chunks exist.

**Validation (all must pass):**
- [ ] `POST /ask` with question related to uploaded document returns `retrieval_count >= 1`
- [ ] `sources` array contains chunk objects with `chunk_id`, `document_id`, `relevance_score`
- [ ] `POST /ask` with off-topic question returns fallback answer and `retrieval_count: 0`
- [ ] Response always includes a `session_id`
- [ ] `POST /ask` with missing `question` returns 400 error shape

---

## PHASE 6 — LLM Integration

**Goal:** Replace placeholder answer with grounded LLM response.

**Implement:**
1. `ollama.js` — Add `chat(systemPrompt, userPrompt)` function:
   - `POST http://localhost:11434/api/generate`
   - Body: `{ "model": "qwen2.5:7b", "system": systemPrompt, "prompt": userPrompt, "stream": false, "options": { "temperature": 0.1 } }`
   - Returns response string
2. Update `ask.js` — When chunks are retrieved:
   - Build context string from top-k chunk content
   - Call LLM with system prompt from contract (verbatim)
   - User prompt: `"Context:\n{chunks}\n\nQuestion: {question}"`
   - Set `answer` to LLM response
3. Keep fallback — If no chunks, skip LLM entirely and return fallback string.

**Validation (all must pass):**
- [ ] Upload a document. Ask a question answered by it. Response contains relevant content from document.
- [ ] Ask an off-topic question. Response is exactly: `"The answer is not found in the uploaded documents."`
- [ ] LLM never called when `retrieval_count === 0` (verify via logs)
- [ ] `sources` in response only contains chunk IDs that were actually retrieved

---

## PHASE 7 — Session Memory

**Goal:** Persist conversation history. Use history as context for follow-up questions.

**Implement:**
1. After each successful `/ask`, save turn to `session_turns` table.
2. `GET /sessions/:id` route — Query `session_turns` by session_id, return contract-compliant shape with ordered history.
3. Update `/ask` — When `session_id` is provided, load last 5 turns and prepend as conversation context to the LLM prompt.
4. Return 404 with `SESSION_NOT_FOUND` error if session_id not found.

**Validation (all must pass):**
- [ ] Ask two questions in the same session
- [ ] `GET /sessions/:id` returns both turns in `history` array with correct `turn` numbers
- [ ] Follow-up question that references prior answer is answered correctly
- [ ] Providing unknown `session_id` to `/ask` returns 404 with `SESSION_NOT_FOUND`

---

## PHASE 8 — Tool Layer

**Goal:** LLM can suggest tools; backend executes them deterministically.

**Implement:**
1. `tools/calculator.js` — Use `mathjs` to evaluate expressions safely. Return result or error string.
2. `tools/date.js` — Handle `"today"`, `"now"`, `"timestamp"` inputs. Return ISO-8601 string.
3. Update LLM system prompt — Append tool instruction:
   ```
   If the question requires calculation, respond with JSON only:
   {"tool": "calculator", "input": "<expression>"}
   If the question asks for today's date, respond with JSON only:
   {"tool": "date", "input": "today"}
   Otherwise answer normally.
   ```
4. Update `ask.js` — After LLM response, attempt JSON parse. If `tool` key present, execute tool, set `tool_used` in response.

**Validation (all must pass):**
- [ ] Ask `"What is 142 * 365?"` — response contains `51830`, `tool_used: "calculator"`
- [ ] Ask `"What is today's date?"` — response contains ISO date, `tool_used: "date"`
- [ ] `calculator` with `"1/0"` returns error gracefully (no server crash)
- [ ] Tool usage logged in `app.log` with `tool_used` field set

---

## FINAL VALIDATION

Run all checks before declaring system complete:

```
[ ] GET /health returns ok
[ ] POST /documents returns 201 with chunks_indexed > 0
[ ] GET /documents lists uploaded documents
[ ] POST /ask returns grounded answer with sources
[ ] POST /ask returns fallback when off-topic
[ ] GET /sessions/:id returns ordered history
[ ] Calculator tool returns correct result
[ ] Date tool returns ISO-8601 date
[ ] All error paths return { "error": "...", "message": "..." }
[ ] All requests produce structured JSON log entries
[ ] No endpoint shape deviates from SYSTEM_CONTRACT_V2.md
```

If any check fails: fix, re-test, then proceed.

---

## Notes for Agents

- **Never use `eval()`** for the calculator. Use `mathjs.evaluate()`.
- **Never embed the full document** as a single vector. Chunking must happen first.
- **Never call the LLM** when `retrieval_count === 0`. Return the fallback directly.
- **Never store raw floats** as separate DB rows. Serialize embedding arrays as JSON strings.
- **Never return 404** for `GET /documents` when empty. Return `[]`.
- **Session IDs are UUIDs.** Generate with `crypto.randomUUID()`.

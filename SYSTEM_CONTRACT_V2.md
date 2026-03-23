# SYSTEM_CONTRACT_V2.md
# Personal Knowledge Backend – RAG System

> **Contract Version:** 2.0  
> **Status:** Authoritative. All agents must reference this file exactly.  
> **Breaking changes from V1:** Error contracts added, chunking params pinned, embedding model pinned, tool I/O defined, validation criteria made testable.

---

## 1. System Purpose

This backend is a local knowledge engine that allows users to:

- Upload and index documents
- Ask grounded, evidence-backed questions
- Use deterministic tools (calculator, date)
- Maintain session memory across turns

**Architecture principle:** Deterministic at the orchestration layer. Probabilistic only at the LLM reasoning layer.

---

## 2. Core Principles

1. **LLM is not the source of truth.** All answers must be grounded in retrieved context or tool outputs.
2. **No hallucinated data.** If context is absent, the system must say so explicitly.
3. **Stable API contracts.** Endpoint shapes must never change without a version bump.
4. **Deterministic fallbacks.** Every LLM path has a non-LLM fallback.
5. **Traceable requests.** Every request produces a structured log entry.

---

## 3. Base URL

```
http://localhost:3000
```

CORS must allow `http://localhost:*` (client-side dev). No auth required for localhost. If exposed beyond localhost, add `X-API-Key` header enforcement.

---

## 4. Endpoints

### POST /documents

Upload and index a document.

**Request:**
```json
{
  "title": "string (required, max 255 chars)",
  "content": "string (required, min 10 chars, max 500,000 chars)"
}
```

**Success Response — 201:**
```json
{
  "document_id": "uuid-v4",
  "title": "string",
  "chunks_indexed": 12,
  "created_at": "ISO-8601 timestamp"
}
```

**Error Responses:**
```json
// 400 — Validation failure
{
  "error": "VALIDATION_ERROR",
  "message": "content must be at least 10 characters",
  "field": "content"
}

// 500 — Internal failure
{
  "error": "INTERNAL_ERROR",
  "message": "Failed to generate embeddings",
  "request_id": "uuid-v4"
}
```

**Rules:**
- Content must be chunked before storage (see Section 5 for chunking spec).
- Embeddings generated per chunk using the pinned model (see Section 6).
- No LLM reasoning during upload.
- `chunks_indexed` must equal the actual number of chunks stored in DB.

---

### GET /documents

List all uploaded documents.

**Success Response — 200:**
```json
[
  {
    "document_id": "uuid-v4",
    "title": "string",
    "chunk_count": 12,
    "created_at": "ISO-8601 timestamp"
  }
]
```

**Returns empty array `[]` when no documents exist. Never returns 404 for empty state.**

---

### POST /ask

Primary query endpoint.

**Request:**
```json
{
  "question": "string (required, min 3 chars, max 2000 chars)",
  "session_id": "uuid-v4 (optional — omit to start new session)"
}
```

**Success Response — 200:**
```json
{
  "answer": "string",
  "sources": [
    {
      "chunk_id": "uuid-v4",
      "document_id": "uuid-v4",
      "document_title": "string",
      "relevance_score": 0.87
    }
  ],
  "session_id": "uuid-v4",
  "retrieval_count": 3,
  "tool_used": null
}
```

**No-context fallback (still 200):**
```json
{
  "answer": "The answer is not found in the uploaded documents.",
  "sources": [],
  "session_id": "uuid-v4",
  "retrieval_count": 0,
  "tool_used": null
}
```

**Error Responses:**
```json
// 400
{
  "error": "VALIDATION_ERROR",
  "message": "question is required"
}

// 404 — session_id provided but not found
{
  "error": "SESSION_NOT_FOUND",
  "message": "No session found with id: <id>"
}

// 500
{
  "error": "INTERNAL_ERROR",
  "message": "LLM inference failed",
  "request_id": "uuid-v4"
}
```

**Rules:**
- If `session_id` is omitted, generate and return a new UUID.
- `sources` must always be an array (never null).
- `retrieval_count` is the number of chunks retrieved (0 if none).
- `tool_used` is `"calculator"`, `"date"`, or `null`.
- Answer must never contain fabricated citations or chunk IDs not in `sources`.

---

### GET /sessions/:id

Return session conversation history.

**Success Response — 200:**
```json
{
  "session_id": "uuid-v4",
  "created_at": "ISO-8601 timestamp",
  "history": [
    {
      "turn": 1,
      "question": "string",
      "answer": "string",
      "sources": ["chunk-uuid-1", "chunk-uuid-2"],
      "tool_used": null,
      "timestamp": "ISO-8601 timestamp"
    }
  ]
}
```

**Error Response:**
```json
// 404
{
  "error": "SESSION_NOT_FOUND",
  "message": "No session found with id: <id>"
}
```

---

### GET /health

System health check.

**Success Response — 200:**
```json
{
  "status": "ok",
  "ollama": "connected",
  "db": "connected",
  "timestamp": "ISO-8601 timestamp"
}
```

**Degraded Response — 200 (system partially functional):**
```json
{
  "status": "degraded",
  "ollama": "unreachable",
  "db": "connected",
  "timestamp": "ISO-8601 timestamp"
}
```

---

## 5. Chunking Specification

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Chunk size | **512 tokens** | Balances retrieval precision vs. context completeness |
| Chunk overlap | **64 tokens** | Prevents context loss at boundaries |
| Tokenizer | **character-approximate** (1 token ≈ 4 chars) | No tokenizer dependency; good enough for chunking |
| Min chunk size | **50 tokens** | Discard trailing micro-chunks |
| Metadata per chunk | `chunk_id`, `document_id`, `chunk_index`, `char_start`, `char_end` | Required for source attribution |

**Chunking must happen before embedding generation. Never embed the full document as a single vector.**

---

## 6. Embedding & Retrieval Specification

| Parameter | Value |
|-----------|-------|
| Embedding model | `nomic-embed-text` (via Ollama) |
| Embedding dimensions | 768 |
| Similarity metric | Cosine similarity |
| Top-k retrieval | **5 chunks** (default, not configurable via API) |
| Minimum relevance threshold | **0.30** — chunks below this score are discarded |
| Index type | In-memory cosine search (SQLite + computed at query time) |

**Both the query and stored chunks must use the same model. If the model changes, all embeddings must be regenerated.**

---

## 7. LLM Specification

| Parameter | Value |
|-----------|-------|
| Provider | Ollama (local) |
| Model | `qwen2.5:7b` |
| Max context tokens | 4096 |
| Temperature | 0.1 (near-deterministic for grounded Q&A) |
| System prompt | See below — must be used verbatim |

**Required system prompt (use verbatim):**
```
You are a precise question-answering assistant.
Answer the user's question using ONLY the context provided below.
Do not use any external knowledge.
If the answer is not present in the context, respond with exactly:
"The answer is not found in the uploaded documents."
Do not fabricate citations, statistics, names, or dates.
```

---

## 8. Tool Layer

Tools are executed by the backend. The LLM may suggest a tool via structured output, but never executes one directly.

### Tool: calculator

**Trigger:** Question contains arithmetic expression or asks for a calculation.

**LLM suggests:**
```json
{ "tool": "calculator", "input": "142 * 365" }
```

**Backend executes and returns:**
```json
{
  "tool": "calculator",
  "input": "142 * 365",
  "result": "51830",
  "error": null
}
```

**Error case:**
```json
{
  "tool": "calculator",
  "input": "1 / 0",
  "result": null,
  "error": "Division by zero"
}
```

**Allowed operations:** `+`, `-`, `*`, `/`, `%`, `**`, parentheses. No `eval()`. Use a safe math parser.

---

### Tool: date

**Trigger:** Question asks about current date, time, or date arithmetic.

**LLM suggests:**
```json
{ "tool": "date", "input": "today" }
```

**Backend executes and returns:**
```json
{
  "tool": "date",
  "input": "today",
  "result": "2025-03-03",
  "error": null
}
```

**Supported inputs:** `"today"`, `"now"`, `"timestamp"`. Always return ISO-8601 format.

---

## 9. Logging Requirements

Every request must produce one structured log line (JSON):

```json
{
  "request_id": "uuid-v4",
  "session_id": "uuid-v4 or null",
  "endpoint": "POST /ask",
  "retrieval_count": 3,
  "top_relevance_score": 0.87,
  "tool_used": null,
  "llm_called": true,
  "latency_ms": 842,
  "status": 200,
  "timestamp": "ISO-8601"
}
```

Log to `./logs/app.log` (append mode, one JSON object per line).

---

## 10. What Must NOT Change Without a Version Bump

- Endpoint paths
- Request/response JSON field names and types
- Grounding requirement (answer must cite retrieved chunks)
- Session persistence model
- Chunking parameters (changing these invalidates stored embeddings)
- Embedding model (changing this requires full re-indexing)

---

## 11. Definition of Completion (Testable Criteria)

Phase is complete only when ALL of the following pass:

| # | Test | Pass Condition |
|---|------|----------------|
| 1 | Upload document | Returns 201 with `chunks_indexed >= 1` |
| 2 | List documents | Returns uploaded document in array |
| 3 | Ask grounded question | Answer contains information from the document |
| 4 | Ask off-topic question | Answer is exactly the fallback string |
| 5 | Ask with session, follow up | Second answer references first turn's context |
| 6 | Calculator tool | `142 * 365` returns `51830` |
| 7 | Date tool | Returns valid ISO-8601 date |
| 8 | Health check | Returns `status: ok` when Ollama is running |
| 9 | Invalid request | Returns correct error shape with `error` field |
| 10 | Log check | Each request produces a valid JSON log entry |

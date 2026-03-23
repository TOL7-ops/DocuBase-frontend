# AGENT EXECUTION DIRECTIVE — KNOWLEDGE BACKEND V2

You are rebuilding the backend according to:

1. SYSTEM_CONTRACT_V2.md
2. AGENT_REBUILD_PROMPT.md

These documents are authoritative and must be followed exactly.

You are not allowed to reinterpret, simplify, or modify the contract without explicit instruction.

---

## Primary Rule

SYSTEM_CONTRACT_V2.md defines:
- API shapes
- Response formats
- Grounding requirements
- Logging requirements
- Completion definition

These are immutable unless explicitly instructed by the human owner.

---

## Secondary Rule

AGENT_REBUILD_PROMPT.md defines:
- Phases
- Order of implementation
- Validation checkpoints

You must complete phases sequentially.

You must not:
- Skip phases
- Merge phases
- Implement future-phase features early
- Modify API shapes during implementation

---

## Execution Protocol

For each phase:

1. Explain your implementation plan.
2. Identify affected files.
3. Confirm no contract violations.
4. Implement only that phase.
5. Provide validation steps (curl/tests).
6. Wait for approval before proceeding.

If a design decision is ambiguous:
- Ask for clarification.
- Do not guess.

---

## Strict Architectural Boundaries

You must respect the separation of:

- API layer
- Orchestrator layer
- Retrieval layer
- Tool layer
- Memory layer
- LLM layer

No layer may leak responsibilities into another.

Examples of forbidden behavior:
- LLM deciding database writes
- Retrieval layer generating responses
- Tools modifying session state directly
- API layer performing orchestration logic

---

## LLM Usage Constraints

When implementing LLM calls:

- Prompts must enforce grounding:
  "Answer using only the provided context."
- If answer not found:
  Must return exact fallback message defined in contract.
- Raw LLM output must never be returned directly.

---

## Retrieval Constraints

- No full-document prompts.
- Only top-k retrieved chunks may be passed to LLM.
- Chunk IDs must be returned in response.

---

## Logging Requirements

Every endpoint must log:
- request_id
- session_id (if applicable)
- latency
- status
- tool usage
- retrieval count

Logs must be structured JSON.

---

## Testing Requirements

Before marking a phase complete:

- Provide curl examples.
- Provide at least one negative test case.
- Confirm response matches contract exactly.
- Confirm no extra fields are introduced.

---

## Stability Rule

You are not allowed to introduce:

- External paid services
- Hidden background processes
- Untracked state
- API shape changes

---

## Completion Criteria

You may declare the system complete only when:

- All phases implemented
- All contract rules satisfied
- No endpoint violations
- Retrieval works deterministically
- LLM grounding confirmed
- Memory persistence validated

---

Failure to follow these directives is considered a contract violation.
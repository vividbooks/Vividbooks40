# Design system + AI canvas — phase 0 (decisions)

Goal: keep the existing `DesignSystem` model and `design_systems` table; the Stitch-like experience is a layer on top (infinite canvas + chat + generation). **Mobile mockups are out of scope** — they were visual inspiration only.

## 1. Single source of truth

- **Supabase `design_systems`**: canonical JSONB fields (`colors`, `typography`, `page_defaults`, `ai_prompts`, `block_preferences`) plus `name`, `description`, `thumbnail_color`.
- **In-app canvas**: visualization and layout of the same state only. Canvas node positions are **not** persisted in phase 0–1 (optional later: `canvas_layout JSONB`).
- **Chat**: not in DB in phase 0; phase 1 may use session storage, later a `design_system_chat_threads` table.

Persistence after generation: existing **`saveDesignSystem`** — no parallel shadow format.

## 2. What the AI agent may change (design tokens)

The agent must **not** set: `id`, `teacher_id`, `created_at`, `updated_at`.

The agent may send a **patch** over the fields defined in `src/types/design-system-agent.ts` (`DesignSystemAgentPatch`): metadata, full `colors` array, partial `typography`, `pageDefaults`, `aiPrompts`, and `blockPreferences.preferred` (whitelist `BlockType`).

The agent must **not** invent arbitrary JSON keys — only the typed structure.

**Dataset** (`DesignSystem.dataset` in TS) and the book **Data set** panel (localStorage) stay separate until an explicit later decision.

## 3. Sample pages (no mobile frames)

**Intent:** After a prompt (e.g. kids book about X), the canvas shows **worksheet-style page previews** using the existing grid/worksheet preview stack, styled by `DesignSystem` tokens (colors, typography, page background, AI illustration style).

- **Not** separate mobile frame layouts.
- **Yes** one or more previews (same preview components as Pro editor where possible).

**Storage in phase 0:** no new DB columns. Next step (end of phase 1 / start of phase 2): choose either **A)** `sample_pages JSONB` on `design_systems`, or **B)** a reference to a template `teacher_worksheets` row. Until then, the UI can show a **single built-in template** preview driven by tokens.

## 4. Validation and safety

- Map model output JSON to `DesignSystemAgentPatch`, then `applyDesignSystemAgentPatch`.
- Validate hex colors, string lengths, and allowed `BlockType` values.
- **No base64 images in DB** — illustrations via Storage URLs when generation exists.

## 4b. Screenshot / vision (planned — after text MVP)

We **are counting on this** in the architecture; implementation comes **after** the text brief works end-to-end.

**Feasible:** multimodal Gemini: **page screenshot** + optional short note → same structured output as text (`DesignSystemAgentPatch`).

**Planned pipeline (unchanged from text path):**

1. User uploads screenshot → **Supabase Storage** (never base64 in DB).
2. Edge function receives **Storage public/signed URL** + context; model returns JSON patch only.
3. **`stripForbiddenKeysFromAgentPayload`** → validate → **`applyDesignSystemAgentPatch`** → **`saveDesignSystem`** → `setCanvasHasTokenCards(true)` (or equivalent).

**UI:** chat already reserves **„Nahrát screenshot stránky (připravujeme)“** — wire file input + upload here when ready.

**Risks:** noisy crops, small type, theme drift; always validate hex/fonts; optional human “apply” step if needed.

## 5. Stack alignment

- LLM: **Gemini via edge function** (project model rules).
- Canvas: custom pan/zoom (pattern similar to workbook `InfiniteCanvas`).

## 6. Phase 1 (in progress)

In the book (Laiout) UI, the new flow lives under **Design systém 2** (`viewMode === 'design2'`). The classic **Design systém** panel stays until the new flow is polished, then it can be removed.

1. ~~Canvas shell + floating chat~~ (done).
2. ~~**Text brief** → `ai-chat` (Gemini 3.1 Pro) → parse → `sanitizeDesignSystemAgentPatch` → `saveDesignSystem`~~ — see `src/utils/ai/design-system-from-brief.ts`.
3. ~~Token preview cards on canvas after successful save~~ (`canvasHasTokenCards`).
4. **Next:** polish (new row vs update UX, errors), then §7 step 2 (sample pages).

## 7. Roadmap (order we commit to)

| Step | Scope |
|------|--------|
| **1a** | Edge: text-only → validated `DesignSystemAgentPatch` |
| **1b** | Client: enable “Vygenerovat tokeny”, loading/error, persist + canvas cards |
| **2** | Sample **worksheet-style** previews on canvas (tokens applied; storage TBD §3) |
| **3** | **Vision:** upload screenshot → Storage → same edge contract as 1a (multimodal input only); reuse patch + save |

Vision is **step 3**, not a separate product — same types, same merge, same save.

---

Update this doc when scope changes.

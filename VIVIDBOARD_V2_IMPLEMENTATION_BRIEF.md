# VividBoard V2 Implementation Brief

Use this brief in the target project where Board Editor V2 / Board View V2 will be built.

## Goal

Build `BoardEditorPageV2` and `BoardViewPageV2` as a new UI shell that stays backward-compatible with the current VividBoard data model and storage contracts.

Do **not** port current orchestration pages 1:1.

Instead:

- keep the persisted `Quiz` / `QuizSlide` JSON contract
- keep `teacher_boards` persistence compatibility
- keep public board + comments compatibility
- keep live/share/classroom/competition compatibility through adapters
- normalize routing to `/content/...` while keeping legacy aliases during rollout

## Hard compatibility rules

### 1. Data model

Preserve compatibility with:

- `Quiz`
- `QuizSlide`
- `LiveQuizSession`
- `SlideResponse`

Do not introduce incompatible payload changes inside `slides`.

### 2. Board persistence

Preserve compatibility with `teacher_boards` usage:

- `id`
- `teacher_id`
- `title`
- `subject`
- `grade`
- `slides`
- `settings`
- `slides_count`
- `folder_id`
- `is_public`
- `created_at`
- `updated_at`

### 3. Public sharing

Preserve:

- public board visibility via `is_public`
- public board viewer
- public comments via `board_comments`

### 4. Sessions / realtime

Do not build V2 against a Firebase path contract.

The correct abstraction is a session adapter that provides:

- create live session
- create share session
- load session
- subscribe to session
- join/update participant
- list/add/delete board posts
- list/upsert votes
- classroom live notification support

## Important current-reality note

The old handoff document may mention realtime paths like:

- `quiz_sessions/{sessionId}`
- `quiz_shares/{shareId}`
- `session_codes/{code}`

Treat those as **legacy logical contracts**, not storage truth.

The current VividBoard runtime has already been migrated to a Supabase table-based session model.

Build V2 against adapters, not direct backend paths.

## Recommended target architecture

Create these modules:

```text
pages/
  editors/
    BoardEditorPageV2.tsx
  views/
    BoardViewPageV2.tsx
    PublicBoardViewPageV2.tsx
    BoardResultsPageV2.tsx

components/
  views/
    board-editor/
      BoardEditorShellV2.tsx
    board-view/
      BoardViewShellV2.tsx
      BoardPresentationShellV2.tsx

board/
  adapters/
    boardPersistenceAdapter.ts
    boardSessionAdapter.ts
    boardCommentsAdapter.ts
    boardPublicShareAdapter.ts
    boardClassroomAdapter.ts
    boardRoutingAdapter.ts
  registry/
    boardSlideRegistry.ts
  competition/
    boardCompetitionRuntime.ts
    CompetitionModeRouter.tsx
  routing/
    boardRoutes.ts
    boardRouteAliases.tsx
```

## What to extract from current VividBoard

### Source-of-truth files

Use current VividBoard equivalents of:

- `types/quiz.tsx`
- `slide-types.tsx`

These define the persisted board contract.

### Editor shell

The current editor page is orchestration-heavy.

The V2 editor shell should only contain:

- slide list
- active slide editor
- block editing
- settings panels
- local dirty state
- editor UI/UX

Move these concerns into adapters or page orchestration:

- save/load
- preview
- public share dialog
- comments
- live session launcher
- AI and outline panels
- results/session list

### View shell

The V2 view shell should only contain:

- board rendering
- slide navigation
- presentation runtime
- teacher/player shell UI

Move these concerns out of the shell:

- live/share/classroom session orchestration
- competition orchestration
- move/duplicate/folder actions
- routing decisions

## Required backend/schema in the target project

Ensure the target project contains compatible equivalents of:

- `teacher_boards`
- `teacher_folders`
- `teacher_tombstones` if delete-safe sync is preserved
- `board_comments`
- live session tables
- class live session notification fields on `classes`

At minimum, the target project needs schema equivalents for:

- teacher content tables
- public boards
- board comments
- live sessions
- class live session notifications

## Routing rule

Canonical routes in the target project should be under `/content/...`.

But keep legacy aliases during rollout.

No V2 component should directly hardcode route strings.

Use a routing adapter / helper layer instead.

## Build order

### Phase 1

- port types
- create slide registry
- build compatibility helpers for `Quiz` JSON

### Phase 2

- build persistence adapter
- build `BoardEditorShellV2`
- build `BoardEditorPageV2`

### Phase 3

- build `BoardViewShellV2`
- build `BoardViewPageV2`
- wire public share adapter

### Phase 4

- wire comments adapter
- wire live/share session adapter
- wire posts/voting

### Phase 5

- wire classroom live notification adapter
- wire results page
- wire competition runtime

### Phase 6

- normalize routes to `/content/...`
- keep `/quiz/...` aliases until rollout is complete

## Current repo readiness status

This repository is now prepared as a compatibility/runtime source for V2 insertion.

Already in place in this repo:

- V2 route helpers and compatibility exports
- adapter boundaries for persistence, comments, classroom and sessions
- `BoardV2Provider` / runtime dependency context
- transitional page shells:
  - `BoardEditorPageV2`
  - `BoardViewPageV2`
  - `BoardPresentationPageV2`
  - `BoardResultsPageV2`
  - join / student / public wrappers
- extracted editor entry/bootstrap/actions helpers
- extracted view entry/bootstrap/session/share helpers
- extracted results entry/data helpers wired through `BoardResultsPageV2` / `BoardResultsShellV2`
- extracted view right-panel subcomponents, including:
  - `BoardViewRightPanel`
  - `BoardViewDefaultPanel`
  - `BoardViewStudentOptionsPanel`
  - `BoardViewLiveSettingsPanel`
  - `BoardViewShareSettingsPanel`
  - `BoardViewCompetitionPickerPanel`
  - `BoardViewClassroomPanel`
  - `BoardViewLiveSessionPanel`
  - `BoardViewLiveEvaluateControls`
  - `BoardViewEndSessionDialog`

What still remains is lightweight final cleanup, not architecture migration:

- optional further shrinking of `QuizViewPage.tsx` / `QuizEditorLayout.tsx`
- target-project UI implementation over these compatibility boundaries
- target-project rollout verification against legacy aliases

## Acceptance checklist

Before considering V2 ready:

1. Existing board JSON opens without migration.
2. Existing boards save without data loss.
3. Existing boards render correctly in V2 view.
4. Public share still works.
5. Public comments still works.
6. Live session flow works.
7. Shared/classroom flow works.
8. Voting and board posts work.
9. Results still load correctly.
10. Competition modes work if in scope.
11. No broken mixed-route navigation remains.

## Final implementation rule

Build a **new shell** over **old contracts**.

That means:

- new editor/view UI: yes
- new routing shell: yes
- new adapter boundaries: yes
- new incompatible JSON/storage/session model: no

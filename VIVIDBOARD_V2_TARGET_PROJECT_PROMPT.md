# VividBoard V2 Target Project Prompt

Use the following prompt directly in the target project where Board Editor V2 / Board View V2 should be implemented.

---

Build Board Editor V2 and Board View V2 as a new UI shell that is fully backward-compatible with the existing board data model and persistence/runtime contracts.

## Primary goal

Create:

- `BoardEditorPageV2`
- `BoardViewPageV2`
- `PublicBoardViewPageV2`
- supporting adapter layers

Do **not** port old orchestration pages 1:1.

Instead:

- keep existing persisted board JSON compatible
- keep board storage compatible
- keep public share/comments compatible
- keep live/share/classroom/competition flows compatible via adapters
- normalize route usage to `/content/...` with legacy aliases during rollout

## Hard compatibility constraints

### 1. Data model compatibility

V2 must remain backward-compatible with:

- `Quiz`
- `QuizSlide`
- `LiveQuizSession`
- `SlideResponse`
- all existing slide payload shapes already stored inside `Quiz.slides`

Do not introduce incompatible changes to saved board JSON.

### 2. Persistence compatibility

V2 must remain compatible with the board persistence table and fields used at runtime:

- `teacher_boards`
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

### 3. Public share compatibility

V2 must preserve:

- public board visibility via `is_public`
- public board viewing
- public comments via `board_comments`

### 4. Session compatibility

V2 must preserve:

- live session start/update/end
- share/classroom session start/update/end
- board posts
- voting
- student participation tracking
- results loading
- competition modes if they are still in scope

Do not hardcode legacy backend path assumptions directly into UI components.

## Important implementation note

If older documentation references a path-based realtime model such as:

- `quiz_sessions/{sessionId}`
- `quiz_shares/{shareId}`
- `session_codes/{code}`
- `boardPosts`
- `votes`

treat that as a **logical legacy contract**, not necessarily the real storage implementation.

Board V2 must be built against an abstract session adapter, not direct backend path strings.

## Required architecture

Create a clean split between:

### Pages

- `BoardEditorPageV2`
- `BoardViewPageV2`
- `PublicBoardViewPageV2`
- `BoardResultsPageV2`

### Shell components

- `BoardEditorShellV2`
- `BoardViewShellV2`
- `BoardPresentationShellV2`

### Adapter layer

Create these adapters:

- `boardPersistenceAdapter.ts`
- `boardSessionAdapter.ts`
- `boardCommentsAdapter.ts`
- `boardPublicShareAdapter.ts`
- `boardClassroomAdapter.ts`
- `boardRoutingAdapter.ts`

### Registry / feature modules

- `boardSlideRegistry.ts`
- `boardCompetitionRuntime.ts`
- `CompetitionModeRouter.tsx`

## Editor shell scope

`BoardEditorShellV2` should focus only on:

- slide list
- active slide editing
- block editing
- settings panels
- editor toolbar
- dirty state
- editor UI/UX

Move these concerns out of the shell into page orchestration or adapters:

- persistence save/load wiring
- preview mode
- public share dialog
- comments loading/mutation
- live session launcher
- AI/outline side panels
- results/session history panels

## View shell scope

`BoardViewShellV2` should focus only on:

- board rendering
- slide navigation
- presentation/player shell UI
- teacher/player view state

Move these concerns out of the shell:

- live/share/classroom session orchestration
- competition orchestration
- folder/content actions
- routing decisions

## Routing rules

Canonical routes should be under `/content/...`.

Examples:

- `/content/board/:id`
- `/content/view/board/:id`
- `/content/present/board/:id`
- `/content/public/board/:id`
- `/content/results/board/:sessionId`
- `/content/join/board/:code`
- `/content/student/board/:shareId`

Keep legacy aliases temporarily during rollout.

No V2 component should hardcode route strings directly.

Use a routing adapter/helper layer instead.

## Persistence adapter requirements

Expose board persistence operations like:

- `loadBoard(id)`
- `loadBoardAsync(id)`
- `saveBoard(quiz)`
- `duplicateBoard(id)`
- `moveBoardToFolder(id, folderId)`
- `getPublicBoard(id)`
- `setBoardPublic(id, isPublic)`

The persistence adapter must preserve existing board JSON without data loss.

## Session adapter requirements

Expose operations like:

- `createLiveSession`
- `createShareSession`
- `loadLiveSession`
- `loadShareSession`
- `lookupSessionByCode`
- `subscribeLiveSession`
- `subscribeShareSession`
- `upsertParticipant`
- `updateParticipant`
- `listVotes`
- `vote`
- `listPosts`
- `addPost`
- `toggleLike`
- `deletePost`

Do not let UI components depend directly on backend table names or path names.

## Comments adapter requirements

Expose:

- `getBoardComments(boardId)`
- `getSlideComments(boardId, slideId)`
- `addComment(...)`
- `getUnreadCount(boardId)`
- `markAsRead(...)`
- `deleteComment(...)`

## Classroom adapter requirements

Expose:

- `notifyClassOfLiveSession`
- `endClassLiveSession`
- `getClasses`

## Database/backend checklist

Ensure the target project contains compatible schema and access for:

- `teacher_boards`
- `teacher_folders`
- `teacher_tombstones` if delete-safe sync is retained
- `board_comments`
- live session storage tables / entities
- class live-session notification fields

At minimum, public board access, comments, sessions, and classroom notifications must all be supported by the target project's backend.

## Build order

### Phase 1

- port the core board types
- build slide registry
- build JSON compatibility helpers

### Phase 2

- build board persistence adapter
- build `BoardEditorShellV2`
- build `BoardEditorPageV2`

### Phase 3

- build `BoardViewShellV2`
- build `BoardViewPageV2`
- build public board view

### Phase 4

- wire comments adapter
- wire public share adapter

### Phase 5

- wire session adapter
- wire board posts and voting
- wire results page

### Phase 6

- wire classroom notifications
- wire competition runtime

### Phase 7

- normalize all routing to `/content/...`
- keep legacy route aliases until migration is complete

## Acceptance criteria

Before considering V2 ready, verify:

1. Existing boards open in V2 without migration.
2. Existing boards save without data loss.
3. Existing boards render correctly in V2 view mode.
4. Public sharing still works.
5. Public comments still work.
6. Live session flow still works.
7. Shared/classroom flow still works.
8. Board posts and voting still work.
9. Results still load correctly.
10. Competition modes still work if in scope.
11. No broken mixed-route navigation remains.

## Final implementation rule

Build a **new shell** over **old contracts**.

That means:

- new editor/view UI: yes
- new page structure: yes
- new adapter boundaries: yes
- new incompatible JSON/storage/runtime model: no

---

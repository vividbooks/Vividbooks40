# VividBoard V2 Integration Plan

Date: 2026-03-17

This document translates the external "Board Editor V2 Integration Context" into the actual current VividBoard runtime in this repository.

It is intended as an implementation-ready handoff for the target project where Board Editor V2 / Board View V2 will be built and later plugged back into the broader platform.

## 1. Executive Summary

VividBoard should not be migrated by copying today's page components 1:1.

The correct migration strategy is:

1. Keep the current persisted board and session data contracts backward-compatible.
2. Extract adapter layers for persistence, routing, comments, public share, and realtime sessions.
3. Build new `BoardEditorV2` and `BoardViewV2` shells on top of those adapters.
4. Normalize routing in the target project to `/content/...`, while keeping legacy `/quiz/...` aliases during rollout.

The biggest architectural mismatch with the external handoff is realtime:

- The handoff assumes a path-based Firebase-like contract (`quiz_sessions`, `quiz_shares`, `session_codes`).
- The current VividBoard runtime in this repo has already been migrated to Supabase-only session storage via:
  - `live_sessions`
  - `live_session_content`
  - `live_session_participants`
  - `live_session_votes`
  - `live_session_posts`
  - `live_session_post_likes`

That means Board V2 must target an abstract session adapter, not path strings.

## 2. Current Runtime Mapping

The external handoff uses paths like `frontend/src/app/...`. In this repo, the real equivalents are:

### Orchestration Pages

- Editor page equivalent: `src/components/quiz/QuizEditorLayout.tsx`
- View page equivalent: `src/components/quiz/QuizViewPage.tsx`
- Public board page: `src/components/quiz/PublicBoardViewer.tsx`
- Results page: `src/components/quiz/QuizResultsPage.tsx`
- Student live join page: `src/components/quiz/QuizJoinPage.tsx`
- Student shared page: `src/components/quiz/QuizStudentView.tsx`

### Types / Contracts

- Source of truth: `src/types/quiz.ts`
- Slide type catalog/UI metadata: `src/components/quiz/slide-types.tsx`

### Persistence / Content

- Board storage: `src/utils/quiz-storage.ts`
- Teacher content APIs and related model: `src/utils/supabase/teacher-content.ts`
- Public board support: `src/utils/quiz-storage.ts`

### Realtime / Sessions

- Session adapter/source of truth: `src/utils/live-session-repository.ts`
- Board posts hook: `src/hooks/useBoardPosts.ts`
- Voting hook: `src/hooks/useVoting.ts`
- Session history: `src/utils/session-history.ts`
- Session list hook: `src/hooks/quiz/useSessionsData.ts`

### Comments / Sharing

- Public comments utility: `src/utils/supabase/board-comments.ts`
- Share dialog: `src/components/quiz/ShareEditDialog.tsx`

## 3. Non-Negotiable Compatibility Contracts

Board V2 must stay compatible with these current runtime contracts.

### 3.1 Data Model Contract

Must preserve compatibility with:

- `Quiz`
- `QuizSlide`
- `LiveQuizSession`
- `SlideResponse`
- all existing activity/tool payloads stored in `Quiz.slides`

This includes:

- info slides
- block-based layouts
- `board`
- `voting`
- `abc`
- `open`
- `form`
- `flashcard`
- `connect-pairs`
- `fill-blanks`
- `image-hotspots`
- `video-quiz`
- tools slides like certificates

### 3.2 Board Persistence Contract

Must preserve compatibility with `teacher_boards` runtime usage:

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

Notes:

- The external handoff mentions `category_id`; current VividBoard runtime does not depend on that in the core editor/view flow.
- Current save path writes `slides`, `settings`, `slides_count`, `folder_id`.

### 3.3 Public Share Contract

Must preserve:

- `setBoardPublic(id, isPublic)`
- public board fetch by `is_public`
- public comments via `board_comments`

### 3.4 Session Contract

Board V2 must preserve the behavior of:

- live session start/update/end
- share/classroom session start/update/end
- board posts
- voting
- student participation tracking
- results loading
- competition modes

However, it must do so via a session adapter, not by hardcoding Firebase path assumptions.

## 4. What In The External Handoff Is Already Outdated

The external handoff is useful, but these points no longer match the current VividBoard runtime:

### 4.1 Realtime contract description is outdated

The handoff assumes path-based realtime model as the runtime truth.

Current reality:

- board/session runtime is Supabase-only
- session storage is table-based
- session logic lives in `src/utils/live-session-repository.ts`

### 4.2 `board_comments` migration is not missing in this repo

Current repo already includes:

- `supabase/migrations/20260120_board_comments.sql`

So in the target project this schema is still required, but it is not "missing from source" anymore.

### 4.3 Canonical routing is not yet `/content/...`

Current runtime still uses `/quiz/...` as the effective canonical route family:

- `/quiz/edit/:id`
- `/quiz/view/:id`
- `/quiz/present/:id`
- `/quiz/join/:code`
- `/quiz/results/:sessionId`
- `/quiz/student/:shareId`
- `/quiz/public/:boardId`

So route normalization is future work, not a description of current reality.

## 5. Current Page Problems That V2 Should Fix

### 5.1 `QuizEditorLayout.tsx` is orchestration-heavy

Today it mixes:

- board loading
- board saving
- comments
- preview
- public share
- live session launcher
- AI panel
- outline panel
- results/session list
- worksheet export actions

This makes it a poor direct base for V2.

### 5.2 `QuizViewPage.tsx` is too broad

Today it mixes:

- teacher board view
- live sessions
- share sessions
- classroom mode
- competition modes
- folder/content actions
- routing actions

This should be split for V2 into a page shell plus feature adapters.

### 5.3 Routing debt is spread through many files

Hardcoded `/quiz/...` navigation exists across:

- `src/components/quiz/QuizEditorLayout.tsx`
- `src/components/quiz/QuizViewPage.tsx`
- `src/components/quiz/ShareEditDialog.tsx`
- `src/components/quiz/BoardCopyPage.tsx`
- `src/components/quiz/QuizResultsPage.tsx`
- `src/components/quiz/QuizLiveSession.tsx`

V2 should centralize routing helpers.

## 6. Target Architecture For The New Project

Below is the recommended target file tree and layering.

This is the file tree that should be created in the target project, even if the exact naming is adjusted slightly.

```text
frontend/
  src/
    app/
      pages/
        editors/
          BoardEditorPage.tsx
          BoardEditorPageV2.tsx
        views/
          BoardViewPage.tsx
          BoardViewPageV2.tsx
          PublicBoardViewPageV2.tsx
          BoardResultsPageV2.tsx
      components/
        views/
          board-editor/
            index.ts
            BoardEditorShellV2.tsx
            BoardEditorToolbar.tsx
            BoardSlideNavigator.tsx
            BoardEditorPanels.tsx
          board-view/
            index.ts
            BoardViewShellV2.tsx
            BoardPresentationShellV2.tsx
            BoardSessionPanel.tsx
            BoardClassroomPanel.tsx
        board/
          adapters/
            boardPersistenceAdapter.ts
            boardSessionAdapter.ts
            boardCommentsAdapter.ts
            boardPublicShareAdapter.ts
            boardClassroomAdapter.ts
            boardRoutingAdapter.ts
          routing/
            boardRoutes.ts
            boardRouteAliases.tsx
          registry/
            boardSlideRegistry.ts
          competition/
            boardCompetitionRuntime.ts
            CompetitionModeRouter.tsx
          shared/
            BoardErrorState.tsx
            BoardLoadingState.tsx
            BoardOwnershipGuard.tsx
      hooks/
        board/
          useBoardPersistence.ts
          useBoardSession.ts
          useBoardComments.ts
          useBoardRouting.ts
          useBoardPublicShare.ts
      utils/
        board/
          boardJsonCompat.ts
          boardMigrationGuards.ts
          boardCapabilityFlags.ts
      types/
        quiz.tsx
        slide-types.tsx
```

## 7. Exact Extraction Plan By Current File

### 7.1 `src/types/quiz.ts`

Use as source material for:

- `types/quiz.tsx`
- `utils/board/boardJsonCompat.ts`

Keep:

- slide union shape
- board/voting payloads
- block layout models
- session models

Do not:

- redesign payloads during UI migration
- rename persisted keys unless an adapter explicitly translates them

### 7.2 `src/components/quiz/slide-types.tsx`

Use as source for:

- `types/slide-types.tsx`
- `boardSlideRegistry.ts`

Keep:

- known slide/activity IDs
- type metadata used by UI creation flow

Do not:

- let V2 invent new IDs that break old persisted slides

### 7.3 `src/components/quiz/QuizEditorLayout.tsx`

Extract into:

- `BoardEditorPageV2.tsx`
- `BoardEditorShellV2.tsx`
- optional editor panel modules

Move out of the shell:

- comments fetch and mutation
- share dialog wiring
- live session launcher
- preview mode routing
- worksheet export hooks
- AI / Osnova integrations
- results tab/session list

Keep in shell:

- active slide editor
- block editing
- settings panels
- slide list / ordering
- dirty state and local editor actions

### 7.4 `src/components/quiz/QuizViewPage.tsx`

Extract into:

- `BoardViewPageV2.tsx`
- `BoardViewShellV2.tsx`
- `BoardSessionPanel.tsx`
- `BoardClassroomPanel.tsx`
- `CompetitionModeRouter.tsx`

Move out of the shell:

- session creation/loading/subscription logic
- share creation logic
- classroom class lookup and notification logic
- move/duplicate/folder actions
- competition orchestration

Keep in shell:

- render current slide
- teacher/player navigation
- lock/follow/results rendering state

### 7.5 `src/utils/quiz-storage.ts`

Wrap as:

- `boardPersistenceAdapter.ts`

Adapter API should expose:

- `loadBoard(id)`
- `loadBoardAsync(id)`
- `saveBoard(quiz)`
- `duplicateBoard(id)`
- `moveBoardToFolder(id, folderId)`
- `getPublicBoard(id)`
- `setBoardPublic(id, isPublic)`

Important: this adapter must preserve:

- `teacher_boards` save shape
- local cache behavior if retained
- tombstone-safe delete semantics if retained

### 7.6 `src/utils/live-session-repository.ts`

Wrap as:

- `boardSessionAdapter.ts`

This is the correct runtime integration layer for V2 sessions.

Expose:

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

Important:

- do not let V2 depend on table names directly
- do not port the external Firebase path model into UI code

### 7.7 `src/hooks/useBoardPosts.ts` and `src/hooks/useVoting.ts`

Wrap or re-export via:

- `useBoardSession.ts`
- `boardSessionAdapter.ts`

These are useful reference implementations for:

- realtime subscriptions
- optimistic state update boundaries
- session-scoped board/voting behavior

### 7.8 `src/utils/supabase/board-comments.ts`

Wrap as:

- `boardCommentsAdapter.ts`

Expose:

- `getBoardComments`
- `getSlideComments`
- `addComment`
- `getUnreadCount`
- `markAsRead`
- `deleteComment`

### 7.9 `src/utils/supabase/classes.ts`

Wrap class live notification pieces as:

- `boardClassroomAdapter.ts`

Use:

- `notifyClassOfLiveSession`
- `endClassLiveSession`
- `getClasses`

These already assume Supabase `classes` row metadata:

- `active_session_id`
- `active_session_path`
- `active_session_title`

### 7.10 `src/components/quiz/PublicBoardViewer.tsx`

Use as basis for:

- `PublicBoardViewPageV2.tsx`

Keep:

- readonly public rendering
- public board load
- public comments integration

### 7.11 `src/components/quiz/ShareEditDialog.tsx`

Split into:

- `boardPublicShareAdapter.ts`
- `BoardShareDialogV2.tsx`

Keep:

- public board URL generation
- `setBoardPublic`
- public link behavior

### 7.12 Competition files

- `src/components/quiz/CompetitionView.tsx`
- `src/components/quiz/TeamCompetitionView.tsx`
- `src/components/quiz/DuelCompetitionView.tsx`
- `src/components/quiz/TacticalCompetitionView.tsx`

Move into:

- `competition/boardCompetitionRuntime.ts`
- `competition/CompetitionModeRouter.tsx`

Do not keep this logic inside the generic board shell.

## 8. Required Database And Backend Checklist For The Target Project

The target project must contain compatible schema and APIs before Board V2 can be plugged in.

### 8.1 Required tables

- `teacher_boards`
- `teacher_folders`
- `teacher_tombstones` if delete-safe sync is preserved
- `board_comments`
- `live_sessions`
- `live_session_content`
- `live_session_participants`
- `live_session_votes`
- `live_session_posts`
- `live_session_post_likes`
- `classes` with:
  - `active_session_id`
  - `active_session_path`
  - `active_session_title`

### 8.2 Required policies / behavior

- public board read via `teacher_boards.is_public`
- public comment insert/select on `board_comments`
- realtime enabled on live session tables
- realtime enabled on `classes` if classroom live notifications are retained

### 8.3 Required migrations from this repo

At minimum, target project needs equivalents of:

- `supabase/migrations/20241227_teacher_content.sql`
- `supabase/migrations/20260116_public_boards.sql`
- `supabase/migrations/20260120_board_comments.sql`
- `supabase/migrations/20260316_live_sessions.sql`
- `supabase/migrations/20260316_class_live_session_notifications.sql`

## 9. Routing Normalization Plan

The target project should adopt canonical routes under `/content/...`, but keep legacy aliases while integrating.

### Canonical routes to introduce

- `/content/board/:id`
- `/content/view/board/:id`
- `/content/present/board/:id`
- `/content/public/board/:id`
- `/content/results/board/:sessionId`
- `/content/join/board/:code`
- `/content/student/board/:shareId`

### Legacy aliases to keep temporarily

- `/quiz/edit/:id`
- `/quiz/view/:id`
- `/quiz/present/:id`
- `/quiz/public/:boardId`
- `/quiz/results/:sessionId`
- `/quiz/join/:code`
- `/quiz/student/:shareId`

### Required implementation rule

No V2 component should call `navigate('/quiz/...')` or `navigate('/content/...')` directly.

All routing should go through:

- `boardRoutes.ts`
- `boardRoutingAdapter.ts`

## 10. Slide Registry Strategy

Board V2 should not directly scatter slide imports across pages.

Create:

- `boardSlideRegistry.ts`

The registry should map:

- slide type
- activity/tool subtype
- renderer
- editor
- capabilities

Suggested capabilities:

- `supportsRealtime`
- `supportsResults`
- `supportsTeacherEvaluation`
- `supportsCompetition`
- `supportsPublicComments`

This will make it possible to port current slide components incrementally.

## 11. Recommended Implementation Phases

### Phase 1: Board JSON compatibility

Deliverables:

- `types/quiz.tsx`
- `types/slide-types.tsx`
- `boardJsonCompat.ts`
- `boardSlideRegistry.ts`

Acceptance:

- existing board JSON loads in V2 shell without mutation

### Phase 2: Persistence-compatible editor shell

Deliverables:

- `BoardEditorPageV2.tsx`
- `BoardEditorShellV2.tsx`
- `boardPersistenceAdapter.ts`

Acceptance:

- load/save board from `teacher_boards`
- no data loss in `slides`
- existing board opens and re-saves unchanged

### Phase 3: View/player shell

Deliverables:

- `BoardViewPageV2.tsx`
- `BoardViewShellV2.tsx`
- `PublicBoardViewPageV2.tsx`
- `boardPublicShareAdapter.ts`

Acceptance:

- existing board renders correctly
- public share and public readonly view work

### Phase 4: Comments

Deliverables:

- `boardCommentsAdapter.ts`
- comments UI integration in editor/view/public page

Acceptance:

- add/read/delete/read-state comments works

### Phase 5: Sessions

Deliverables:

- `boardSessionAdapter.ts`
- `useBoardSession.ts`
- live/share wiring
- board posts / voting integration

Acceptance:

- teacher live session
- student join
- shared board runtime
- results load correctly

### Phase 6: Classroom + competitions

Deliverables:

- `boardClassroomAdapter.ts`
- `boardCompetitionRuntime.ts`
- `CompetitionModeRouter.tsx`

Acceptance:

- classroom launch notifications
- competition/team/duel/tactical flow works

### Phase 7: Route normalization

Deliverables:

- `boardRoutes.ts`
- `/content/...` canonical routes
- legacy alias redirects

Acceptance:

- no mixed-route dead ends

## 12. Plug-In Acceptance Checklist

Before V2 is merged back, verify all of these:

1. V2 reads and writes existing `Quiz` JSON without data loss.
2. Existing boards stored in `teacher_boards.slides` render correctly in V2.
3. Save, duplicate, delete, folder move, and public share still work.
4. `is_public` behavior still works.
5. Public comments flow still works.
6. Live session start/update/end works through the session adapter.
7. Shared/classroom session flows still work.
8. Board posts and voting still work.
9. Results page still works for live/share sessions.
10. Competition modes still work if they are in scope.
11. Routes are normalized and no hardcoded dead `/quiz/...` paths remain in V2 code.

## 13. Final Implementation Rule

Do not port current `QuizEditorLayout.tsx` and `QuizViewPage.tsx` as-is.

Instead:

- port the type contracts
- port the slide components
- wrap persistence/comments/session/classroom behavior behind adapters
- build fresh V2 shells on top of those adapters

That is the lowest-risk way to preserve compatibility while moving into the new architecture.

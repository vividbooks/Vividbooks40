# Předání: integrace obrazovky výsledků relací (Vividbooks40 → vividbooks-ultra)

Tento dokument je **výstupní specifikace** pro cílový projekt (`vividbooks-ultra`). V repozitáři **Vividbooks40** je doplněna **extrahovaná doménová vrstva** (typy + čisté agregace), aby šla zkopírovat bez vázání na konkrétní router nebo na celý `QuizResultsPage.tsx` (~2300 řádků).

Související dokument: [PORTING-MOJE-TRIDA.md](./PORTING-MOJE-TRIDA.md) (Moje třída / Supabase).

---

## 1. Co je hotové ve zdrojovém repu (Vividbooks40)

| Soubor | Účel |
|--------|------|
| `src/types/quiz-results-view-model.ts` | **Kanonické typy** pro UI: řádek žáka, agregace otázky, souhrn třídy, řazení aktivit. |
| `src/utils/quiz-results-aggregates.ts` | **Čisté funkce**: z `LiveQuizSession` + `Quiz` vyrobí `QuizResultsStudentRow[]`, `QuizResultsQuestionAggregate[]`, `QuizResultsOverallStats`, řazení podle nejsnazší/nejtěžší. |
| `src/utils/quiz-results-aggregates.test.ts` | Vitest – základní regresní testy agregace. |
| `src/components/quiz/QuizResultsPage.tsx` | Refaktorované: místo inline `useMemo` pro výpočty volá funkce z `quiz-results-aggregates.ts` (chování beze změny). |

**Zkopírovat do ultra (minimální sada pro stejnou logiku výsledků):**

- `src/types/quiz-results-view-model.ts`
- `src/utils/quiz-results-aggregates.ts`
- `src/utils/abc-evaluation.ts` (závislost – `getABCSelectedAnswerIds`)
- Typy kvízu: minimálně `Quiz`, `LiveQuizSession`, `SlideResponse`, `ABCActivitySlide` z `src/types/quiz.ts` – v ultra už máte obdobné; sladit názvy/importy.

**Volitelně (celé UI):** zkopírovat `QuizResultsPage.tsx` + hooky `useClassRecommendation`, `useFormativeAssessment`, `useClassSync`, `useDeleteDialog` + dialogy ve `src/components/quiz/results/` – počítej s úpravami cest (`@/app/...`), Supabase klienta a proxy pro AI.

---

## 2. Kontrakt vstupů (cílový projekt)

Shodně s vaší specifikací:

| Vstup | Zdroj |
|--------|--------|
| `sessionId` | `useParams()` |
| `mode` | `searchParams.get('type')` → normalizovat `share` → `shared`; výchozí `live` |
| `studentFilter` | `searchParams.get('studentFilter')` – po integraci předat do `buildQuizResultsStudentRows(..., { studentFilter, isStudentView })` |

**Loader musí produkovat `LiveQuizSession` + `Quiz | null`**, nebo strukturu, kterou umíte převést na tento tvar (viz §4).

---

## 3. Výstupní datový model (API agregací)

### 3.1 Typy (`quiz-results-view-model.ts`)

- **`QuizResultsStudentRow`** – `id`, `name`, `responses`, `correctCount`, `totalAnswered`, `successRate`, `totalTime`, volitelně `studentDbId`.
- **`QuizResultsQuestionAggregate`** – `slideId`, `question`, `activityType`, `options`, `answerCounts`, `correctAnswer`, `correctResponses`, `totalResponses`, `averageTime`.
- **`QuizResultsOverallStats`** – `totalQuestions`, `totalStudents`, `avgCorrect`, `avgSuccessRate`, `avgTime`, `distribution` (pásma 80 / 60–80 / 40–60 / 20–40 / &lt;20 %).
- **`QuizResultsActivitySort`** – `'default' | 'easiest' | 'hardest'`.

### 3.2 Funkce (`quiz-results-aggregates.ts`)

```text
buildQuizResultsStudentRows(session, quiz, { studentFilter?, isStudentView? })
buildQuizResultsQuestionAggregates(session, quiz)
buildQuizResultsOverallStats(questionAggregates, studentRows)
sortQuizResultsQuestionAggregates(questionAggregates, activitySort)
```

**Speciální chování (stejné jako původní UI):**

- **Písemka / přímé skóre:** pokud má záznam žáka `score`, `maxScore`, `percentage`, `totalTimeMs`, použije se místo čistého součtu z `responses`.
- **ABC:** více voleb přes `getABCSelectedAnswerIds`.
- **Paper test:** pokud `session.isPaperTest` nebo `quiz.isPaperTest`, odpověď jedním písmenem `A`–`Z` se mapuje na index volby.

---

## 4. Mapování z vividbooks-ultra na vstup agregací

### 4.1 Máte `getSessionDetails` → `SessionStudent[]` + metadata

Ultra typ **`SessionStudent`** často používá **mapu odpovědí `slideId → …`**. Agregace v tomto repu očekávají **`LiveQuizSession.students[id].responses: SlideResponse[]`** (pole).

**Postup:**

1. Pro každého žáka sestavte pole `SlideResponse[]` z mapy (nebo z API tak, jak už vracíte při přechodu na výsledky).
2. Vložte do objektu kompatibilního s `LiveQuizSession['students']`.
3. **`Quiz.slides`** musí obsahovat všechny aktivity (`type === 'activity'`) v pořadí pro přehled otázek – typicky ze snapshotu nástěnky / `live_session_content` / načteného kvízu podle `quizId`.

Pokud **nemáte celý `Quiz`**, ale jen skóre po řádcích, nelze vyplnit „Přehled aktivit“ – je potřeba dotáhnout definici slidů (stejně jako board výsledky).

### 4.2 Máte `LoadedResultsSnapshot` (`boardResultsData.ts`)

Pokud ultra sdílí stejný koncept jako Vividbooks40 (`subscribeToResultsSession` / `buildResultsSnapshotFromLive`), **nepřemapovávejte nic** – předejte `session` a `quiz` přímo do funkcí z §3.2.

### 4.3 `paper_test`

Zavolejte `loadPaperTestResultsSnapshot(sessionId)` (nebo ekvivalent v ultra), dokud nebudete mít `{ session, quiz }`. Pak stejné agregace. **Anon klíč** druhého projektu dejte do env, ne do commitnutého zdrojáku.

---

## 5. Kam UI zapojit v ultra (dle vaší specifikace)

| Místo | Akce |
|--------|------|
| `frontend/src/app/pages/legacy/QuizResultsPage.tsx` | Nahradit tabulku **nebo** obalit: nahoře loader (§4), dole komponenta, která bere agregovaná data + volitelně raw `session`/`quiz` pro AI hooky. |
| `ClassResultsGrid` | Ověřit `navigate(\`/quiz/results/${session_id}?type=...\`)` a **`studentFilter`** – agregace je na to připravená. |
| `BoardResultsShell` | Sjednotit jeden container přijímající props z `BoardProvider` + fallback z URL. |

**Doporučené rozhraní prezentační komponenty (v ultra):**

```ts
interface SessionResultsDetailProps {
  quizTitle: string;
  sessionSubtitle?: string; // datum / podtitul
  studentRows: QuizResultsStudentRow[];
  questionAggregates: QuizResultsQuestionAggregate[];
  overallStats: QuizResultsOverallStats;
  // volitelně: flags pro AI, mazání, paper_test, …
}
```

Logika řazení (`activitySort`) zůstává v React state; použijte `sortQuizResultsQuestionAggregates`.

---

## 6. Závislosti mimo agregace (původní stránka)

Pokud kopírujete celý `QuizResultsPage`:

- **AI doporučení:** `useClassRecommendation` → `chatWithAIProxy` (v ultra připojit vlastní proxy / edge).
- **Formátivní hodnocení:** `useFormativeAssessment` → `utils/supabase/classes` (ultra: vlastní API).
- **Sync do třídy / první nastavení:** `useClassSync` + `FirstTimeSetupDialog` (napojení na Moje třída – viz PORTING-MOJE-TRIDA).
- **Realtime** hlasů a nástěnky: Supabase kanály v původní stránce – volitelné, pokud loader nepoužívá plný snapshot.

---

## 7. Kontrolní seznam před merge (rozšíření §10 vaší specifikace)

- [ ] Zkopírovány `quiz-results-view-model.ts` + `quiz-results-aggregates.ts` + testy; `npm test` zelené.
- [ ] `type` v URL vede na správný loader (`live` vs `shared` vs `paper_test`).
- [ ] `studentFilter` omezuje / zvýrazňuje žáka konzistentně s mřížkou.
- [ ] Pro papír: `sessionId` === ID assignment v papírovém Supabase (jedna pravda).
- [ ] Žádné nové tajné klíče v repu – env pro papírový projekt.
- [ ] `TeacherShell` / `main` layout: `min-w-0`, overflow u širokého přehledu.
- [ ] (Strategicky) Board ukončení → `assignments`/`results` – stále oddělený problém; tento dokument ho neřeší, ale výsledková stránka musí umět číst data z relace i bez řádku v `results`.

---

## 8. Historie změn ve zdrojovém repu

- **2026-03-28:** Introdukovány `quiz-results-view-model.ts` a `quiz-results-aggregates.ts`; `QuizResultsPage` přepnut na sdílené výpočty; přidány unit testy.

---

*Tento soubor je určen k přenesení do dokumentace cílového projektu (např. `docs/` v vividbooks-ultra). Při rozchodu cest ve stromu souborů upravte jen prefixy (`src/` vs `frontend/src/app/`).*

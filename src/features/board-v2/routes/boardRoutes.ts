export type RouteQueryValue = string | number | boolean | null | undefined;

export type RouteQuery = Record<string, RouteQueryValue>;

function buildQuery(query?: RouteQuery): string {
  if (!query) return '';

  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params.set(key, String(value));
  });

  const result = params.toString();
  return result ? `?${result}` : '';
}

function withQuery(path: string, query?: RouteQuery): string {
  return `${path}${buildQuery(query)}`;
}

export const boardRoutes = {
  edit: (boardId: string, query?: RouteQuery) => withQuery(`/quiz/edit/${boardId}`, query),
  view: (boardId: string, query?: RouteQuery) => withQuery(`/quiz/view/${boardId}`, query),
  present: (boardId: string, query?: RouteQuery) => withQuery(`/quiz/present/${boardId}`, query),
  results: (sessionId: string, query?: RouteQuery) => withQuery(`/quiz/results/${sessionId}`, query),
  join: (code?: string, query?: RouteQuery) =>
    withQuery(code ? `/quiz/join/${code}` : '/quiz/join', query),
  shortJoin: (code: string, query?: RouteQuery) => withQuery(`/go/${code}`, query),
  student: (shareId: string, query?: RouteQuery) => withQuery(`/quiz/student/${shareId}`, query),
  public: (boardId: string, query?: RouteQuery) => withQuery(`/quiz/public/${boardId}`, query),
  copy: (boardId: string, query?: RouteQuery) => withQuery(`/quiz/copy/${boardId}`, query),
  practice: (boardId: string, query?: RouteQuery) => withQuery(`/quiz/practice/${boardId}`, query),

  contentEdit: (boardId: string, query?: RouteQuery) => withQuery(`/content/edit/board/${boardId}`, query),
  contentView: (boardId: string, query?: RouteQuery) => withQuery(`/content/view/board/${boardId}`, query),
  contentBoard: (boardId: string, query?: RouteQuery) => withQuery(`/content/board/${boardId}`, query),
  contentPresent: (boardId: string, query?: RouteQuery) => withQuery(`/content/present/board/${boardId}`, query),
  contentResults: (sessionId: string, query?: RouteQuery) => withQuery(`/content/results/board/${sessionId}`, query),
  contentJoin: (code?: string, query?: RouteQuery) =>
    withQuery(code ? `/content/join/board/${code}` : '/content/join/board', query),
  contentStudent: (shareId: string, query?: RouteQuery) => withQuery(`/content/student/board/${shareId}`, query),
  contentPublic: (boardId: string, query?: RouteQuery) => withQuery(`/content/public/board/${boardId}`, query),
};

export type BoardRoutes = typeof boardRoutes;

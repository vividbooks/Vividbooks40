import { supabase } from './supabase/client';
import { stripBase64FromObject } from './supabase/upload-image';
import type { BoardPost, LiveQuizSession, Quiz, SlideResponse } from '../types/quiz';
import type { StudentData } from './student-session';

export type SessionBackend = 'supabase';
export type SessionKind = 'live' | 'share';

export interface ShareSessionSettings {
  anonymousAccess: boolean;
  showSolutionHints: boolean;
  showActivityResults: boolean;
  requireAnswerToProgress: boolean;
  showNotes: boolean;
}

export interface ShareSessionRecord {
  id: string;
  quizId: string;
  quizData: Quiz;
  sessionName: string;
  shareCode: string;
  mode?: string;
  startedAt?: string;
  settings: ShareSessionSettings;
  createdAt: string;
  createdBy: string;
  classId?: string | null;
  responses: Record<string, ShareStudentRecord>;
}

export interface ShareStudentRecord {
  studentId: string;
  studentName: string;
  schoolName?: string;
  joinedAt: string;
  lastActiveAt: string;
  currentSlide: number;
  isOnline: boolean;
  isFocused?: boolean;
  completedAt?: string;
  responses: Record<string, SlideResponse>;
  deviceId: string;
  startTime?: string;
  totalTimeMs?: number;
  clientIdentityId?: string;
}

export interface SessionLocator {
  backend: SessionBackend;
  kind: SessionKind;
  publicId: string;
}

type SupabaseLiveSessionRow = {
  id: string;
  public_id: string;
  kind: SessionKind;
  join_code: string | null;
  share_slug: string | null;
  source_board_id: string | null;
  title: string;
  teacher_user_id: string | null;
  teacher_name: string;
  status: 'active' | 'paused' | 'ended';
  current_slide_index: number;
  mode: LiveQuizSession['mode'] | null;
  competition_phase: LiveQuizSession['competitionPhase'] | null;
  is_locked: boolean;
  is_paused: boolean;
  show_results: boolean;
  competition_data: LiveQuizSession['competitionData'] | null;
  team_competition_data: LiveQuizSession['teamCompetitionData'] | null;
  duel_competition_data: LiveQuizSession['duelCompetitionData'] | null;
  tactical_competition_data: LiveQuizSession['tacticalCompetitionData'] | null;
  settings: Record<string, any> | null;
  created_at: string;
  ended_at: string | null;
};

type SupabaseLiveContentRow = {
  session_public_id: string;
  quiz_id: string | null;
  board_snapshot: Quiz | null;
};

type SupabaseParticipantRow = {
  session_public_id: string;
  client_identity_id: string;
  display_name: string;
  school_name: string | null;
  device_id: string | null;
  current_slide_index: number;
  responses: SlideResponse[] | Record<string, SlideResponse> | null;
  is_online: boolean;
  is_focused: boolean | null;
  joined_at: string;
  last_seen_at: string | null;
  completed_at: string | null;
  total_time_ms: number | null;
};

type SupabaseVoteRow = {
  slide_id: string;
  client_identity_id: string;
  selected_options: string[];
  voted_at: string;
  voter_name: string | null;
};

type SupabasePostRow = {
  id: string;
  slide_id: string;
  client_identity_id: string;
  author_role: 'teacher' | 'student';
  author_name: string;
  text: string;
  media_url: string | null;
  media_type: 'image' | 'youtube' | null;
  background_color: string | null;
  column_side: 'left' | 'right' | null;
  created_at: string;
  deleted_at: string | null;
};

type SupabaseLikeRow = {
  post_id: string;
  client_identity_id: string;
};

function preferredBackend(): SessionBackend {
  return 'supabase';
}

function orderedBackends(): SessionBackend[] {
  return [preferredBackend()];
}

function normalizeQuiz(snapshot: Quiz | { quizData?: Quiz } | null | undefined): Quiz | null {
  if (!snapshot) return null;
  if ('slides' in snapshot) return snapshot as Quiz;
  if ('quizData' in snapshot && snapshot.quizData) return snapshot.quizData;
  return null;
}

function normalizeLiveResponses(value: SlideResponse[] | Record<string, SlideResponse> | null | undefined): SlideResponse[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return Object.values(value);
}

function normalizeShareResponses(value: SlideResponse[] | Record<string, SlideResponse> | null | undefined): Record<string, SlideResponse> {
  if (!value) return {};
  if (Array.isArray(value)) {
    return value.reduce<Record<string, SlideResponse>>((acc, response) => {
      if (response?.slideId) acc[response.slideId] = response;
      return acc;
    }, {});
  }
  return value;
}

function mapSupabaseParticipantsToLiveStudents(rows: SupabaseParticipantRow[] | null | undefined): LiveQuizSession['students'] {
  if (!rows?.length) return {};
  return rows.reduce<NonNullable<LiveQuizSession['students']>>((acc, row) => {
    acc[row.client_identity_id] = {
      name: row.display_name,
      joinedAt: row.joined_at,
      currentSlide: row.current_slide_index ?? 0,
      responses: normalizeLiveResponses(row.responses),
      isOnline: row.is_online ?? false,
      isFocused: row.is_focused ?? true,
      lastSeen: row.last_seen_at || undefined,
      deviceId: row.device_id || undefined,
    };
    return acc;
  }, {});
}

function mapSupabaseParticipantsToShareResponses(rows: SupabaseParticipantRow[] | null | undefined): Record<string, ShareStudentRecord> {
  if (!rows?.length) return {};
  return rows.reduce<Record<string, ShareStudentRecord>>((acc, row) => {
    acc[row.client_identity_id] = {
      studentId: row.client_identity_id,
      studentName: row.display_name,
      schoolName: row.school_name || '',
      joinedAt: row.joined_at,
      lastActiveAt: row.last_seen_at || row.joined_at,
      currentSlide: row.current_slide_index ?? 0,
      isOnline: row.is_online ?? false,
      isFocused: row.is_focused ?? true,
      completedAt: row.completed_at || undefined,
      responses: normalizeShareResponses(row.responses),
      deviceId: row.device_id || '',
      startTime: row.joined_at,
      totalTimeMs: row.total_time_ms ?? 0,
      clientIdentityId: row.client_identity_id,
    };
    return acc;
  }, {});
}

function mapSupabaseLiveSession(
  sessionRow: SupabaseLiveSessionRow,
  contentRow: SupabaseLiveContentRow | null,
  participants: SupabaseParticipantRow[]
): LiveQuizSession {
  const quizData = normalizeQuiz(contentRow?.board_snapshot);
  return {
    id: sessionRow.public_id,
    quizId: sessionRow.source_board_id || contentRow?.quiz_id || '',
    code: sessionRow.join_code || undefined,
    teacherId: sessionRow.teacher_user_id || 'anonymous',
    teacherName: sessionRow.teacher_name,
    isActive: sessionRow.status !== 'ended',
    currentSlideIndex: sessionRow.current_slide_index ?? 0,
    mode: sessionRow.mode || 'live',
    isPaused: sessionRow.is_paused ?? false,
    showResults: sessionRow.show_results ?? false,
    isLocked: sessionRow.is_locked ?? true,
    competitionPhase: sessionRow.competition_phase || undefined,
    competitionData: sessionRow.competition_data || undefined,
    teamCompetitionData: sessionRow.team_competition_data || undefined,
    duelCompetitionData: sessionRow.duel_competition_data || undefined,
    tacticalCompetitionData: sessionRow.tactical_competition_data || undefined,
    quizData: quizData ? {
      id: quizData.id,
      title: quizData.title,
      slides: quizData.slides,
    } : undefined,
    students: mapSupabaseParticipantsToLiveStudents(participants),
    createdAt: sessionRow.created_at,
    endedAt: sessionRow.ended_at || undefined,
    settings: (sessionRow.settings || {}) as LiveQuizSession['settings'],
  };
}

function mapSupabaseShareSession(
  sessionRow: SupabaseLiveSessionRow,
  contentRow: SupabaseLiveContentRow | null,
  participants: SupabaseParticipantRow[]
): ShareSessionRecord {
  const quizData = normalizeQuiz(contentRow?.board_snapshot) || ({
    id: contentRow?.quiz_id || sessionRow.source_board_id || sessionRow.public_id,
    title: sessionRow.title,
    slides: [],
  } as Quiz);

  const settings = (sessionRow.settings || {}) as Record<string, any>;
  return {
    id: sessionRow.public_id,
    quizId: sessionRow.source_board_id || contentRow?.quiz_id || '',
    quizData,
    sessionName: sessionRow.title,
    shareCode: sessionRow.join_code || sessionRow.share_slug || sessionRow.public_id,
    mode: settings.mode,
    startedAt: settings.startedAt,
    settings: {
      anonymousAccess: settings.anonymousAccess ?? false,
      showSolutionHints: settings.showSolutionHints ?? false,
      showActivityResults: settings.showActivityResults ?? true,
      requireAnswerToProgress: settings.requireAnswerToProgress ?? false,
      showNotes: settings.showNotes ?? false,
    },
    createdAt: sessionRow.created_at,
    createdBy: sessionRow.teacher_user_id || 'anonymous',
    classId: settings.classId ?? null,
    responses: mapSupabaseParticipantsToShareResponses(participants),
  };
}

async function fetchSupabaseSessionRows(publicId: string, kind: SessionKind) {
  const [{ data: sessionRow, error: sessionError }, { data: contentRow, error: contentError }, { data: participants, error: participantsError }] = await Promise.all([
    supabase.from('live_sessions').select('*').eq('public_id', publicId).eq('kind', kind).maybeSingle<SupabaseLiveSessionRow>(),
    supabase.from('live_session_content').select('session_public_id, quiz_id, board_snapshot').eq('session_public_id', publicId).maybeSingle<SupabaseLiveContentRow>(),
    supabase.from('live_session_participants').select('session_public_id, client_identity_id, display_name, school_name, device_id, current_slide_index, responses, is_online, is_focused, joined_at, last_seen_at, completed_at, total_time_ms').eq('session_public_id', publicId).returns<SupabaseParticipantRow[]>(),
  ]);

  if (sessionError && sessionError.code !== 'PGRST116') throw sessionError;
  if (contentError && contentError.code !== 'PGRST116') throw contentError;
  if (participantsError) throw participantsError;

  return {
    sessionRow: sessionRow ?? null,
    contentRow: contentRow ?? null,
    participants: participants ?? [],
  };
}

async function getSupabaseLiveSession(publicId: string): Promise<LiveQuizSession | null> {
  const { sessionRow, contentRow, participants } = await fetchSupabaseSessionRows(publicId, 'live');
  if (!sessionRow) return null;
  return mapSupabaseLiveSession(sessionRow, contentRow, participants);
}

async function getSupabaseShareSession(publicId: string): Promise<ShareSessionRecord | null> {
  const { sessionRow, contentRow, participants } = await fetchSupabaseSessionRows(publicId, 'share');
  if (!sessionRow) return null;
  return mapSupabaseShareSession(sessionRow, contentRow, participants);
}

export function getPreferredSessionBackend(): SessionBackend {
  return preferredBackend();
}

export async function createLiveSessionRecord(params: {
  quiz: Quiz;
  session: LiveQuizSession;
}): Promise<{ backend: SessionBackend; sessionId: string; session: LiveQuizSession }> {
  const cleanedQuiz = stripBase64FromObject(params.quiz) as Quiz;
  const { error: sessionError } = await supabase.from('live_sessions').insert({
    public_id: params.session.id,
    kind: 'live',
    join_code: params.session.code || null,
    source_board_id: params.quiz.id,
    title: params.quiz.title || 'Bez názvu',
    teacher_user_id: params.session.teacherId,
    teacher_name: params.session.teacherName,
    status: 'active',
    current_slide_index: params.session.currentSlideIndex ?? 0,
    mode: params.session.mode || 'live',
    competition_phase: params.session.competitionPhase || null,
    is_locked: params.session.isLocked ?? true,
    is_paused: params.session.isPaused ?? false,
    show_results: params.session.showResults ?? false,
    competition_data: params.session.competitionData || {},
    team_competition_data: params.session.teamCompetitionData || {},
    duel_competition_data: params.session.duelCompetitionData || {},
    tactical_competition_data: params.session.tacticalCompetitionData || {},
    settings: params.session.settings || {},
    created_at: params.session.createdAt,
  });

  if (sessionError) throw sessionError;

  const { error: contentError } = await supabase.from('live_session_content').upsert({
    session_public_id: params.session.id,
    quiz_id: params.quiz.id,
    board_snapshot: cleanedQuiz,
  }, { onConflict: 'session_public_id' });

  if (contentError) throw contentError;

  return { backend: 'supabase', sessionId: params.session.id, session: params.session };
}

export async function createShareSessionRecord(params: {
  share: ShareSessionRecord;
}): Promise<{ backend: SessionBackend; shareId: string; share: ShareSessionRecord }> {
  const cleanedQuiz = stripBase64FromObject(params.share.quizData) as Quiz;
  const settings = {
    ...params.share.settings,
    mode: params.share.mode,
    startedAt: params.share.startedAt,
    classId: params.share.classId ?? null,
  };

  const { error: sessionError } = await supabase.from('live_sessions').insert({
    public_id: params.share.id,
    kind: 'share',
    join_code: params.share.shareCode || null,
    share_slug: params.share.id,
    source_board_id: params.share.quizId,
    title: params.share.sessionName || params.share.quizData.title || 'Sdílený board',
    teacher_user_id: params.share.createdBy,
    teacher_name: 'Sdílení',
    status: 'active',
    current_slide_index: 0,
    is_locked: false,
    is_paused: false,
    show_results: false,
    settings,
    created_at: params.share.createdAt,
  });
  if (sessionError) throw sessionError;

  const { error: contentError } = await supabase.from('live_session_content').upsert({
    session_public_id: params.share.id,
    quiz_id: params.share.quizId,
    board_snapshot: cleanedQuiz,
  }, { onConflict: 'session_public_id' });
  if (contentError) throw contentError;

  return { backend: 'supabase', shareId: params.share.id, share: params.share };
}

export async function loadLiveSession(publicId: string): Promise<{ backend: SessionBackend; session: LiveQuizSession } | null> {
  for (const backend of orderedBackends()) {
    const session = await getSupabaseLiveSession(publicId);
    if (session) return { backend: 'supabase', session };
  }
  return null;
}

export async function loadShareSession(publicId: string): Promise<{ backend: SessionBackend; share: ShareSessionRecord } | null> {
  for (const backend of orderedBackends()) {
    const share = await getSupabaseShareSession(publicId);
    if (share) return { backend: 'supabase', share };
  }
  return null;
}

export async function lookupLiveSessionByCode(code: string): Promise<{ backend: SessionBackend; sessionId: string; session: LiveQuizSession } | null> {
  const upperCode = code.toUpperCase();
  for (const backend of orderedBackends()) {
    const { data, error } = await supabase
      .from('live_sessions')
      .select('*')
      .eq('kind', 'live')
      .eq('join_code', upperCode)
      .maybeSingle<SupabaseLiveSessionRow>();
    if (error && error.code !== 'PGRST116') throw error;
    if (data) {
      const session = await getSupabaseLiveSession(data.public_id);
      if (session) return { backend: 'supabase', sessionId: data.public_id, session };
    }
  }

  return null;
}

export async function updateLiveSessionRecord(backend: SessionBackend, sessionId: string, updates: Partial<LiveQuizSession>): Promise<void> {
  const mapped: Record<string, any> = {};
  if (updates.currentSlideIndex !== undefined) mapped.current_slide_index = updates.currentSlideIndex;
  if (updates.mode !== undefined) mapped.mode = updates.mode;
  if (updates.competitionPhase !== undefined) mapped.competition_phase = updates.competitionPhase;
  if (updates.isPaused !== undefined) mapped.is_paused = updates.isPaused;
  if (updates.isLocked !== undefined) mapped.is_locked = updates.isLocked;
  if (updates.showResults !== undefined) mapped.show_results = updates.showResults;
  if (updates.endedAt !== undefined) mapped.ended_at = updates.endedAt;
  if (updates.isActive !== undefined) mapped.status = updates.isActive ? (updates.isPaused ? 'paused' : 'active') : 'ended';
  if (updates.competitionData !== undefined) mapped.competition_data = updates.competitionData;
  if (updates.teamCompetitionData !== undefined) mapped.team_competition_data = updates.teamCompetitionData;
  if (updates.duelCompetitionData !== undefined) mapped.duel_competition_data = updates.duelCompetitionData;
  if (updates.tacticalCompetitionData !== undefined) mapped.tactical_competition_data = updates.tacticalCompetitionData;
  if (updates.settings !== undefined) mapped.settings = updates.settings;

  if (Object.keys(mapped).length === 0) return;
  const { error } = await supabase.from('live_sessions').update(mapped).eq('public_id', sessionId).eq('kind', 'live');
  if (error) throw error;
}

export async function updateShareSessionRecord(backend: SessionBackend, shareId: string, updates: Record<string, any>): Promise<void> {
  const sessionUpdates: Record<string, any> = {};
  if (updates.startedAt !== undefined) {
    const current = await getSupabaseShareSession(shareId);
    sessionUpdates.settings = {
      ...(current?.settings || {}),
      mode: current?.mode,
      classId: current?.classId ?? null,
      startedAt: updates.startedAt,
    };
  }

  if (Object.keys(sessionUpdates).length === 0) return;
  const { error } = await supabase.from('live_sessions').update(sessionUpdates).eq('public_id', shareId).eq('kind', 'share');
  if (error) throw error;
}

export async function upsertLiveStudentRecord(backend: SessionBackend, sessionId: string, studentId: string, student: StudentData & { clientIdentityId?: string }): Promise<void> {
  const { error } = await supabase.from('live_session_participants').upsert({
    session_public_id: sessionId,
    client_identity_id: studentId,
    display_name: student.name,
    school_name: student.schoolName || null,
    device_id: student.deviceId || null,
    current_slide_index: student.currentSlide ?? 0,
    responses: student.responses || [],
    is_online: student.isOnline ?? true,
    is_focused: student.isFocused ?? true,
    joined_at: student.joinedAt,
    last_seen_at: student.lastSeen || student.joinedAt,
    total_time_ms: student.totalTimeMs ?? 0,
  }, { onConflict: 'session_public_id,client_identity_id' });

  if (error) throw error;
}

export async function updateLiveStudentRecord(backend: SessionBackend, sessionId: string, studentId: string, updates: Partial<StudentData & { clientIdentityId?: string }>): Promise<void> {
  const mapped: Record<string, any> = {};
  if (updates.name !== undefined) mapped.display_name = updates.name;
  if (updates.schoolName !== undefined) mapped.school_name = updates.schoolName || null;
  if (updates.currentSlide !== undefined) mapped.current_slide_index = updates.currentSlide;
  if (updates.responses !== undefined) mapped.responses = updates.responses;
  if (updates.isOnline !== undefined) mapped.is_online = updates.isOnline;
  if (updates.isFocused !== undefined) mapped.is_focused = updates.isFocused;
  if (updates.lastSeen !== undefined) mapped.last_seen_at = updates.lastSeen;
  if (updates.deviceId !== undefined) mapped.device_id = updates.deviceId;
  if (updates.totalTimeMs !== undefined) mapped.total_time_ms = updates.totalTimeMs;
  if ((updates as any).completedAt !== undefined) mapped.completed_at = (updates as any).completedAt;

  if (Object.keys(mapped).length === 0) return;
  const { error } = await supabase
    .from('live_session_participants')
    .update(mapped)
    .eq('session_public_id', sessionId)
    .eq('client_identity_id', studentId);
  if (error) throw error;
}

export async function upsertShareStudentRecord(backend: SessionBackend, shareId: string, studentId: string, student: ShareStudentRecord): Promise<void> {
  const { error } = await supabase.from('live_session_participants').upsert({
    session_public_id: shareId,
    client_identity_id: studentId,
    display_name: student.studentName,
    school_name: student.schoolName || null,
    device_id: student.deviceId || null,
    current_slide_index: student.currentSlide ?? 0,
    responses: student.responses || {},
    is_online: student.isOnline ?? true,
    is_focused: student.isFocused ?? true,
    joined_at: student.joinedAt,
    last_seen_at: student.lastActiveAt || student.joinedAt,
    completed_at: student.completedAt || null,
    total_time_ms: student.totalTimeMs ?? 0,
  }, { onConflict: 'session_public_id,client_identity_id' });
  if (error) throw error;
}

export async function updateShareStudentRecord(backend: SessionBackend, shareId: string, studentId: string, updates: Partial<ShareStudentRecord>): Promise<void> {
  const mapped: Record<string, any> = {};
  if (updates.studentName !== undefined) mapped.display_name = updates.studentName;
  if (updates.schoolName !== undefined) mapped.school_name = updates.schoolName || null;
  if (updates.currentSlide !== undefined) mapped.current_slide_index = updates.currentSlide;
  if (updates.responses !== undefined) mapped.responses = updates.responses;
  if (updates.isOnline !== undefined) mapped.is_online = updates.isOnline;
  if (updates.isFocused !== undefined) mapped.is_focused = updates.isFocused;
  if (updates.lastActiveAt !== undefined) mapped.last_seen_at = updates.lastActiveAt;
  if (updates.deviceId !== undefined) mapped.device_id = updates.deviceId;
  if (updates.completedAt !== undefined) mapped.completed_at = updates.completedAt;
  if (updates.totalTimeMs !== undefined) mapped.total_time_ms = updates.totalTimeMs;

  if (Object.keys(mapped).length === 0) return;
  const { error } = await supabase
    .from('live_session_participants')
    .update(mapped)
    .eq('session_public_id', shareId)
    .eq('client_identity_id', studentId);
  if (error) throw error;
}

export async function loadShareParticipants(shareId: string, backend: SessionBackend): Promise<Record<string, ShareStudentRecord>> {
  const { data, error } = await supabase
    .from('live_session_participants')
    .select('session_public_id, client_identity_id, display_name, school_name, device_id, current_slide_index, responses, is_online, is_focused, joined_at, last_seen_at, completed_at, total_time_ms')
    .eq('session_public_id', shareId)
    .returns<SupabaseParticipantRow[]>();
  if (error) throw error;
  return mapSupabaseParticipantsToShareResponses(data || []);
}

export function subscribeLiveSession(
  backend: SessionBackend,
  sessionId: string,
  onData: (session: LiveQuizSession) => void,
  onError?: (error: unknown) => void
): () => void {
  const channel = supabase
    .channel(`live-session:${sessionId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_sessions', filter: `public_id=eq.${sessionId}` }, async () => {
      const session = await getSupabaseLiveSession(sessionId);
      if (session) onData(session);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_session_participants', filter: `session_public_id=eq.${sessionId}` }, async () => {
      const session = await getSupabaseLiveSession(sessionId);
      if (session) onData(session);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_session_content', filter: `session_public_id=eq.${sessionId}` }, async () => {
      const session = await getSupabaseLiveSession(sessionId);
      if (session) onData(session);
    })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') onError?.(new Error('Supabase live session channel error'));
    });

  getSupabaseLiveSession(sessionId).then((session) => {
    if (session) onData(session);
  }).catch((error) => onError?.(error));

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeShareSession(
  backend: SessionBackend,
  shareId: string,
  onData: (share: ShareSessionRecord) => void,
  onError?: (error: unknown) => void
): () => void {
  const channel = supabase
    .channel(`share-session:${shareId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_sessions', filter: `public_id=eq.${shareId}` }, async () => {
      const share = await getSupabaseShareSession(shareId);
      if (share) onData(share);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_session_participants', filter: `session_public_id=eq.${shareId}` }, async () => {
      const share = await getSupabaseShareSession(shareId);
      if (share) onData(share);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_session_content', filter: `session_public_id=eq.${shareId}` }, async () => {
      const share = await getSupabaseShareSession(shareId);
      if (share) onData(share);
    })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') onError?.(new Error('Supabase share session channel error'));
    });

  getSupabaseShareSession(shareId).then((share) => {
    if (share) onData(share);
  }).catch((error) => onError?.(error));

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function listSessionVotes(
  backend: SessionBackend,
  sessionId: string,
  kind: SessionKind,
  slideId: string
): Promise<Record<string, { oderId: string; selectedOptions: string[]; votedAt: number; voterName?: string }>> {
  const { data, error } = await supabase
    .from('live_session_votes')
    .select('slide_id, client_identity_id, selected_options, voted_at, voter_name')
    .eq('session_public_id', sessionId)
    .eq('slide_id', slideId)
    .returns<SupabaseVoteRow[]>();
  if (error) throw error;
  return (data || []).reduce<Record<string, { oderId: string; selectedOptions: string[]; votedAt: number; voterName?: string }>>((acc, vote) => {
    acc[vote.client_identity_id] = {
      oderId: vote.client_identity_id,
      selectedOptions: vote.selected_options || [],
      votedAt: new Date(vote.voted_at).getTime(),
      voterName: vote.voter_name || undefined,
    };
    return acc;
  }, {});
}

export async function upsertSessionVote(
  backend: SessionBackend,
  sessionId: string,
  slideId: string,
  currentUserId: string,
  selectedOptions: string[],
  voterName?: string
): Promise<void> {
  const { error } = await supabase.from('live_session_votes').upsert({
    session_public_id: sessionId,
    slide_id: slideId,
    client_identity_id: currentUserId,
    selected_options: selectedOptions,
    voted_at: new Date().toISOString(),
    voter_name: voterName || null,
  }, { onConflict: 'session_public_id,slide_id,client_identity_id' });

  if (error) throw error;
}

export async function listSessionPosts(
  backend: SessionBackend,
  sessionId: string,
  kind: SessionKind,
  slideId: string
): Promise<BoardPost[]> {
  const [{ data: posts, error: postsError }, { data: likes, error: likesError }] = await Promise.all([
    supabase
      .from('live_session_posts')
      .select('id, slide_id, client_identity_id, author_role, author_name, text, media_url, media_type, background_color, column_side, created_at, deleted_at')
      .eq('session_public_id', sessionId)
      .eq('slide_id', slideId)
      .is('deleted_at', null)
      .returns<SupabasePostRow[]>(),
    supabase
      .from('live_session_post_likes')
      .select('post_id, client_identity_id')
      .eq('session_public_id', sessionId)
      .returns<SupabaseLikeRow[]>(),
  ]);

  if (postsError) throw postsError;
  if (likesError) throw likesError;

  const likesByPost = (likes || []).reduce<Record<string, string[]>>((acc, row) => {
    if (!acc[row.post_id]) acc[row.post_id] = [];
    acc[row.post_id].push(row.client_identity_id);
    return acc;
  }, {});

  return (posts || []).map((post) => ({
    id: post.id,
    text: post.text || '',
    mediaUrl: post.media_url || undefined,
    mediaType: post.media_type || undefined,
    backgroundColor: post.background_color || undefined,
    column: post.column_side || undefined,
    authorName: post.author_name || 'Anonym',
    authorId: post.client_identity_id,
    likes: likesByPost[post.id] || [],
    createdAt: new Date(post.created_at).getTime(),
  }));
}

export async function addSessionPost(
  backend: SessionBackend,
  sessionId: string,
  kind: SessionKind,
  slideId: string,
  currentUserId: string,
  currentUserName: string | undefined,
  payload: { text: string; mediaUrl?: string; mediaType?: 'image' | 'youtube'; backgroundColor?: string; column?: 'left' | 'right' }
): Promise<void> {
  const { error } = await supabase.from('live_session_posts').insert({
    session_public_id: sessionId,
    slide_id: slideId,
    client_identity_id: currentUserId,
    author_role: 'student',
    author_name: currentUserName || 'Anonym',
    text: payload.text,
    media_url: payload.mediaUrl || null,
    media_type: payload.mediaType || null,
    background_color: payload.backgroundColor || null,
    column_side: payload.column || null,
    created_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function toggleSessionPostLike(
  backend: SessionBackend,
  sessionId: string,
  kind: SessionKind,
  slideId: string,
  postId: string,
  currentUserId: string
): Promise<void> {
  const { data: existing, error: fetchError } = await supabase
    .from('live_session_post_likes')
    .select('post_id')
    .eq('session_public_id', sessionId)
    .eq('post_id', postId)
    .eq('client_identity_id', currentUserId)
    .maybeSingle();
  if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

  if (existing) {
    const { error } = await supabase
      .from('live_session_post_likes')
      .delete()
      .eq('session_public_id', sessionId)
      .eq('post_id', postId)
      .eq('client_identity_id', currentUserId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('live_session_post_likes').insert({
      session_public_id: sessionId,
      post_id: postId,
      client_identity_id: currentUserId,
      created_at: new Date().toISOString(),
    });
    if (error) throw error;
  }
}

export async function deleteSessionPost(
  backend: SessionBackend,
  sessionId: string,
  kind: SessionKind,
  slideId: string,
  postId: string
): Promise<void> {
  const { error } = await supabase
    .from('live_session_posts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('session_public_id', sessionId)
    .eq('id', postId);
  if (error) throw error;
}

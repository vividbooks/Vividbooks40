import type { LiveQuizSession, Quiz } from '../../../types/quiz';
import type { StudentData } from '../../../utils/student-session';
import {
  addSessionPost,
  createLiveSessionRecord,
  createShareSessionRecord,
  deleteSessionPost,
  getPreferredSessionBackend,
  listSessionPosts,
  listSessionVotes,
  loadLiveSession,
  loadShareSession,
  lookupLiveSessionByCode,
  subscribeLiveSession,
  subscribeShareSession,
  toggleSessionPostLike,
  updateLiveSessionRecord,
  updateLiveStudentRecord,
  updateShareSessionRecord,
  updateShareStudentRecord,
  upsertLiveStudentRecord,
  upsertSessionVote,
  upsertShareStudentRecord,
  type SessionBackend,
  type SessionKind,
  type ShareSessionRecord,
  type ShareStudentRecord,
} from '../../../utils/live-session-repository';

export const boardSessionAdapter = {
  getPreferredBackend(): SessionBackend {
    return getPreferredSessionBackend();
  },

  createLiveSession(params: { quiz: Quiz; session: LiveQuizSession }) {
    return createLiveSessionRecord(params);
  },

  createShareSession(params: { share: ShareSessionRecord }) {
    return createShareSessionRecord(params);
  },

  loadLiveSession(sessionId: string) {
    return loadLiveSession(sessionId);
  },

  loadShareSession(shareId: string) {
    return loadShareSession(shareId);
  },

  lookupLiveSessionByCode(code: string) {
    return lookupLiveSessionByCode(code);
  },

  subscribeLiveSession,
  subscribeShareSession,

  updateLiveSession(backend: SessionBackend, sessionId: string, updates: Partial<LiveQuizSession>) {
    return updateLiveSessionRecord(backend, sessionId, updates);
  },

  updateShareSession(backend: SessionBackend, shareId: string, updates: Record<string, any>) {
    return updateShareSessionRecord(backend, shareId, updates);
  },

  upsertLiveParticipant(
    backend: SessionBackend,
    sessionId: string,
    studentId: string,
    student: StudentData & { clientIdentityId?: string }
  ) {
    return upsertLiveStudentRecord(backend, sessionId, studentId, student);
  },

  updateLiveParticipant(
    backend: SessionBackend,
    sessionId: string,
    studentId: string,
    updates: Partial<StudentData & { clientIdentityId?: string }>
  ) {
    return updateLiveStudentRecord(backend, sessionId, studentId, updates);
  },

  upsertShareParticipant(
    backend: SessionBackend,
    shareId: string,
    studentId: string,
    student: ShareStudentRecord
  ) {
    return upsertShareStudentRecord(backend, shareId, studentId, student);
  },

  updateShareParticipant(
    backend: SessionBackend,
    shareId: string,
    studentId: string,
    updates: Partial<ShareStudentRecord>
  ) {
    return updateShareStudentRecord(backend, shareId, studentId, updates);
  },

  listVotes(backend: SessionBackend, sessionId: string, sessionKind: SessionKind, slideId: string) {
    return listSessionVotes(backend, sessionId, sessionKind, slideId);
  },

  vote(
    backend: SessionBackend,
    sessionId: string,
    slideId: string,
    currentUserId: string,
    selectedOptions: string[],
    voterName?: string
  ) {
    return upsertSessionVote(backend, sessionId, slideId, currentUserId, selectedOptions, voterName);
  },

  listPosts(backend: SessionBackend, sessionId: string, sessionKind: SessionKind, slideId: string) {
    return listSessionPosts(backend, sessionId, sessionKind, slideId);
  },

  addPost(
    backend: SessionBackend,
    sessionId: string,
    sessionKind: SessionKind,
    slideId: string,
    currentUserId: string,
    currentUserName: string | undefined,
    payload: Parameters<typeof addSessionPost>[6]
  ) {
    return addSessionPost(backend, sessionId, sessionKind, slideId, currentUserId, currentUserName, payload);
  },

  togglePostLike(
    backend: SessionBackend,
    sessionId: string,
    sessionKind: SessionKind,
    slideId: string,
    postId: string,
    currentUserId: string
  ) {
    return toggleSessionPostLike(backend, sessionId, sessionKind, slideId, postId, currentUserId);
  },

  deletePost(
    backend: SessionBackend,
    sessionId: string,
    sessionKind: SessionKind,
    slideId: string,
    postId: string
  ) {
    return deleteSessionPost(backend, sessionId, sessionKind, slideId, postId);
  },
};

export type BoardSessionAdapter = typeof boardSessionAdapter;

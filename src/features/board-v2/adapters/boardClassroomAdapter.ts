import {
  endClassLiveSession,
  getClasses,
  notifyClassOfLiveSession,
} from '../../../utils/supabase/classes';

export const boardClassroomAdapter = {
  getClasses,
  notifyClassOfLiveSession,
  endClassLiveSession,
};

export type BoardClassroomAdapter = typeof boardClassroomAdapter;

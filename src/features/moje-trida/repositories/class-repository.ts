/**
 * Třídy — tenké obalení existujícího `utils/supabase/classes` (jeden vstupní bod pro repo vrstvu).
 */

import {
  getClasses,
  createClass,
  deleteClass,
  updateClass,
  type ClassGroup as SupabaseClassGroup,
} from '../../../utils/supabase/classes';
import type { ClassSummary } from '../domain/types';

export function mapClassGroupToSummary(c: SupabaseClassGroup): ClassSummary {
  return {
    id: c.id,
    name: c.name,
    studentsCount: c.students_count ?? 0,
    createdAt: c.created_at,
    color: (c as { color?: string }).color,
    imageUrl: (c as { imageUrl?: string }).imageUrl,
  };
}

export const classRepository = {
  async list(teacherId?: string): Promise<ClassSummary[]> {
    const rows = await getClasses(teacherId);
    return rows.map(mapClassGroupToSummary);
  },

  create: createClass,
  delete: deleteClass,
  update: updateClass,
};

/** Aktivní záložka v postranním panelu Moje třídy */
export type MyClassesTab = 'results' | 'classes' | 'individual';

/** Shrnutí třídy pro UI (mapováno z API / ClassGroup) */
export type ClassSummary = {
  id: string;
  name: string;
  studentsCount: number;
  createdAt: string;
  color?: string;
  imageUrl?: string;
};

export type TeacherClassPreferencesRow = {
  user_id: string;
  last_tab: MyClassesTab | null;
  selected_class_id: string | null;
  updated_at: string;
};

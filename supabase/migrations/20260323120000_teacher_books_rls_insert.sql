-- Explicitní RLS pro teacher_books: INSERT vyžaduje WITH CHECK; role authenticated.
-- Řeší „Nepodařilo se vytvořit knihu“ při vytváření z editoru (klient jako authenticated).

DROP POLICY IF EXISTS "Teachers can manage own books" ON teacher_books;

CREATE POLICY "teacher_books_select_own"
  ON teacher_books FOR SELECT TO authenticated
  USING (auth.uid() = teacher_id);

CREATE POLICY "teacher_books_insert_own"
  ON teacher_books FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "teacher_books_update_own"
  ON teacher_books FOR UPDATE TO authenticated
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "teacher_books_delete_own"
  ON teacher_books FOR DELETE TO authenticated
  USING (auth.uid() = teacher_id);

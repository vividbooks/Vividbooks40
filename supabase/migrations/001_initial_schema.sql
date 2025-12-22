-- =============================================
-- Vividbooks Database Schema
-- Migration: 001_initial_schema
-- =============================================
-- POZOR: Tento skript SMAŽE existující tabulky!

-- =============================================
-- SMAZÁNÍ STARÝCH TABULEK (v opačném pořadí)
-- =============================================

DROP TABLE IF EXISTS results CASCADE;
DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS class_collaborators CASCADE;
DROP TABLE IF EXISTS class_subjects CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS teachers CASCADE;
DROP TABLE IF EXISTS schools CASCADE;

-- Smazání funkcí
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS update_students_count() CASCADE;

-- =============================================
-- 1. ŠKOLY
-- =============================================

CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(300) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 2. UČITELÉ
-- =============================================

CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 3. TŘÍDY
-- =============================================

CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  grade INTEGER,
  students_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 4. PŘEDMĚTY TŘÍDY
-- =============================================

CREATE TABLE class_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_name VARCHAR(100) NOT NULL,
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  is_owner BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(class_id, subject_name)
);

-- =============================================
-- 5. SPOLUPRACOVNÍCI TŘÍDY
-- =============================================

CREATE TABLE class_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subject_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  invited_by UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE
);

-- =============================================
-- 6. STUDENTI
-- =============================================

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  email VARCHAR(255),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  initials VARCHAR(10),
  color VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 7. ÚKOLY / TESTY
-- =============================================

CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('test', 'practice', 'individual')),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  board_id UUID,
  subject VARCHAR(100) NOT NULL,
  due_date DATE,
  session_id VARCHAR(100),
  session_type VARCHAR(20) CHECK (session_type IN ('live', 'shared', 'individual')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES teachers(id) ON DELETE SET NULL
);

-- =============================================
-- 8. VÝSLEDKY
-- =============================================

CREATE TABLE results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  score INTEGER,
  max_score INTEGER DEFAULT 10,
  percentage INTEGER,
  correct_count INTEGER,
  total_questions INTEGER,
  time_spent_ms INTEGER,
  completed_at TIMESTAMP WITH TIME ZONE,
  teacher_comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(student_id, assignment_id)
);

-- =============================================
-- INDEXY
-- =============================================

CREATE INDEX idx_classes_teacher ON classes(teacher_id);
CREATE INDEX idx_students_class ON students(class_id);
CREATE INDEX idx_assignments_class ON assignments(class_id);
CREATE INDEX idx_assignments_subject ON assignments(subject);
CREATE INDEX idx_assignments_board ON assignments(board_id);
CREATE INDEX idx_results_student ON results(student_id);
CREATE INDEX idx_results_assignment ON results(assignment_id);
CREATE INDEX idx_class_subjects_class ON class_subjects(class_id);
CREATE INDEX idx_collaborators_teacher ON class_collaborators(teacher_id);
CREATE INDEX idx_collaborators_class ON class_collaborators(class_id);

-- =============================================
-- TRIGGERY
-- =============================================

-- Automatická aktualizace updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_classes_updated_at
    BEFORE UPDATE ON classes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_students_updated_at
    BEFORE UPDATE ON students
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teachers_updated_at
    BEFORE UPDATE ON teachers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Automatická aktualizace students_count
CREATE OR REPLACE FUNCTION update_students_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE classes SET students_count = students_count + 1 WHERE id = NEW.class_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE classes SET students_count = students_count - 1 WHERE id = OLD.class_id;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_class_students_count
    AFTER INSERT OR DELETE ON students
    FOR EACH ROW
    EXECUTE FUNCTION update_students_count();

-- =============================================
-- HOTOVO! ✅
-- =============================================
-- Vytvořeno 8 tabulek:
-- 1. schools
-- 2. teachers  
-- 3. classes
-- 4. class_subjects
-- 5. class_collaborators
-- 6. students
-- 7. assignments
-- 8. results

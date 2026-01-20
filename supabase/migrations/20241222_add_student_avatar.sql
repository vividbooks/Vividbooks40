-- Add avatar column to students table
-- Avatar is stored as JSONB containing the avatar configuration

ALTER TABLE students 
ADD COLUMN IF NOT EXISTS avatar JSONB DEFAULT NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_students_avatar ON students USING GIN (avatar);

-- Comment for documentation
COMMENT ON COLUMN students.avatar IS 'Student avatar configuration as JSON. Contains: backgroundColor, skinTone, faceShape, eyeStyle, mouthStyle, hairStyle, hairColor';


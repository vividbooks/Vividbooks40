import Group from '../../imports/Group-61-3287';

interface IconProps {
  className?: string;
}

export function LessonIcon({ className }: IconProps) {
  return (
    <div className={className}>
      <Group />
    </div>
  );
}

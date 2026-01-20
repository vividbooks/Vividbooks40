import Vector from '../../imports/Vector-61-3373';

interface IconProps {
  className?: string;
}

export function ExamIcon({ className }: IconProps) {
  return (
    <div className={className}>
      <Vector />
    </div>
  );
}

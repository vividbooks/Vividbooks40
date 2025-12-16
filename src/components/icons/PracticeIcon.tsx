import Vector from '../../imports/Vector';

interface IconProps {
  className?: string;
}

export function PracticeIcon({ className }: IconProps) {
  return (
    <div className={className}>
      <Vector />
    </div>
  );
}

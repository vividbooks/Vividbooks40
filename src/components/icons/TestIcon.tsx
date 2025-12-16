import Group from '../../imports/Group21339';

interface IconProps {
  className?: string;
}

export function TestIcon({ className }: IconProps) {
  return (
    <div className={className}>
      <Group />
    </div>
  );
}

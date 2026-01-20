import WorksheetSvg from '../../imports/IzolovanyRezim-61-3568';

interface IconProps {
  className?: string;
}

export function WorksheetIcon({ className }: IconProps) {
  return (
    <div className={className}>
      <WorksheetSvg />
    </div>
  );
}

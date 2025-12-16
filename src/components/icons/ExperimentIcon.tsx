import ExperimentSvg from '../../imports/Group11116';

interface IconProps {
  className?: string;
}

export function ExperimentIcon({ className }: IconProps) {
  return (
    <div className={className}>
      <ExperimentSvg />
    </div>
  );
}

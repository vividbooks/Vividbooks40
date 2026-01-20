import svgPaths from "./svg-nfhdgmz4fr";

function Vrstva() {
  return (
    <div className="absolute h-[33.635px] left-0 top-0 w-[41.032px]" data-name="Vrstva_1">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 42 34">
        <g clipPath="url(#clip0_61_2740)" id="Vrstva_1">
          <path d={svgPaths.p3ec7b800} fill="var(--fill-0, #FFDD00)" id="Vector" />
          <path d={svgPaths.pfb76f80} fill="var(--fill-0, #FFDD00)" id="Vector_2" />
        </g>
        <defs>
          <clipPath id="clip0_61_2740">
            <rect fill="white" height="33.6347" width="41.0319" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

export default function Group() {
  return (
    <div className="relative size-full">
      <Vrstva />
    </div>
  );
}
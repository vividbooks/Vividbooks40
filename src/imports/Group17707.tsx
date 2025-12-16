function Group() {
  return (
    <div className="absolute contents left-0 top-0">
      <div className="absolute bg-[#32f4ab] h-[6.376px] left-0 rounded-[2.158px] top-[20.4px] w-[8.09px]" />
      <div className="absolute bg-[#32f4ab] h-[26.779px] left-[20.8px] rounded-[2.158px] top-0 w-[8.09px]" />
      <div className="absolute bg-[#32f4ab] h-[15.302px] left-[10.4px] rounded-[2.158px] top-[11.48px] w-[8.09px]" />
    </div>
  );
}

export default function Group1() {
  return (
    <div className="relative size-full">
      <Group />
    </div>
  );
}
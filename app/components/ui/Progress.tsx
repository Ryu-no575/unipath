export default function Progress({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full rounded-full bg-zinc-100">
        <div
          className="h-1.5 rounded-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-end text-xs text-zinc-500">{value}%</span>
    </div>
  );
}

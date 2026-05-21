interface Props {
  rows?: number
  cols?: number
}

export default function SkeletonTable({ rows = 5, cols = 4 }: Props) {
  return (
    <div className="animate-pulse">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 py-3 border-b border-gray-100">
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className="h-4 bg-gray-200 rounded flex-1"
              style={{ maxWidth: c === 0 ? 120 : undefined }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

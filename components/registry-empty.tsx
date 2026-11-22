export function RegistryEmpty({ query }: { query: string }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center border-y border-slate-200 px-6 text-center">
      <div className="mb-3 text-sm font-semibold text-slate-900">No API records found</div>
      <p className="max-w-md text-sm leading-6 text-slate-500">
        {query
          ? `Nothing matches “${query}”. Try a broader term or clear a filter.`
          : "Try another jurisdiction or category, or clear the active filters."}
      </p>
    </div>
  );
}

export default function Loader() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white">
      <div className="flex flex-col items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-500/30">
          <span className="text-3xl font-bold leading-none text-white">e</span>
        </div>
        <h1 className="mt-5 text-lg font-bold tracking-tight text-slate-900">
          e-Class Analytics
        </h1>
        <div className="mt-5 h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-indigo-500" />
      </div>
    </div>
  );
}

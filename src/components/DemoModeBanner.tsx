export const DemoModeBanner = () => {
  const token = localStorage.getItem('auth-storage');
  const isDemo = token?.includes('demo-token');

  if (!isDemo) return null;

  return (
    <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-yellow-800 font-medium">🎭 Demo Mode</span>
          <span className="text-yellow-600 text-sm">
            Using offline credentials - No backend required
          </span>
        </div>
        <button
          onClick={() => {
            localStorage.clear();
            window.location.href = '/login';
          }}
          className="text-yellow-700 hover:text-yellow-900 text-sm underline"
        >
          Exit Demo
        </button>
      </div>
    </div>
  );
};

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900">
      <div className="text-center">
        <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-pink-500"></div>
        <p className="text-lg text-gray-300">Loading...</p>
      </div>
    </div>
  );
}

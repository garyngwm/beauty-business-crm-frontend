export default function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full">
      <div className="animate-spin rounded-full h-12 w-12 border-8 border-t-8 border-gray-300 border-t-purple-600" />
    </div>
  );
}

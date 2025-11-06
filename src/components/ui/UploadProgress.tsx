export function UploadProgress({
  progress,
  uploading,
}: {
  progress: number;
  uploading: boolean;
}) {
  if (!uploading) return null;

  return (
    <div className='mt-4 w-full max-w-sm'>
      <div className='text-center text-sm text-gray-600'>
        Uploading... {progress}%
      </div>
      <div className='w-full bg-gray-200 rounded-full h-2 mt-2'>
        <div
          className='bg-blue-600 h-2 rounded-full'
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

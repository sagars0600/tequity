import React, { useState, useCallback, useRef, useEffect } from 'react';

type FileStatus = 'Queued' | 'Uploading' | 'Done' | 'Error' | 'Paused';

interface UploadFile {
  file: File;
  relativePath: string;
  size: string;
  status: FileStatus;
  progress: number;
  retries: number;
}

const MAX_CONCURRENT_UPLOADS = 3;
const MAX_RETRIES = 2;
const CLOUD_NAME = 'dzjoqltqg';
const UPLOAD_PRESET = 'tequity';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`;


const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const getRootDirectory = (relativePath: string) => {
  const parts = relativePath.split('/');
  return parts.length > 1 ? parts[0] : '';
};

const FileUploader: React.FC = () => {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isPaused, setIsPaused] = useState(false);


  const [liveMessage, setLiveMessage] = useState('');


  const queue = useRef<UploadFile[]>([]);
  const uploadingCount = useRef(0);
  const pauseRef = useRef(isPaused);


  useEffect(() => {
    pauseRef.current = isPaused;
  }, [isPaused]);


  const handleFiles = (fileList: FileList) => {
    const newFiles: UploadFile[] = Array.from(fileList).map((file) => ({
      file,
      relativePath: file.webkitRelativePath || file.name,
      size: formatSize(file.size),
      status: 'Queued',
      progress: 0,
      retries: 0,
    }));

    setFiles((prev) => [...prev, ...newFiles]);
    queue.current.push(...newFiles);
    processQueue();
  };


  const processQueue = useCallback(() => {
    if (pauseRef.current) return;

    while (
      uploadingCount.current < MAX_CONCURRENT_UPLOADS &&
      queue.current.length > 0
    ) {
      const nextFile = queue.current.shift();
      if (nextFile) {
        uploadingCount.current++;
        uploadFile(nextFile).finally(() => {
          uploadingCount.current--;
          processQueue();
        });
      }
    }
  }, []);

  const uploadFile = async (uploadFile: UploadFile) => {

    if (pauseRef.current) {
      setFiles((prev) =>
        prev.map((f) =>
          f.relativePath === uploadFile.relativePath
            ? { ...f, status: 'Paused' }
            : f,
        ),
      );
      queue.current.unshift(uploadFile);
      return;
    }

    setFiles((prev) =>
      prev.map((f) =>
        f.relativePath === uploadFile.relativePath
          ? { ...f, status: 'Uploading', progress: 0 }
          : f,
      ),
    );
    setLiveMessage(`Uploading ${uploadFile.relativePath}`);

    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
      try {
        const formData = new FormData();
        formData.append('file', uploadFile.file);
        formData.append('upload_preset', UPLOAD_PRESET);
        formData.append('originalFilename', uploadFile.file.name);
        formData.append(
          'rootDirectory',
          getRootDirectory(uploadFile.relativePath),
        );

        let progress = 0;
        setFiles((prev) =>
          prev.map((f) =>
            f.relativePath === uploadFile.relativePath ? { ...f, progress } : f,
          ),
        );


        const simulateProgress = new Promise<void>((resolve, reject) => {
          const interval = setInterval(() => {
            if (pauseRef.current) {
              clearInterval(interval);
              setFiles((prev) =>
                prev.map((f) =>
                  f.relativePath === uploadFile.relativePath
                    ? { ...f, status: 'Paused' }
                    : f,
                ),
              );
              queue.current.unshift(uploadFile);
              reject(new Error('Upload paused'));
              return;
            }
            progress += 10;
            if (progress > 90) progress = 90;
            setFiles((prev) =>
              prev.map((f) =>
                f.relativePath === uploadFile.relativePath
                  ? { ...f, progress }
                  : f,
              ),
            );
          }, 200);
          fetch(CLOUDINARY_UPLOAD_URL, {
            method: 'POST',
            body: formData,
          })
            .then((res) => {
              clearInterval(interval);
              if (!res.ok) {
                if (res.status >= 500 && res.status < 600) {
                  throw { status: res.status };
                } else {
                  throw new Error('Upload failed with status ' + res.status);
                }
              }
              resolve();
            })
            .catch((err) => {
              clearInterval(interval);
              reject(err);
            });
        });

        await simulateProgress;


        setFiles((prev) =>
          prev.map((f) =>
            f.relativePath === uploadFile.relativePath
              ? { ...f, status: 'Done', progress: 100 }
              : f,
          ),
        );
        setLiveMessage(`Completed upload of ${uploadFile.relativePath}`);
        return;
      } catch (err: any) {
        if (err.message === 'Upload paused') {

          return;
        }
        if (err?.status >= 500 && err?.status < 600) {
          attempt++;
          if (attempt <= MAX_RETRIES) {
            setLiveMessage(
              `Retrying ${uploadFile.relativePath} (Attempt ${attempt})`,
            );
            await new Promise((res) => setTimeout(res, 1000));
          } else {
            setFiles((prev) =>
              prev.map((f) =>
                f.relativePath === uploadFile.relativePath
                  ? { ...f, status: 'Error' }
                  : f,
              ),
            );
            setLiveMessage(
              `Failed to upload ${uploadFile.relativePath} after retries`,
            );
            return;
          }
        } else {
          setFiles((prev) =>
            prev.map((f) =>
              f.relativePath === uploadFile.relativePath
                ? { ...f, status: 'Error' }
                : f,
            ),
          );
          setLiveMessage(`Upload error for ${uploadFile.relativePath}`);
          return;
        }
      }
    }
  };


  const overallProgress =
    files.length === 0
      ? 0
      : Math.round(
        files.reduce((acc, f) => acc + f.progress, 0) / files.length,
      );


  const togglePause = () => {
    setIsPaused((prev) => {
      const newPaused = !prev;
      if (!newPaused) {

        setFiles((prevFiles) => {
          const pausedFiles = prevFiles.filter((f) => f.status === 'Paused');
          queue.current.push(...pausedFiles);

          return prevFiles.map((f) =>
            f.status === 'Paused' ? { ...f, status: 'Queued', progress: 0 } : f,
          );
        });
        setTimeout(() => {
          processQueue();
        }, 100);
      }
      return newPaused;
    });
  };
  const isUploadingOrQueued = files.some(
    (f) => f.status === 'Uploading' || f.status === 'Queued' || f.status === 'Paused'
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-200 to-blue-400 p-6">

      <div className="max-w-5xl mx-auto text-center mb-8">
        <h1 className="text-4xl font-medium bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent mb-3">
          Bulk Document Uploader
        </h1>
        <p className="text-gray-600 text-lg">
          Upload multiple documents with style and efficiency
        </p>
      </div>


      {files.length > 0 && (
        <div className="max-w-5xl mx-auto bg-white shadow-lg rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold text-gray-800">Upload Progress</h2>
            {isUploadingOrQueued && (
              <button
                onClick={togglePause}
                aria-pressed={isPaused}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 text-white rounded px-4 py-2 text-sm font-medium"
              >
                {isPaused ? (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M14.752 11.168l-6.518-3.75A.75.75 0 007 7.75v8.5a.75.75 0 001.234.62l6.518-3.75a.75.75 0 000-1.304z" />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M10 9v6m4-6v6" />
                  </svg>
                )}
                {isPaused ? 'Resume' : 'Pause'} Uploads
              </button>
            )}

          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={overallProgress}
            className="w-full h-3 rounded bg-gray-200 overflow-hidden"
            tabIndex={0}
          >
            <div
              className={`h-3 bg-gradient-to-r from-green-400 to-green-600 transition-all`}
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {Math.round(overallProgress)}% Complete • {files.filter(f => f.status === 'Done').length} of {files.length} files uploaded

          </p>
        </div>
      )}


      <div
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
          setIsDragging(false);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        className={`max-w-5xl mx-auto border-2 border-dashed rounded-lg p-10 text-center cursor-pointer select-none transition-all duration-300
    ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}
    hover:border-blue-500 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] focus:shadow-[0_0_25px_rgba(59,130,246,0.6)]`}
        tabIndex={0}
        role="button"
        aria-label="File upload drop zone, drag and drop files or folders here"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            document.getElementById('file-input')?.click();
          }
        }}
      >

        <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-gradient-to-r from-blue-600 to-blue-400 flex items-center justify-center shadow-md">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h4l2 3h11v9H3z" />
          </svg>
        </div>

        <p className="text-gray-600 mb-1 text-lg font-semibold">
          Drag & drop folder(s) here, or choose from your computer
        </p>
        <p className="text-gray-600 text-sm mb-4">
          Support for all document types • Bulk upload enabled
        </p>

        <label
          htmlFor="file-input"
          className="inline-block bg-gradient-to-r from-blue-600 to-blue-400 hover:from-blue-700 hover:to-blue-500 focus:ring-4 focus:ring-blue-400 focus:outline-none focus:ring-offset-2 text-white font-semibold rounded-lg px-6 py-3 cursor-pointer select-none shadow-md transition duration-200 ease-in-out active:scale-95 active:from-blue-800 active:to-blue-600"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              document.getElementById('file-input')?.click();
            }
          }}
        >
          Choose Folder
        </label>

        <input
          id="file-input"
          type="file"
          multiple
          className="hidden"
          // {...{ webkitdirectory: 'true' }} 
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
          }}
        />
      </div>



      {files.length > 0 && (
        <div className="max-w-5xl mx-auto mt-8 bg-white rounded-lg p-4 shadow-lg">
          <h3 className="mb-4 font-semibold text-lg text-gray-800">Files</h3>
          <ul className="space-y-3">
            {files.map((file) => (
              <li
                key={file.relativePath}
                tabIndex={0}
                aria-label={`${file.relativePath}, size ${file.size}, status ${file.status}, progress ${file.progress}%`}
                className="rounded-md bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {/* Top Row: Filename + Status + Size */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  {/* Icon + Filename */}
                  <div className="flex items-center gap-3 min-w-0">
                    {file.status === 'Done' ? (
                      <svg
                        className="w-5 h-5 text-green-500 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <div className="w-5 h-5 flex-shrink-0" />
                    )}
                    <p className="truncate font-medium text-gray-700">{file.relativePath}</p>
                  </div>

                  {/* File size + Status + % */}
                  <div className="flex flex-wrap sm:flex-nowrap gap-3 sm:gap-6 sm:items-center">
                    {/* File Size */}
                    <span className="text-sm text-gray-600 whitespace-nowrap">
                      {typeof file.size === 'number'
                        ? `${(file.size / 1024).toFixed(1)} KB`
                        : file.size}
                    </span>

                    {/* Status Badge */}
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap
                  ${file.status === 'Done'
                          ? 'bg-green-700 text-green-300'
                          : file.status === 'Uploading'
                            ? 'bg-blue-700 text-blue-300'
                            : file.status === 'Paused'
                              ? 'bg-yellow-600 text-yellow-300'
                              : file.status === 'Error'
                                ? 'bg-red-700 text-red-300'
                                : 'bg-gray-700 text-gray-400'
                        }`}
                    >
                      {file.status === 'Done'
                        ? 'Done'
                        : file.status.charAt(0).toUpperCase() + file.status.slice(1)}
                    </span>

                    {/* % Progress */}
                    <span className="text-sm font-mono text-gray-700 whitespace-nowrap">
                      {file.progress}%
                    </span>
                  </div>
                </div>

                {/* Progress bar (always below) */}
                <div className="mt-3">
                  <div className="h-2 rounded-full bg-gray-300 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-300
                  ${file.status === 'Done'
                          ? 'bg-green-500'
                          : file.status === 'Error'
                            ? 'bg-red-500'
                            : file.status === 'Paused'
                              ? 'bg-yellow-400'
                              : 'bg-blue-500'
                        }`}
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}



      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        tabIndex={-1}
      >
        {liveMessage}
      </div>
    </div>
  );

};

export default FileUploader;

import React, { useRef } from 'react';
import { PackagePlusIcon, XIcon } from './Icons';

interface ObjectUploaderProps {
  onObjectUpload: (file: File) => void;
  onObjectRemove: () => void;
  uploadedObjectUrl: string | null;
  disabled: boolean;
}

export const ObjectUploader: React.FC<ObjectUploaderProps> = ({ onObjectUpload, onObjectRemove, uploadedObjectUrl, disabled }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onObjectUpload(file);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
        disabled={disabled}
      />
      {uploadedObjectUrl ? (
        <div className="mt-2 p-2 border border-gray-300 rounded-lg flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-3">
            <img src={uploadedObjectUrl} alt="Uploaded object preview" className="w-12 h-12 object-contain rounded bg-white shadow-sm" />
            <span className="text-sm text-gray-700 font-medium">Object placed on canvas.</span>
          </div>
          <button
            onClick={onObjectRemove}
            className="p-1.5 text-gray-500 hover:text-red-600 rounded-full hover:bg-red-100 transition-colors"
            title="Remove Object"
            disabled={disabled}
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <button
          onClick={handleButtonClick}
          disabled={disabled}
          className="w-full mt-2 flex items-center justify-center px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-indigo-400 hover:text-indigo-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:border-gray-200 disabled:text-gray-400"
        >
          <PackagePlusIcon className="w-5 h-5 mr-2" />
          <span>Upload Object</span>
        </button>
      )}
    </div>
  );
};

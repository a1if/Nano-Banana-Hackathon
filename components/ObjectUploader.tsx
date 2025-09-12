import React, { useRef } from 'react';
import { PackagePlusIcon, XIcon } from './Icons';
import { UploadedObject } from '../types';

interface ObjectUploaderProps {
  onObjectUpload: (file: File) => void;
  onObjectRemove: (id: string) => void;
  uploadedObjects: UploadedObject[];
  disabled: boolean;
}

export const ObjectUploader: React.FC<ObjectUploaderProps> = ({ onObjectUpload, onObjectRemove, uploadedObjects, disabled }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onObjectUpload(file);
    }
    // Reset file input to allow uploading the same file again
    if(event.target) {
        event.target.value = '';
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/png, image/jpeg, image/webp"
        disabled={disabled}
      />
      
      {uploadedObjects.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 p-2 border border-gray-200 rounded-lg bg-gray-50 max-h-48 overflow-y-auto">
          {uploadedObjects.map(obj => (
            <div key={obj.id} className="relative group aspect-square">
              <img src={obj.imageUrl} alt="Uploaded object preview" className="w-full h-full object-contain rounded bg-white shadow-sm p-1" />
              <button
                onClick={() => onObjectRemove(obj.id)}
                className="absolute -top-1 -right-1 p-0.5 text-white bg-red-500 rounded-full hover:bg-red-700 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                title="Remove Object"
                disabled={disabled}
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleButtonClick}
        disabled={disabled}
        className="w-full flex items-center justify-center px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-indigo-400 hover:text-indigo-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:border-gray-200 disabled:text-gray-400"
      >
        <PackagePlusIcon className="w-5 h-5 mr-2" />
        <span>Add Object</span>
      </button>

    </div>
  );
};

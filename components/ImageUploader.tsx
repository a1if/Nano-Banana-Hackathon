import React, { useState, useRef, useEffect } from 'react';
import { UploadIcon, CheckCircleIcon } from './Icons';

interface ImageUploaderProps {
  onImageSelect: (file: File) => void;
  selectedImage: File | null;
}

const sampleImages = [
  { id: 'living-room', url: 'https://picsum.photos/id/106/800/600', name: 'Living Room' },
  { id: 'bedroom', url: 'https://picsum.photos/id/21/800/600', name: 'Bedroom' },
  { id: 'kitchen', url: 'https://picsum.photos/id/351/800/600', name: 'Kitchen' },
  { id: 'dining', url: 'https://picsum.photos/id/20/800/600', name: 'Dining Area' },
];

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelect, selectedImage }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedSample, setSelectedSample] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (selectedImage) {
      const objectUrl = URL.createObjectURL(selectedImage);
      setPreviewUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } else {
      setPreviewUrl(null);
      setSelectedSample(null); // Clear sample highlight on reset
    }
  }, [selectedImage]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedSample(null);
      onImageSelect(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleSampleSelect = async (imageUrl: string, imageId: string) => {
    setSelectedSample(imageId);
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const fileName = `${imageId}.jpg`;
      const file = new File([blob], fileName, { type: 'image/jpeg' });
      onImageSelect(file);
    } catch (error) {
      console.error("Error fetching sample image:", error);
    }
  };

  return (
    <div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
      />
      
      {previewUrl && (
        <div className="mb-4 relative">
          <img src={previewUrl} alt="Selected preview" className="w-full h-auto rounded-lg shadow-md" />
           <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1">
             <CheckCircleIcon className="w-5 h-5" />
           </div>
        </div>
      )}

      <button
        onClick={handleUploadClick}
        className="w-full flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-indigo-500 hover:text-indigo-600 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        <UploadIcon className="w-5 h-5 mr-2" />
        <span>Upload an Image</span>
      </button>

      <div className="mt-6">
        <p className="text-sm text-center text-gray-500 mb-3">Or try one of these:</p>
        <div className="grid grid-cols-2 gap-3">
          {sampleImages.map((image) => (
            <div
              key={image.id}
              onClick={() => handleSampleSelect(image.url, image.id)}
              className={`relative rounded-lg overflow-hidden cursor-pointer group transform hover:scale-105 transition-transform duration-200 ${selectedSample === image.id ? 'ring-2 ring-offset-2 ring-indigo-500' : ''}`}
            >
              <img src={image.url} alt={image.name} className="w-full h-20 object-cover" />
              <div className="absolute inset-0 bg-black bg-opacity-40 group-hover:bg-opacity-20 transition-all duration-300 flex items-center justify-center">
                <span className="text-white text-xs font-semibold">{image.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
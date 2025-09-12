import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
import type { GenerationResult } from '../types';

const dataUrlToInfo = (dataUrl: string): { base64: string; mimeType: string } => {
  const [metaPart, dataPart] = dataUrl.split(',');
  const mimeType = metaPart.split(':')[1].split(';')[0];
  return { base64: dataPart, mimeType };
};


export const visualizeDesign = async (imageSource: string, prompt: string, maskSource?: string | null): Promise<GenerationResult[]> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const { base64: base64ImageData, mimeType } = dataUrlToInfo(imageSource);

  // This function generates a single design. We will call it multiple times in parallel.
  const generateSingleDesign = async (): Promise<GenerationResult | null> => {
    try {
      const imagePart = {
        inlineData: {
          data: base64ImageData,
          mimeType: mimeType,
        },
      };

      const textPart = { text: prompt };

      // The parts array for the API call.
      // The order is important for inpainting: image, then prompt, then mask.
      const parts = [imagePart, textPart];

      if (maskSource) {
        const { base64: maskBase64, mimeType: maskMimeType } = dataUrlToInfo(maskSource);
        const maskPart = {
          inlineData: {
            data: maskBase64,
            mimeType: maskMimeType,
          },
        };
        parts.push(maskPart);
      }
      
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: parts },
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
      });

      if (response.candidates && response.candidates.length > 0) {
        const candidate = response.candidates[0]; // This model usually returns one candidate per call.
        let newImageUrl: string | null = null;
        let newText: string = "No text description was generated.";

        if (candidate.content && candidate.content.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData) {
              const base64ImageBytes: string = part.inlineData.data;
              const imageMimeType: string = part.inlineData.mimeType;
              newImageUrl = `data:${imageMimeType};base64,${base64ImageBytes}`;
            } else if (part.text) {
              newText = part.text;
            }
          }
        }

        if (newImageUrl) {
          return { 
            id: `res-${Date.now()}-${Math.random()}`,
            imageUrl: newImageUrl, 
            text: newText,
            success: true,
            createdAt: new Date().toISOString(),
          };
        }
      }
    } catch (error) {
        console.error("A single image generation failed:", error);
    }
    return null; // Return null if generation fails or yields no image
  };

  const numberOfImagesToGenerate = 2; // Generate 2 options for the user.
  const generationPromises: Promise<GenerationResult | null>[] = [];

  for (let i = 0; i < numberOfImagesToGenerate; i++) {
    generationPromises.push(generateSingleDesign());
  }
  
  const resultsWithNulls = await Promise.all(generationPromises);
  const finalResults = resultsWithNulls.filter((r): r is GenerationResult => r !== null && r.success);


  if (finalResults.length === 0) {
    throw new Error("The API did not return any images. It may have considered the request unsafe or an error occurred during generation.");
  }
  
  return finalResults;
};

import imageCompression from "browser-image-compression";

export type ImageProcessingResult = {
  error?: Error;
  thumbnailBlob?: Blob;
  base64?: string;
  fileName: string;
};

export async function processImage(
  file: File,
  onProgress?: (progress: number) => void
): Promise<ImageProcessingResult> {
  try {
    // Generate thumbnail
    const thumbnailBlob = await imageCompression(file, {
      maxWidthOrHeight: 300,
      useWebWorker: true,
    });
    onProgress?.(10);

    // Generate base64 for analysis
    const base64 = await new Promise<string>(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        resolve(base64String.split(",")[1]); // Remove the data URL prefix
      };
      reader.readAsDataURL(file);
    });
    onProgress?.(20);

    // Generate filename
    const fileName = `${Date.now()}-${file.name}`;

    return { thumbnailBlob, base64, fileName };
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error(String(error)),
      fileName: file.name,
    };
  }
}

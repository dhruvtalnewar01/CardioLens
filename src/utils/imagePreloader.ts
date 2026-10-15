export const preloadImages = (
  frameCount: number,
  pathPrefix: string,
  extension: string = "jpg",
  padLength: number = 3
): HTMLImageElement[] => {
  const images: HTMLImageElement[] = [];
  for (let i = 1; i <= frameCount; i++) {
    const img = new Image();
    const indexStr = i.toString().padStart(padLength, "0");
    img.src = `${pathPrefix}/ezgif-frame-${indexStr}.${extension}`;
    img.onerror = () => {
      console.error(`Failed to load frame: ${img.src}. Ensure public/hero_sequence exists and Next.js server was restarted.`);
    };
    images.push(img);
  }
  return images;
};

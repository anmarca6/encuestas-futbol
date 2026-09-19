// Recorta la imagen al centro en un cuadrado y la devuelve como data URL WebP. Solo en el navegador.
export async function resizeImageToDataUrl(file: File, size = 256, quality = 0.8): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo procesar la imagen.');
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const width = bitmap.width * scale;
  const height = bitmap.height * scale;
  context.drawImage(bitmap, (size - width) / 2, (size - height) / 2, width, height);
  bitmap.close();
  return canvas.toDataURL('image/webp', quality);
}

// Reduce la imagen para que su lado mayor no supere maxSide, sin recortarla. Solo en el navegador.
export async function fitImageToDataUrl(file: File, maxSide = 800, quality = 0.78): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo procesar la imagen.');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/webp', quality);
}

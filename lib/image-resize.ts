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

// Reduce la imagen para que su lado mayor no supere maxSide, sin recortarla, y la comprime hasta que el
// data URL no supere maxLength caracteres. Solo en el navegador.
export async function fitImageToDataUrl(file: File, maxSide = 800, maxLength = 250_000): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    let side = maxSide;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('No se pudo procesar la imagen.');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.8, 0.65, 0.5]) {
        const dataUrl = canvas.toDataURL('image/webp', quality);
        if (dataUrl.length <= maxLength) return dataUrl;
      }
      side = Math.round(side * 0.75);
    }
    throw new Error('La imagen es demasiado compleja para reducirla lo suficiente.');
  } finally {
    bitmap.close();
  }
}

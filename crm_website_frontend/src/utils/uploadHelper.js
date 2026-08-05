/**
 * Uploads a file directly from the browser to Cloudinary using signed parameters.
 * Bypasses backend & Vercel serverless request payload size limits (4.5MB).
 * Preserves original filename format: <sanitized_original_name>_<random_suffix>.<ext>
 *
 * @param {File} file - The file object to upload
 * @param {string} token - User JWT auth token
 * @param {string} apiUrl - Base backend API URL
 * @returns {Promise<string>} The secure uploaded file URL from Cloudinary
 */
export async function uploadFileToCloudinary(file, token, apiUrl) {
  // 1. Generate sanitized custom public_id to preserve original filename + unique suffix
  const originalName = file.name || 'file';
  const dotIndex = originalName.lastIndexOf('.');
  const ext = dotIndex !== -1 ? originalName.substring(dotIndex).toLowerCase() : '';
  const nameWithoutExt = dotIndex !== -1 ? originalName.substring(0, dotIndex) : originalName;

  const sanitized = nameWithoutExt.replace(/[^a-zA-Z0-9-_]/g, '_');
  const uniqueSuffix = Math.random().toString(36).substring(2, 8);
  const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);

  // Include extension in public_id for raw assets (e.g. PDFs) so Cloudinary keeps .pdf in the URL
  const customPublicId = `${sanitized}_${uniqueSuffix}${isImage ? '' : ext}`;

  // 2. Request upload signature from backend with custom public_id
  const sigRes = await fetch(`${apiUrl}/upload/signature?public_id=${encodeURIComponent(customPublicId)}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!sigRes.ok) {
    const errorData = await sigRes.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to obtain upload signature from server');
  }

  const { timestamp, signature, apiKey, cloudName, folder, publicId } = await sigRes.json();

  // 3. Prepare Form Data for direct Cloudinary upload
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp);
  formData.append('signature', signature);
  formData.append('folder', folder);
  if (publicId) {
    formData.append('public_id', publicId);
  }

  // 4. Post directly to Cloudinary REST endpoint
  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: 'POST',
    body: formData
  });

  if (!uploadRes.ok) {
    const errorData = await uploadRes.json().catch(() => ({}));
    let errorMessage = errorData.error?.message || 'Direct Cloudinary upload failed';

    if (errorMessage.includes('File size too large')) {
      errorMessage = `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds 10 MB limit for documents/images. Please compress or select a file under 10 MB.`;
    }

    throw new Error(errorMessage);
  }

  const uploadData = await uploadRes.json();
  return uploadData.secure_url;
}

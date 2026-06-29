// Set this once the Apps Script Web App is deployed.
export const ENDPOINT_URL = '';

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

export async function submitRegistration(payload) {
  if (!ENDPOINT_URL) {
    throw new Error('Endpoint not configured. Set ENDPOINT_URL in js/api.js.');
  }
  const res = await fetch(ENDPOINT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Server error ${res.status}.`);
  return res.json();
}

// Set this once the Apps Script Web App is deployed.
export const ENDPOINT_URL = 'https://script.google.com/macros/s/AKfycbzEMUh6CLrjaNw-SHt9gefWgeP-BX3CsYoG8_Q4HHrW6FnE1vAIL0lyI3mMxTwsKpIcNg/exec';

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
    // Mock response for local testing — remove when backend is deployed.
    return { success: true, applicationId: 'TEST-' + Date.now() };
  }
  const res = await fetch(ENDPOINT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Server error ${res.status}.`);
  return res.json();
}

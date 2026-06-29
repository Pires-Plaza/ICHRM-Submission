const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX_FILE_BYTES = 20 * 1024 * 1024;

const REQUIRED_FIELDS = {
  name: 'Full name',
  institution: 'Institution',
  address: 'Address',
  countryCity: 'Country, city and zip code',
  email: 'Email',
  phone: 'Phone',
  academicDegree: 'Academic degree',
  registrationType: 'Registration type',
  paymentMethod: 'Payment method',
  invoiceName: 'Invoice name',
  invoiceAddress: 'Invoice address',
  invoiceCountryCity: 'Invoice country, city and zip code',
};

export function validateForm(data, paperFile) {
  const errors = [];

  for (const [field, label] of Object.entries(REQUIRED_FIELDS)) {
    if (!data[field]?.toString().trim()) {
      errors.push(`${label} is required.`);
    }
  }

  if (data.email && !EMAIL_RE.test(data.email)) {
    errors.push('Please enter a valid email address.');
  }

  if (data.isAuthor) {
    if (!data.paperTitle?.trim()) errors.push('Paper title is required for authors.');
    if (!data.presentationFormat) errors.push('Please select a presentation format.');
    if (!paperFile) {
      errors.push('Please upload your paper (DOCX).');
    } else if (paperFile.size > MAX_FILE_BYTES) {
      errors.push('Paper must be under 20 MB.');
    } else if (!isDocx(paperFile)) {
      errors.push('Paper must be a DOCX file.');
    }
  }

  return errors;
}

function isDocx(file) {
  return file.type === DOCX_MIME || file.name.toLowerCase().endsWith('.docx');
}

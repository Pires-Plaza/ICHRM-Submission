import { validateForm } from './validation.js';
import { fileToBase64, submitRegistration } from './api.js';

const EARLY_DEADLINE = new Date('2027-02-01T00:00:00');

const FEES = {
  author_academic_manager: { early: 385, late: 485 },
  student: { early: 285, late: 385 },
};

const PERIOD_LABELS = {
  early: 'Early registration (until 31 Jan 2027)',
  late: 'Standard registration (from 1 Feb 2027)',
};

function getRegistrationPeriod() {
  return new Date() < EARLY_DEADLINE ? 'early' : 'late';
}

function getFieldValue(name) {
  return document.querySelector(`[name="${name}"]`)?.value?.trim() ?? '';
}

function getRadioValue(name) {
  return document.querySelector(`input[type="radio"][name="${name}"]:checked`)?.value ?? null;
}

function showPaperError(msg) {
  paperError.textContent = msg;
  paperError.hidden = false;
}

function showFormError(msg) {
  formErrors.textContent = msg;
  formErrors.hidden = false;
}

function resetSubmitBtn() {
  submitBtn.disabled = false;
  submitBtn.textContent = 'Submit Registration';
}

function updateFee() {
  const type = getRadioValue('registrationType');
  if (!type) return;
  const period = getRegistrationPeriod();
  feeAmount.textContent = `€${FEES[type][period]}`;
  feePeriod.textContent = PERIOD_LABELS[period];
  feeDisplay.hidden = false;
}

const REGISTRATION_TYPE_LABELS = {
  author_academic_manager: 'Author, academic or manager',
  student: 'Undergraduate, master or doctoral student',
};
const PAYMENT_METHOD_LABELS = {
  bank_transfer: 'Bank Transfer',
  paypal: 'PayPal',
};
const FORMAT_LABELS = {
  onsite: 'Onsite',
  online: 'Online',
};

function populatePrintSummary(data, applicationId) {
  const period = getRegistrationPeriod();
  const fee    = FEES[data.registrationType]?.[period];

  document.getElementById('p-submissionId').textContent  = applicationId;
  document.getElementById('p-date').textContent          = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  document.getElementById('p-name').textContent          = data.name;
  document.getElementById('p-institution').textContent   = data.institution;
  document.getElementById('p-address').textContent       = data.address;
  document.getElementById('p-countryCity').textContent   = data.countryCity;
  document.getElementById('p-email').textContent         = data.email;
  document.getElementById('p-phone').textContent         = data.phone;
  document.getElementById('p-academicDegree').textContent = data.academicDegree;
  document.getElementById('p-isAuthor').textContent      = data.isAuthor ? 'Yes' : 'No';
  document.getElementById('p-registrationType').textContent = REGISTRATION_TYPE_LABELS[data.registrationType] ?? data.registrationType;
  document.getElementById('p-fee').textContent           = fee ? `€${fee} (${period === 'early' ? 'Early' : 'Standard'} registration)` : '—';
  document.getElementById('p-paymentMethod').textContent = PAYMENT_METHOD_LABELS[data.paymentMethod] ?? data.paymentMethod;
  document.getElementById('p-bankInfo').hidden   = data.paymentMethod !== 'bank_transfer';
  document.getElementById('p-paypalInfo').hidden = data.paymentMethod !== 'paypal';
  document.getElementById('p-invoiceName').textContent   = data.invoiceName;
  document.getElementById('p-invoiceAddress').textContent    = data.invoiceAddress;
  document.getElementById('p-invoiceCountryCity').textContent = data.invoiceCountryCity;

  const paperTitleRow = document.getElementById('p-row-paperTitle');
  const formatRow     = document.getElementById('p-row-presentationFormat');
  paperTitleRow.hidden = !data.isAuthor;
  formatRow.hidden     = !data.isAuthor;

  const authorsContainer = document.getElementById('p-authors-container');
  authorsContainer.innerHTML = '';
  if (data.isAuthor) {
    document.getElementById('p-paperTitle').textContent         = data.paperTitle;
    document.getElementById('p-presentationFormat').textContent = FORMAT_LABELS[data.presentationFormat] ?? data.presentationFormat;
    data.authors.forEach((author, i) => {
      const row = document.createElement('div');
      row.className = 'print-row';
      const dt = document.createElement('dt');
      dt.textContent = `Author ${i + 1}`;
      const dd = document.createElement('dd');
      dd.textContent = `${author.name} — ${author.institution} — ${author.email}`;
      row.append(dt, dd);
      authorsContainer.appendChild(row);
    });
  }

  const vatRow = document.getElementById('p-row-vatNumber');
  vatRow.hidden = !data.vatNumber;
  if (data.vatNumber) {
    document.getElementById('p-vatNumber').textContent = data.vatNumber;
  }
}

let authorCount = 0;

function addAuthorEntry() {
  const idx     = ++authorCount;
  const nameId  = `author-${idx}-name`;
  const instId  = `author-${idx}-institution`;
  const emailId = `author-${idx}-email`;

  const entry = document.createElement('div');
  entry.className = 'author-entry';
  entry.innerHTML = `
    <div class="author-entry__header">
      <span class="author-entry__label">Author <span class="author-num">${idx}</span></span>
      <button type="button" class="btn-remove-author">Remove</button>
    </div>
    <div class="field-row">
      <div class="text-field">
        <input id="${nameId}" type="text" placeholder=" " data-author="name">
        <label for="${nameId}">Name</label>
      </div>
    </div>
    <div class="field-row field-row--two">
      <div class="text-field">
        <input id="${instId}" type="text" placeholder=" " data-author="institution">
        <label for="${instId}">Institution</label>
      </div>
      <div class="text-field">
        <input id="${emailId}" type="email" placeholder=" " data-author="email">
        <label for="${emailId}">Email</label>
      </div>
    </div>
  `;

  entry.querySelector('.btn-remove-author').addEventListener('click', () => {
    entry.remove();
    renumberAuthors();
  });

  authorsList.appendChild(entry);
  renumberAuthors();
}

function renumberAuthors() {
  authorsList.querySelectorAll('.author-num').forEach((el, i) => {
    el.textContent = i + 1;
  });
}

function getAuthors() {
  return Array.from(authorsList.querySelectorAll('.author-entry')).map(entry => ({
    name:        entry.querySelector('[data-author="name"]').value.trim(),
    institution: entry.querySelector('[data-author="institution"]').value.trim(),
    email:       entry.querySelector('[data-author="email"]').value.trim(),
  }));
}

// Module scripts are always deferred — DOM is ready when this runs.
let paperFile = null;

const form          = document.getElementById('registrationForm');
const authorSection = document.getElementById('authorSection');
const authorsList   = document.getElementById('authorsList');
const paperBtn      = document.getElementById('paperBtn');
const paperInput    = document.getElementById('paperInput');
const paperNameEl   = document.getElementById('paperName');
const paperError    = document.getElementById('paperError');
const feeDisplay    = document.getElementById('feeDisplay');
const feeAmount     = document.getElementById('feeAmount');
const feePeriod     = document.getElementById('feePeriod');
const bankInfo      = document.getElementById('bankInfo');
const paypalInfo    = document.getElementById('paypalInfo');
const submitBtn     = document.getElementById('submitBtn');
const formErrors    = document.getElementById('formErrors');
const successPanel  = document.getElementById('successPanel');
const submissionId  = document.getElementById('submissionId');
const savePdfBtn    = document.getElementById('savePdfBtn');

savePdfBtn.addEventListener('click', () => window.print());

document.getElementById('addAuthorBtn').addEventListener('click', addAuthorEntry);

// Author section toggle
document.querySelectorAll('input[type="radio"][name="isAuthor"]').forEach(radio => {
  radio.addEventListener('change', () => {
    const isAuthor = getRadioValue('isAuthor') === 'yes';
    authorSection.hidden = !isAuthor;
    if (!isAuthor) {
      paperFile = null;
      paperNameEl.textContent = 'No file selected';
      paperInput.value = '';
      paperError.hidden = true;
      authorsList.innerHTML = '';
    }
  });
});

// File upload
paperBtn.addEventListener('click', () => paperInput.click());

paperInput.addEventListener('change', () => {
  const file = paperInput.files[0];
  if (!file) return;

  const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || file.name.toLowerCase().endsWith('.docx');
  const underLimit = file.size <= 20 * 1024 * 1024;

  if (!isDocx) {
    showPaperError('Please upload a DOCX file.');
  } else if (!underLimit) {
    showPaperError('File must be under 20 MB.');
  } else {
    paperError.hidden = true;
    paperFile = file;
    paperNameEl.textContent = file.name;
  }

  if (!isDocx || !underLimit) {
    paperFile = null;
    paperNameEl.textContent = 'No file selected';
    paperInput.value = '';
  }
});

// Fee display
document.querySelectorAll('input[type="radio"][name="registrationType"]').forEach(radio => {
  radio.addEventListener('change', updateFee);
});

// Payment method info toggle
document.querySelectorAll('input[type="radio"][name="paymentMethod"]').forEach(radio => {
  radio.addEventListener('change', () => {
    const val = getRadioValue('paymentMethod');
    bankInfo.hidden   = val !== 'bank_transfer';
    paypalInfo.hidden = val !== 'paypal';
  });
});

// Form submission
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const data = {
    name:               getFieldValue('name'),
    institution:        getFieldValue('institution'),
    address:            getFieldValue('address'),
    countryCity:        getFieldValue('countryCity'),
    email:              getFieldValue('email'),
    phone:              getFieldValue('phone'),
    academicDegree:     getFieldValue('academicDegree'),
    isAuthor:           getRadioValue('isAuthor') === 'yes',
    paperTitle:         getFieldValue('paperTitle'),
    authors:            getRadioValue('isAuthor') === 'yes' ? getAuthors() : [],
    presentationFormat: getRadioValue('presentationFormat'),
    registrationType:   getRadioValue('registrationType'),
    registrationPeriod: getRegistrationPeriod(),
    paymentMethod:      getRadioValue('paymentMethod'),
    invoiceName:        getFieldValue('invoiceName'),
    vatNumber:          getFieldValue('vatNumber'),
    invoiceAddress:     getFieldValue('invoiceAddress'),
    invoiceCountryCity: getFieldValue('invoiceCountryCity'),
  };

  const errors = validateForm(data, data.isAuthor ? paperFile : null);

  if (errors.length > 0) {
    formErrors.textContent = errors.join('\n');
    formErrors.hidden = false;
    formErrors.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  formErrors.hidden = true;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting…';

  try {
    if (data.isAuthor && paperFile) {
      data.paper = {
        filename: paperFile.name,
        mimeType: paperFile.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        data: await fileToBase64(paperFile),
      };
    }

    const result = await submitRegistration(data);

    if (result.success) {
      populatePrintSummary(data, result.applicationId ?? '—');
      form.hidden = true;
      submissionId.textContent = result.applicationId ?? '—';
      successPanel.hidden = false;
      successPanel.scrollIntoView({ behavior: 'smooth' });
    } else {
      showFormError(result.error || 'Submission failed. Please try again.');
      resetSubmitBtn();
    }
  } catch (err) {
    showFormError('An error occurred. Please check your connection and try again.');
    resetSubmitBtn();
  }
});

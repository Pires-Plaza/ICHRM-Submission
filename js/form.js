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

// Module scripts are always deferred — DOM is ready when this runs.
let paperFile = null;

const form          = document.getElementById('registrationForm');
const authorSection = document.getElementById('authorSection');
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

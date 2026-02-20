import type { FormRow } from '../infrastructure/repositories/form-repository.js';

export interface FormFieldDef {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
  };
  options?: Array<{ label: string; value: string }>;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/**
 * Validate a form submission against the form field definitions.
 */
export function validateSubmission(
  form: FormRow,
  data: Record<string, unknown>,
): ValidationResult {
  const errors: Record<string, string> = {};
  const fields = (form.fields ?? []) as FormFieldDef[];

  for (const field of fields) {
    const value = data[field.name];
    const strValue = value != null ? String(value) : '';

    // Required check
    if (field.required && (!value || strValue.trim() === '')) {
      errors[field.name] = `${field.label} is required`;
      continue;
    }

    // Skip further validation if value is empty and not required
    if (!value || strValue.trim() === '') continue;

    // Type-specific validation
    if (field.type === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(strValue)) {
        errors[field.name] = `${field.label} must be a valid email`;
      }
    }

    if (field.type === 'number') {
      const num = Number(strValue);
      if (Number.isNaN(num)) {
        errors[field.name] = `${field.label} must be a number`;
      }
    }

    if (field.type === 'tel') {
      const phoneRegex = /^[+]?[\d\s\-()]+$/;
      if (!phoneRegex.test(strValue)) {
        errors[field.name] = `${field.label} must be a valid phone number`;
      }
    }

    // Pattern validation
    if (field.validation?.pattern) {
      const regex = new RegExp(field.validation.pattern);
      if (!regex.test(strValue)) {
        errors[field.name] = `${field.label} format is invalid`;
      }
    }

    // Length validation
    if (
      field.validation?.minLength &&
      strValue.length < field.validation.minLength
    ) {
      errors[field.name] =
        `${field.label} must be at least ${field.validation.minLength} characters`;
    }
    if (
      field.validation?.maxLength &&
      strValue.length > field.validation.maxLength
    ) {
      errors[field.name] =
        `${field.label} must be at most ${field.validation.maxLength} characters`;
    }

    // Number range validation
    if (field.type === 'number') {
      const num = Number(strValue);
      if (!Number.isNaN(num)) {
        if (field.validation?.min !== undefined && num < field.validation.min) {
          errors[field.name] =
            `${field.label} must be at least ${field.validation.min}`;
        }
        if (field.validation?.max !== undefined && num > field.validation.max) {
          errors[field.name] =
            `${field.label} must be at most ${field.validation.max}`;
        }
      }
    }

    // Select/radio option validation
    if ((field.type === 'select' || field.type === 'radio') && field.options) {
      const validValues = field.options.map((o) => o.value);
      if (!validValues.includes(strValue)) {
        errors[field.name] = `${field.label} has an invalid selection`;
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Render a form as an HTML fragment for embedding.
 */
export function renderFormHtml(form: FormRow): string {
  const fields = (form.fields ?? []) as FormFieldDef[];

  const fieldHtml = fields
    .map((field) => {
      const required = field.required ? 'required' : '';
      const requiredMark = field.required
        ? ' <span class="text-red-500">*</span>'
        : '';

      switch (field.type) {
        case 'textarea':
          return `<div class="mb-4">
  <label class="block text-sm font-medium text-gray-700 mb-1">${field.label}${requiredMark}</label>
  <textarea name="${field.name}" placeholder="${field.validation?.minLength ? `Min ${field.validation.minLength} chars` : ''}" class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" ${required}></textarea>
</div>`;

        case 'select': {
          const options = (field.options ?? [])
            .map((o) => `<option value="${o.value}">${o.label}</option>`)
            .join('\n    ');
          return `<div class="mb-4">
  <label class="block text-sm font-medium text-gray-700 mb-1">${field.label}${requiredMark}</label>
  <select name="${field.name}" class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" ${required}>
    <option value="">Select...</option>
    ${options}
  </select>
</div>`;
        }

        case 'checkbox':
          return `<div class="mb-4 flex items-center gap-2">
  <input type="checkbox" name="${field.name}" id="field-${field.name}" class="rounded border-gray-300" ${required} />
  <label for="field-${field.name}" class="text-sm font-medium text-gray-700">${field.label}${requiredMark}</label>
</div>`;

        case 'radio': {
          const radioOptions = (field.options ?? [])
            .map(
              (o) =>
                `<label class="flex items-center gap-2"><input type="radio" name="${field.name}" value="${o.value}" class="border-gray-300" ${required} /> ${o.label}</label>`,
            )
            .join('\n    ');
          return `<div class="mb-4">
  <label class="block text-sm font-medium text-gray-700 mb-1">${field.label}${requiredMark}</label>
  <div class="space-y-1">
    ${radioOptions}
  </div>
</div>`;
        }

        case 'hidden':
          return `<input type="hidden" name="${field.name}" value="" />`;

        default:
          return `<div class="mb-4">
  <label class="block text-sm font-medium text-gray-700 mb-1">${field.label}${requiredMark}</label>
  <input type="${field.type}" name="${field.name}" placeholder="${field.label}" class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" ${required} />
</div>`;
      }
    })
    .join('\n');

  return `<form method="POST" action="/api/v1/content/forms/${form.id}/submit" class="max-w-lg mx-auto p-6">
  <h2 class="text-xl font-bold mb-4">${form.name}</h2>
  ${form.description ? `<p class="text-gray-600 mb-6">${form.description}</p>` : ''}
  ${fieldHtml}
  <button type="submit" class="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
    Submit
  </button>
</form>`;
}

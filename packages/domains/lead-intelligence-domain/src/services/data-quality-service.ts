import {
  calculateDataQuality,
  type DataQualityScore,
} from '../entities/data-quality-score.js';

export interface ContactForQuality {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  company?: string | null;
  title?: string | null;
  lastEnrichedAt?: Date | null;
}

export class DataQualityService {
  assess(contact: ContactForQuality): DataQualityScore {
    return calculateDataQuality(contact);
  }
}

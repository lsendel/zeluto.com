import { promises as dns } from 'node:dns';
import pino from 'pino';

const logger = pino({ name: 'dns-verifier' });

export interface DnsVerificationResult {
  mx: boolean;
  spf: boolean;
  dkim: boolean;
  dmarc: boolean;
  details: {
    mx: { found: boolean; records: string[]; error?: string };
    spf: { found: boolean; record?: string; error?: string };
    dkim: {
      found: boolean;
      record?: string;
      selector?: string;
      error?: string;
    };
    dmarc: { found: boolean; record?: string; error?: string };
  };
}

export class DnsVerifier {
  private dkimSelector: string;

  constructor(dkimSelector = 'mail') {
    this.dkimSelector = dkimSelector;
  }

  /**
   * Verify all DNS records for a sending domain.
   */
  async verifyAll(domain: string): Promise<DnsVerificationResult> {
    const [mx, spf, dkim, dmarc] = await Promise.all([
      this.checkMx(domain),
      this.checkSpf(domain),
      this.checkDkim(domain),
      this.checkDmarc(domain),
    ]);

    const result: DnsVerificationResult = {
      mx: mx.found,
      spf: spf.found,
      dkim: dkim.found,
      dmarc: dmarc.found,
      details: { mx, spf, dkim, dmarc },
    };

    logger.info(
      {
        domain,
        mx: mx.found,
        spf: spf.found,
        dkim: dkim.found,
        dmarc: dmarc.found,
      },
      'DNS verification complete',
    );

    return result;
  }

  /**
   * Check MX records for the domain.
   * Verifies that at least one MX record exists.
   */
  async checkMx(
    domain: string,
  ): Promise<{ found: boolean; records: string[]; error?: string }> {
    try {
      const mxRecords = await dns.resolveMx(domain);
      const records = mxRecords
        .sort((a, b) => a.priority - b.priority)
        .map((r) => `${r.priority} ${r.exchange}`);

      return { found: records.length > 0, records };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn({ domain, error: message }, 'MX lookup failed');
      return { found: false, records: [], error: message };
    }
  }

  /**
   * Check SPF record for the domain.
   * Looks for a TXT record starting with "v=spf1".
   */
  async checkSpf(
    domain: string,
  ): Promise<{ found: boolean; record?: string; error?: string }> {
    try {
      const txtRecords = await dns.resolveTxt(domain);
      const flat = txtRecords.map((parts) => parts.join(''));

      const spfRecord = flat.find((r) => r.startsWith('v=spf1'));
      if (spfRecord) {
        return { found: true, record: spfRecord };
      }

      return { found: false, error: 'No SPF record found' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn({ domain, error: message }, 'SPF lookup failed');
      return { found: false, error: message };
    }
  }

  /**
   * Check DKIM record for the domain.
   * Looks for a TXT record at {selector}._domainkey.{domain}.
   */
  async checkDkim(
    domain: string,
    selector?: string,
  ): Promise<{
    found: boolean;
    record?: string;
    selector?: string;
    error?: string;
  }> {
    const sel = selector ?? this.dkimSelector;
    const dkimDomain = `${sel}._domainkey.${domain}`;

    try {
      const txtRecords = await dns.resolveTxt(dkimDomain);
      const flat = txtRecords.map((parts) => parts.join(''));

      const dkimRecord = flat.find((r) => r.includes('v=DKIM1'));
      if (dkimRecord) {
        return { found: true, record: dkimRecord, selector: sel };
      }

      return { found: false, selector: sel, error: 'No DKIM record found' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn({ domain: dkimDomain, error: message }, 'DKIM lookup failed');
      return { found: false, selector: sel, error: message };
    }
  }

  /**
   * Check DMARC record for the domain.
   * Looks for a TXT record at _dmarc.{domain} starting with "v=DMARC1".
   */
  async checkDmarc(
    domain: string,
  ): Promise<{ found: boolean; record?: string; error?: string }> {
    const dmarcDomain = `_dmarc.${domain}`;

    try {
      const txtRecords = await dns.resolveTxt(dmarcDomain);
      const flat = txtRecords.map((parts) => parts.join(''));

      const dmarcRecord = flat.find((r) => r.startsWith('v=DMARC1'));
      if (dmarcRecord) {
        return { found: true, record: dmarcRecord };
      }

      return { found: false, error: 'No DMARC record found' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(
        { domain: dmarcDomain, error: message },
        'DMARC lookup failed',
      );
      return { found: false, error: message };
    }
  }
}

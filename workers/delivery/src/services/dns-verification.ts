export interface VerifiableDnsRecord {
  type: string;
  name: string;
  value: string;
  verified: boolean;
}

interface DnsJsonAnswer {
  data?: string;
}

interface DnsJsonResponse {
  Answer?: DnsJsonAnswer[];
}

const DNS_OVER_HTTPS_ENDPOINT = 'https://cloudflare-dns.com/dns-query';

export async function verifyDnsRecords(
  records: VerifiableDnsRecord[],
): Promise<VerifiableDnsRecord[]> {
  const verifiedRecords: VerifiableDnsRecord[] = [];

  for (const record of records) {
    try {
      const exists = await verifySingleRecord(record);
      verifiedRecords.push({ ...record, verified: exists });
    } catch (error) {
      console.error(
        {
          name: record.name,
          type: record.type,
          error,
        },
        'DNS verification lookup failed',
      );
      verifiedRecords.push({ ...record, verified: false });
    }
  }

  return verifiedRecords;
}

async function verifySingleRecord(
  record: VerifiableDnsRecord,
): Promise<boolean> {
  const type = record.type.toUpperCase();
  if (type !== 'TXT' && type !== 'CNAME') {
    return false;
  }

  const answers = await queryDns(record.name, type);

  if (type === 'TXT') {
    const expected = normalizeTxt(record.value);
    return answers.some((answer) => normalizeTxt(answer) === expected);
  }

  const expected = normalizeDomain(record.value);
  return answers.some((answer) => normalizeDomain(answer) === expected);
}

async function queryDns(
  name: string,
  type: 'TXT' | 'CNAME',
): Promise<string[]> {
  const url = new URL(DNS_OVER_HTTPS_ENDPOINT);
  url.searchParams.set('name', name);
  url.searchParams.set('type', type);

  const response = await fetch(url.toString(), {
    headers: {
      accept: 'application/dns-json',
    },
  });

  if (!response.ok) {
    throw new Error(`DNS query failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as DnsJsonResponse;
  return (payload.Answer ?? [])
    .map((answer) => answer.data)
    .filter((value): value is string => typeof value === 'string');
}

function normalizeTxt(value: string): string {
  return value
    .trim()
    .replace(/^"+|"+$/g, '')
    .replace(/\\"/g, '"');
}

function normalizeDomain(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, '');
}

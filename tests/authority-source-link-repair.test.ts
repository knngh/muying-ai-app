import { repairAuthoritySourceLinks } from '../src/utils/authority-source-link-repair';

describe('authority source link repair', () => {
  test('copies existing source_url into missing url and original_id fields', () => {
    const result = repairAuthoritySourceLinks([
      {
        id: 'authority-a',
        source_id: 'aap',
        question: 'Baby feeding',
        source_url: 'https://www.healthychildren.org/example',
      },
    ]);

    expect(result.repaired).toBe(1);
    expect(result.records[0]).toEqual(expect.objectContaining({
      source_url: 'https://www.healthychildren.org/example',
      url: 'https://www.healthychildren.org/example',
      original_id: 'https://www.healthychildren.org/example',
    }));
    expect(result.repairedEntries[0]?.repairedFields).toEqual(['url', 'original_id']);
  });

  test('restores source_url from url without changing a complete record', () => {
    const result = repairAuthoritySourceLinks([
      {
        id: 'authority-a',
        source_url: '',
        url: 'https://www.cdc.gov/parents/infants/index.html',
        original_id: 'https://www.cdc.gov/parents/infants/index.html',
      },
      {
        id: 'authority-b',
        source_url: 'https://www.nhs.uk/pregnancy/',
        url: 'https://www.nhs.uk/pregnancy/',
        original_id: 'https://www.nhs.uk/pregnancy/',
      },
    ]);

    expect(result.repaired).toBe(1);
    expect(result.alreadyComplete).toBe(1);
    expect(result.records[0]?.source_url).toBe('https://www.cdc.gov/parents/infants/index.html');
    expect(result.records[1]?.source_url).toBe('https://www.nhs.uk/pregnancy/');
  });

  test('reports unrecoverable records when no http link exists', () => {
    const result = repairAuthoritySourceLinks([
      {
        id: 'authority-a',
        source_id: 'legacy',
        question: 'Legacy article',
        original_id: '12345',
      },
    ]);

    expect(result.repaired).toBe(0);
    expect(result.unrecoverable).toEqual([
      expect.objectContaining({
        id: 'authority-a',
        sourceId: 'legacy',
        question: 'Legacy article',
      }),
    ]);
  });
});

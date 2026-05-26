import { __vectorServiceTestUtils, buildAuthorityVectorId } from '../src/services/vector.service';

describe('vector service Milvus response guards', () => {
  it('builds stable authority vector ids from source URLs', () => {
    expect(buildAuthorityVectorId('https://example.com/a')).toBe('authority-1716875424');
    expect(buildAuthorityVectorId('https://www.cdc.gov/parents/infants/index.html')).toBe('authority-260372670');
  });

  it('throws when Milvus returns a non-success status', () => {
    expect(() => __vectorServiceTestUtils.assertMilvusSuccess('Vector insert batch', {
      status: {
        error_code: 'UnexpectedError',
        reason: 'insert failed',
        code: 1,
      },
    })).toThrow('Vector insert batch failed: UnexpectedError - insert failed');
  });

  it('requires a Milvus status for mutation responses', () => {
    expect(() => __vectorServiceTestUtils.assertMilvusSuccess('Vector insert batch', {}, true))
      .toThrow('Vector insert batch did not return a Milvus status');
  });

  it('parses mutation insert counts without falling back on failed responses', () => {
    expect(__vectorServiceTestUtils.getMutationInsertCount({ insert_cnt: '12' }, 50)).toBe(12);
    expect(__vectorServiceTestUtils.getMutationInsertCount({ succ_index: [0, 1, 2] }, 50)).toBe(3);
    expect(__vectorServiceTestUtils.getMutationInsertCount({ acknowledged: true }, 50)).toBe(50);
    expect(__vectorServiceTestUtils.getMutationInsertCount({}, 50)).toBeNull();
  });

  it('deduplicates vector documents by primary key before upsert', () => {
    const result = __vectorServiceTestUtils.dedupeVectorDocumentsById([
      { id: 'authority-1', question: 'first' },
      { id: 'authority-2', question: 'second' },
      { id: 'authority-1', question: 'duplicate' },
    ]);

    expect(result).toEqual([
      { id: 'authority-1', question: 'first' },
      { id: 'authority-2', question: 'second' },
    ]);
  });

  it('builds Milvus 2.6 compatible vector search requests with an explicit limit', () => {
    const request = __vectorServiceTestUtils.buildVectorSearchRequest([0.1, 0.2, 0.3], 7);

    expect(request).toMatchObject({
      data: [0.1, 0.2, 0.3],
      limit: 7,
      anns_field: 'embedding',
      params: {
        nprobe: 10,
      },
      output_fields: ['id', 'question', 'answer', 'category', 'source'],
    });
    expect(request).not.toHaveProperty('top_k');
    expect(request).not.toHaveProperty('vector');
  });
});

import {
  parseAuthoritySourceIdList,
  selectAuthoritySourcesForRefresh,
} from '../src/utils/authority-source-refresh';

describe('authority source refresh planning', () => {
  it('parses unique comma-separated source ids', () => {
    expect(parseAuthoritySourceIdList(' mayo-clinic-zh,chinacdc-nutrition,mayo-clinic-zh ,, ')).toEqual([
      'mayo-clinic-zh',
      'chinacdc-nutrition',
    ]);
  });

  it('selects only missing and low watched sources by default', () => {
    const selected = selectAuthoritySourcesForRefresh({
      sourceCoverage: {
        watchedSources: [
          { sourceId: 'mayo-clinic-zh', count: 0, minimumPublishedRecords: 10, status: 'missing' },
          { sourceId: 'chinacdc-nutrition', count: 2, minimumPublishedRecords: 10, status: 'low' },
          { sourceId: 'aap', count: 146, minimumPublishedRecords: 10, status: 'healthy' },
        ],
      },
    });

    expect(selected).toEqual([
      { sourceId: 'mayo-clinic-zh', count: 0, minimumPublishedRecords: 10, status: 'missing' },
      { sourceId: 'chinacdc-nutrition', count: 2, minimumPublishedRecords: 10, status: 'low' },
    ]);
  });

  it('supports explicit source filters and refresh limits', () => {
    const selected = selectAuthoritySourcesForRefresh({
      sourceCoverage: {
        watchedSources: [
          { sourceId: 'mayo-clinic-zh', count: 0, minimumPublishedRecords: 10, status: 'missing' },
          { sourceId: 'chinacdc-nutrition', count: 2, minimumPublishedRecords: 10, status: 'low' },
          { sourceId: 'msd-manuals-cn', count: 3, minimumPublishedRecords: 10, status: 'low' },
        ],
      },
    }, {
      sourceIds: ['chinacdc-nutrition', 'msd-manuals-cn'],
      limit: 1,
    });

    expect(selected).toEqual([
      { sourceId: 'chinacdc-nutrition', count: 2, minimumPublishedRecords: 10, status: 'low' },
    ]);
  });
});

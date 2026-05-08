import {
  buildAuthoritySourceDryRunSummaries,
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

  it('keeps dry-run summaries cheap unless discovery probing is enabled', async () => {
    const discover = jest.fn();

    const summaries = await buildAuthoritySourceDryRunSummaries([
      { sourceId: 'mayo-clinic-zh', count: 0, minimumPublishedRecords: 10, status: 'missing' },
    ], {
      probeDiscovery: false,
      discover,
    });

    expect(discover).not.toHaveBeenCalled();
    expect(summaries).toEqual([
      {
        sourceId: 'mayo-clinic-zh',
        skipped: true,
        reason: 'dry_run',
      },
    ]);
  });

  it('adds bounded discovery probe samples to dry-run summaries', async () => {
    const discover = jest.fn().mockResolvedValue([
      { url: 'https://www.mayoclinic.org/zh-hans/healthy-lifestyle/infant-and-toddler-health/expert-answers/newborn/faq-20057752' },
      { url: 'https://www.mayoclinic.org/zh-hans/healthy-lifestyle/pregnancy-week-by-week/expert-answers/vaping-during-pregnancy/faq-20462062' },
      { url: 'https://www.mayoclinic.org/zh-hans/diseases-conditions/atopic-dermatitis-eczema/expert-answers/baby-eczema/faq-20450999' },
    ]);

    const summaries = await buildAuthoritySourceDryRunSummaries([
      { sourceId: 'mayo-clinic-zh', count: 0, minimumPublishedRecords: 10, status: 'missing' },
    ], {
      probeDiscovery: true,
      sampleLimit: 2,
      discover,
    });

    expect(discover).toHaveBeenCalledWith('mayo-clinic-zh');
    expect(summaries).toEqual([
      {
        sourceId: 'mayo-clinic-zh',
        skipped: true,
        reason: 'dry_run',
        discoveryProbe: {
          ok: true,
          discovered: 3,
          sampleUrls: [
            'https://www.mayoclinic.org/zh-hans/healthy-lifestyle/infant-and-toddler-health/expert-answers/newborn/faq-20057752',
            'https://www.mayoclinic.org/zh-hans/healthy-lifestyle/pregnancy-week-by-week/expert-answers/vaping-during-pregnancy/faq-20462062',
          ],
        },
      },
    ]);
  });

  it('adds entry-level discovery diagnostics when the dry-run probe provides them', async () => {
    const diagnoseDiscovery = jest.fn().mockResolvedValue({
      discovered: [
        { url: 'https://www.mayoclinic.org/zh-hans/healthy-lifestyle/infant-and-toddler-health/in-depth/baby-poop/art-20043980' },
      ],
      entryDiagnostics: [
        {
          entryUrl: 'https://www.mayoclinic.org/chinese_patient_consumer_faq.xml',
          ok: true,
          status: 200,
          contentType: 'application/xml',
          locCount: 500,
          matchedCandidateCount: 1,
          sampleMatchedUrls: [
            'https://www.mayoclinic.org/zh-hans/healthy-lifestyle/infant-and-toddler-health/in-depth/baby-poop/art-20043980',
          ],
        },
      ],
    });

    const summaries = await buildAuthoritySourceDryRunSummaries([
      { sourceId: 'mayo-clinic-zh', count: 0, minimumPublishedRecords: 10, status: 'missing' },
    ], {
      probeDiscovery: true,
      sampleLimit: 1,
      diagnoseDiscovery,
    });

    expect(diagnoseDiscovery).toHaveBeenCalledWith('mayo-clinic-zh');
    expect(summaries).toEqual([
      {
        sourceId: 'mayo-clinic-zh',
        skipped: true,
        reason: 'dry_run',
        discoveryProbe: {
          ok: true,
          discovered: 1,
          sampleUrls: [
            'https://www.mayoclinic.org/zh-hans/healthy-lifestyle/infant-and-toddler-health/in-depth/baby-poop/art-20043980',
          ],
          entryDiagnostics: [
            {
              entryUrl: 'https://www.mayoclinic.org/chinese_patient_consumer_faq.xml',
              ok: true,
              status: 200,
              contentType: 'application/xml',
              locCount: 500,
              matchedCandidateCount: 1,
              sampleMatchedUrls: [
                'https://www.mayoclinic.org/zh-hans/healthy-lifestyle/infant-and-toddler-health/in-depth/baby-poop/art-20043980',
              ],
            },
          ],
        },
      },
    ]);
  });

  it('records discovery probe failures without failing the dry-run summary', async () => {
    const discover = jest.fn().mockRejectedValue(new Error('upstream timeout'));

    const summaries = await buildAuthoritySourceDryRunSummaries([
      { sourceId: 'chinacdc-nutrition', count: 0, minimumPublishedRecords: 10, status: 'missing' },
    ], {
      probeDiscovery: true,
      discover,
    });

    expect(summaries).toEqual([
      {
        sourceId: 'chinacdc-nutrition',
        skipped: true,
        reason: 'dry_run',
        discoveryProbe: {
          ok: false,
          discovered: 0,
          sampleUrls: [],
          error: 'upstream timeout',
        },
      },
    ]);
  });
});

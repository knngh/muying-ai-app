declare module '@zilliz/milvus2-sdk-node' {
  export class MilvusClient {
    connectPromise: Promise<void>;
    constructor(config: {
      address: string;
      token?: string;
      ssl?: boolean;
      timeout?: number;
    });
    hasCollection(params: { collection_name: string }): Promise<{ value: boolean }>;
    createCollection(params: Record<string, unknown>): Promise<unknown>;
    createIndex(params: Record<string, unknown>): Promise<unknown>;
    loadCollectionSync(params: { collection_name: string }): Promise<unknown>;
    insert(params: Record<string, unknown>): Promise<unknown>;
    delete(params: Record<string, unknown>): Promise<unknown>;
    flushSync(params: { collection_names: string[] }): Promise<unknown>;
    search(params: Record<string, unknown>): Promise<{ results: Array<Record<string, unknown>> }>;
  }
}

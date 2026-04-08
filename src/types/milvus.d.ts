declare module '@zilliz/milvus2-sdk-node' {
  export class MilvusClient {
    constructor(config: { address: string; timeout?: number });
    hasCollection(params: { collection_name: string }): Promise<{ value: boolean }>;
    createCollection(params: any): Promise<any>;
    createIndex(params: any): Promise<any>;
    loadCollectionSync(params: { collection_name: string }): Promise<any>;
    insert(params: any): Promise<any>;
    delete(params: any): Promise<any>;
    search(params: any): Promise<{ results: any[] }>;
  }
}

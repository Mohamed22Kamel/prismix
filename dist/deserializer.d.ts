import { DataSource, DMMF, GeneratorConfig } from '@prisma/generator-helper/dist';
import { Model } from './dmmf-extension';
export declare function deserializeModels(models: Model[]): Promise<string>;
export declare function deserializeDatasources(datasources: DataSource[]): Promise<string>;
export declare function deserializeGenerators(generators: GeneratorConfig[]): Promise<string>;
export declare function deserializeEnums(enums: DMMF.DatamodelEnum[]): Promise<string>;

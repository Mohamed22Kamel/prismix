import fs from 'fs';
import { promisify } from 'util';
import path from 'path';
import { getDMMF, getConfig } from '@prisma/internals';
import {
  deserializeEnums,
  deserializeDatasources,
  deserializeModels,
  deserializeGenerators
} from './deserializer';
import { DataSource, DMMF, GeneratorConfig } from '@prisma/generator-helper';
import { globSync } from 'glob';
import { CustomAttributes, Field, Model } from './dmmf-extension';
import { containsObject } from './utils';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

export interface MixerOptions {
  input: string[];
  output: string;
}

export interface PrismixOptions {
  mixers: MixerOptions[];
}

type UnPromisify<T> = T extends Promise<infer U> ? U : T;

type Schema = NonNullable<UnPromisify<ReturnType<typeof getSchema>>>;

async function getSchema(schemaPath: string) {
  try {
    const schema = await readFile(path.join(process.cwd(), schemaPath), {
      encoding: 'utf-8'
    });

    const dmmf = await getDMMF({ datamodel: schema });
    const customAttributes = getCustomAttributes(schema);
    const models = dmmf.datamodel.models.map((model) => ({
      ...model,
      doubleAtIndexes: customAttributes[model.name]?.doubleAtIndexes,
      fields: model.fields.map((field) =>
        // Inject columnName and db.Type from the parsed fieldMappings above
        {
          const attributes = customAttributes[model.name]?.fields[field.name] ?? {};

          return {
            ...field,
            columnName: attributes.columnName,
            dbType: attributes.dbType,
            relationOnUpdate: attributes.relationOnUpdate,
            map: attributes.map
          };
        }
      )
    }));
    const config = await getConfig({ datamodel: schema });

    return {
      models,
      enums: dmmf.datamodel.enums,
      datasources: config.datasources,
      generators: config.generators
    };
  } catch (e) {
    console.error(
      `Prismix failed to parse schema located at "${schemaPath}". Did you attempt to reference to a model without creating an alias? Remember you must define a "blank" alias model with only the "@id" field in your extended schemas otherwise we can't parse your schema.`,
      e
    );
  }
}

function mixModels(inputModels: Model[]) {
  const models: Record<string, Model> = {};
  for (const newModel of inputModels) {
    const existingModel: Mutable<Model> | null = models[newModel.name];
    // if the model already exists in our found models, merge the fields
    if (existingModel) {
      const existingFieldNames = existingModel.fields.map((f) => f.name);
      for (const newField of newModel.fields) {
        const mutableField: Mutable<Field> = newField;
        // if this field exists in the existing model
        if (existingFieldNames.includes(mutableField.name)) {
          const existingFieldIndex: number = existingFieldNames.indexOf(mutableField.name);

          // Assign columnName (@map) based on existing field if found
          const existingField: Field = existingModel.fields[existingFieldIndex];
          if (!mutableField.columnName && existingField.columnName) {
            mutableField.columnName = existingField.columnName;
          }

          // Assign defaults based on existing field if found
          if (!mutableField.hasDefaultValue && existingField.hasDefaultValue) {
            mutableField.hasDefaultValue = true;
            mutableField.default = existingField.default;
          }

          // replace the field at this index with the new one
          existingModel.fields[existingFieldIndex] = mutableField;
        } else {
          // if it doesn't already exist, append to field list
          existingModel.fields.push(mutableField);
        }
      }
      // Assign dbName (@@map) based on new model if found
      if (!existingModel.dbName && newModel.dbName) {
        existingModel.dbName = newModel.dbName;
      }

      // Merge doubleAtIndexes (@@index) based on new model if found
      if (newModel.doubleAtIndexes?.length) {
        existingModel.doubleAtIndexes = [
          ...(existingModel.doubleAtIndexes ?? []),
          ...newModel.doubleAtIndexes
        ];
      }

      // Merge unique indexes (@@unique) based on new model if found
      if (newModel.uniqueIndexes?.length) {
        for (const index of newModel.uniqueIndexes) {
          if (containsObject(index, (existingModel.uniqueIndexes as unknown as Object[]) ?? [])) {
            console.log('adding index', index);
            existingModel.uniqueIndexes = [...(existingModel.uniqueIndexes ?? []), index];
          }
        }
        existingModel.uniqueFields = [
          ...(existingModel.uniqueFields ?? []),
          ...newModel.uniqueFields
        ];
      }
    } else {
      models[newModel.name] = newModel;
    }
  }
  return Object.values(models);
}

// Extract @map attributes, which aren't accessible from the prisma SDK
// Adapted from https://github.com/sabinadams/aurora/commit/acb020d868f2ba16b114cf084b959b65d0294a73#diff-8f1b0a136f29e1af67b019f53772aa2e80bf4d24e2c8b844cfa993d8cc9df789
function getCustomAttributes(datamodel: string) {
  // Split the schema up by the ending of each block and then keep each starting with 'model'
  // This should essentially give us an array of the model blocks
  const modelChunks = datamodel.split('\n}');
  return modelChunks.reduce(
    (modelDefinitions: Record<string, CustomAttributes>, modelChunk: string) => {
      // Split the model chunk by line to get the individual fields
      let pieces = modelChunk.split('\n').filter((chunk) => chunk.trim().length);
      // Pull out model name
      const modelName = pieces.find((name) => name.match(/model (.*) {/))?.split(' ')[1];
      if (!modelName) return modelDefinitions;
      // Regex for getting our @map attribute
      const mapRegex = new RegExp(/[^@]@map\("(?<name>.*)"\)/);
      const dbRegex = new RegExp(/@db\.(?<type>[^\s()]+(?:\([^)]+\))?)/g);
      const relationOnUpdateRegex = new RegExp(
        /onUpdate: (?<op>Cascade|NoAction|Restrict|SetDefault|SetNull)/
      );
      const relationMapRegex = new RegExp(/map: "(.*?)"/);
      const doubleAtIndexRegex = new RegExp(/(?<index>@@index\(.*\))/);
      const doubleAtIndexes = pieces
        .reduce((ac: string[], field) => {
          const item = field.match(doubleAtIndexRegex)?.groups?.index;
          return item ? [...ac, item] : ac;
        }, [])
        .filter((f) => f);
      const fieldsWithCustomAttributes = pieces
        .map((field) => {
          const columnName = field.match(mapRegex)?.groups?.name;
          const dbType = field.match(dbRegex)?.at(0);
          const relationOnUpdate = field.match(relationOnUpdateRegex)?.groups?.op;
          const map = field.match(relationMapRegex)?.groups?.op;
          return [field.trim().split(' ')[0], { columnName, dbType, relationOnUpdate, map }] as [
            string,
            CustomAttributes['fields'][0]
          ];
        })
        .filter((f) => f[1]?.columnName || f[1]?.dbType || f[1]?.relationOnUpdate || f[1]?.map);

      return {
        ...modelDefinitions,
        [modelName]: { fields: Object.fromEntries(fieldsWithCustomAttributes), doubleAtIndexes }
      };
    },
    {}
  );
}

export async function prismix(options: PrismixOptions) {
  for (const mixer of options.mixers) {
    const schemasToMix: Schema[] = [];

    // load the schema data for all inputs
    for (const input of mixer.input) {
      for (const file of globSync(input)) {
        const parsedSchema = await getSchema(file);
        if (parsedSchema) schemasToMix.push(parsedSchema);
      }
    }

    // extract all models and mix
    let models: Model[] = [];
    for (const schema of schemasToMix) models = [...models, ...schema.models];
    models = mixModels(models);

    let enums: DMMF.DatamodelEnum[] = [];
    schemasToMix.forEach((schema) => !!schema.enums && (enums = [...enums, ...schema.enums]));

    // use the last found datasources
    let datasources: DataSource[] = [];
    schemasToMix.forEach(
      (schema) =>
        schema.datasources.length > 0 &&
        schema.datasources.filter((d) => d.url.value).length > 0 &&
        (datasources = schema.datasources)
    );
    // use the last found generators
    let generators: GeneratorConfig[] = [];
    schemasToMix.forEach(
      (schema) => schema.generators.length > 0 && (generators = schema.generators)
    );

    let outputSchema = [
      '// *** GENERATED BY PRISMIX :: DO NOT EDIT ***',
      await deserializeDatasources(datasources),
      await deserializeGenerators(generators),
      await deserializeModels(models),
      await deserializeEnums(enums)
    ]
      .filter((e) => e)
      .join('\n');

    await writeFile(path.join(process.cwd(), mixer.output), outputSchema);
  }
}

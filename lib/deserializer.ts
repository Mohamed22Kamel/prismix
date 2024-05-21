import {
  ConnectorType,
  DataSource,
  EnvValue,
  DMMF,
  GeneratorConfig
} from '@prisma/generator-helper/dist';
import { Field, Model } from './dmmf-extension';
import { valueIs } from './utils';

// Render an individual field attribute
const renderAttribute = (field: Field) => {
  const { kind, type } = field;
  return {
    default: (value: any) => {
      if (value == null || value == undefined) return '';
      // convert value to a string, only if kind is scalar and NOT a BigInt
      if (kind === 'scalar' && type !== 'BigInt' && typeof value == 'string') value = `"${value}"`;
      // if number, string or boolean we are ready to return!
      if (valueIs(value, [Number, String, Boolean]) || kind === 'enum') return `@default(${value})`;
      // haven't yet found where this is actually useful — will get back on that
      if (typeof value === 'object') {
        // @default(dbgenerated("next_id()")) render to be @default(dbgenerated(next_id())), it cause error
        if (value.name === 'dbgenerated') return `@default(${value.name}("${value.args}"))`;
        return `@default(${value.name}(${value.args}))`;
      }

      throw new Error(`Prismix: Unsupported field attribute ${value}`);
    },
    isId: (value: any) => (value ? '@id' : ''),
    isUnique: (value: any) => (value ? '@unique' : ''),
    isUpdatedAt: (value: any) => (value ? '@updatedAt' : ''),
    columnName: (value: any) => (value ? `@map("${value}")` : ''),
    dbType: (value: any) => value ?? ''
  };
};
interface relation extends DMMF.Field {
  relationOnUpdate?: string;
  map?: string;
}
// Render a line of field attributes
function renderAttributes(field: relation): string {
  const {
    relationFromFields,
    relationToFields,
    relationName,
    kind,
    relationOnDelete,
    relationOnUpdate,
    map
  } = field;
  // handle attributes for scalar and enum fields
  if (kind == 'scalar' || kind == 'enum') {
    return `${Object.keys(field)
      // if we have a method defined above with that property, call the method
      .map(
        (property) =>
          renderAttribute(field)[property] && renderAttribute(field)[property](field[property])
      )
      // filter out empty strings
      .filter((x) => !!x)
      .join(' ')}`;
  }
  // handle relation syntax
  if (relationFromFields && kind === 'object') {
    if (relationFromFields.length > 0) {
      return `@relation(name: "${relationName}", fields: [${relationFromFields}], references: [${relationToFields}]${
        relationOnDelete ? `, onDelete: ${relationOnDelete}` : ''
      }${relationOnUpdate ? `, onUpdate: ${relationOnUpdate}` : ''}${
        map ? `, map: "${map}"` : ''
      })`;
    } else {
      return `@relation(name: "${relationName}")`;
    }
  }
  return '';
}

// Render all documentation lines
function renderDocumentation(documentation?: string, tab?: boolean) {
  if (!documentation) return '';

  const documentationLines = documentation.split('\n');

  return documentationLines.length == 1
    ? `/// ${documentationLines[0]}\n${tab ? '\t' : ''}`
    : documentationLines
        .map((text, idx) => (idx == 0 ? `/// ${text}` : `\t/// ${text}`))
        .join('\n') + (tab ? '\n\t' : '\n');
}

// render all fields present on a model
function renderModelFields(fields: Readonly<DMMF.Field[]>): string[] {
  return fields.map((field) => {
    const { name, kind, type, documentation, isRequired, isList } = field;

    if (kind == 'scalar')
      return `${renderDocumentation(documentation, true)}${name} ${type}${
        isList ? '[]' : isRequired ? '' : '?'
      } ${renderAttributes(field)}`;

    if (kind == 'object' || kind == 'enum')
      return `${renderDocumentation(documentation, true)}${name} ${type}${
        isList ? '[]' : isRequired ? '' : '?'
      } ${renderAttributes(field)}`;

    throw new Error(`Prismix: Unsupported field kind "${kind}"`);
  });
}

function renderIdFieldsOrPrimaryKey(idFields: Readonly<string[]>): string {
  // as of Prisma version ^2.30.0 idFields has become primaryKey, we should support both
  if (!idFields) return ''; // <- this is a hotfix until it can be looked into
  return idFields.length > 0 ? `@@id([${idFields.join(', ')}])` : '';
}
function renderUniqueIndexes(uniqueIndexes: Model['uniqueIndexes']): string[] {
  return uniqueIndexes.length > 0
    ? uniqueIndexes.map(
        ({ name, fields }) => `@@unique([${fields.join(', ')}]${name ? `, name: "${name}"` : ''})`
      )
    : [];
}
function renderDbName(dbName: string | null): string {
  return dbName ? `@@map("${dbName}")` : '';
}
function renderUrl(envValue: EnvValue): string {
  const value = envValue.fromEnvVar ? `env("${envValue.fromEnvVar}")` : `"${envValue.value}"`;

  return `url = ${value}`;
}
function renderProvider(provider: ConnectorType | string): string {
  return `provider = "${provider}"`;
}
function renderOutput(path: string | null): string {
  return path ? `output = "${path}"` : '';
}
function renderEnumFileName(path: string | null): string {
  return path ? `enumFileName = "${path}"` : '';
}
function renderFileName(path: string | null): string {
  return path ? `fileName = "${path}"` : '';
}
function renderBinaryTargets(binaryTargets?: string[]): string {
  return binaryTargets?.length ? `binaryTargets = ${JSON.stringify(binaryTargets)}` : '';
}
function renderPreviewFeatures(previewFeatures: GeneratorConfig['previewFeatures']): string {
  return previewFeatures.length ? `previewFeatures = ${JSON.stringify(previewFeatures)}` : '';
}

// This function will render a code block with suitable indenting
function renderBlock(type: string, name: string, things: string[], documentation?: string): string {
  return `${renderDocumentation(documentation)}${type} ${name} {\n${things
    .filter((thing) => thing.length > 1)
    .map((thing) => `\t${thing}`)
    .join('\n')}\n}`;
}

function deserializeModel(model: DMMF.Model): string {
  const { name, fields, dbName, primaryKey, uniqueIndexes, documentation } = model;
  return renderBlock(
    name.includes('view') ? 'view' : 'model',
    name,
    [
      ...renderModelFields(fields),
      ...renderUniqueIndexes(uniqueIndexes),
      renderDbName(dbName),
      renderIdFieldsOrPrimaryKey(primaryKey?.fields ?? [])
    ],
    documentation
  );
}

function deserializeDatasource(datasource: DataSource): string {
  const { activeProvider: provider, name, url } = datasource;
  return renderBlock('datasource', name, [renderProvider(provider), renderUrl(url)]);
}

function deserializeGenerator(generator: GeneratorConfig): string {
  const { binaryTargets, name, output, provider, previewFeatures, config } = generator;
  return renderBlock('generator', name, [
    renderProvider(provider.value || ''),
    renderOutput(output?.value || null),
    renderEnumFileName((config?.enumFileName as string) || null),
    renderFileName((config?.fileName as string) || null),
    // renderBinaryTargets(binaryTargets as unknown as string[]),
    renderPreviewFeatures(previewFeatures)
  ]);
}

function deserializeEnum({ name, values, dbName, documentation }: DMMF.DatamodelEnum) {
  const outputValues = values.map(({ name, dbName }) => {
    let result = name;
    if (name !== dbName && dbName) result += `@map("${dbName}")`;
    return result;
  });
  return renderBlock('enum', name, [...outputValues, renderDbName(dbName || null)], documentation);
}

// Exportable methods
export async function deserializeModels(models: Model[]) {
  return models.map((model) => deserializeModel(model)).join('\n');
}
export async function deserializeDatasources(datasources: DataSource[]) {
  return datasources.map((datasource) => deserializeDatasource(datasource)).join('\n');
}
export async function deserializeGenerators(generators: GeneratorConfig[]) {
  return generators.map((generator) => deserializeGenerator(generator)).join('\n');
}
export async function deserializeEnums(enums: DMMF.DatamodelEnum[]) {
  const enumNames: string[] = [];
  return enums
    .map((each) => {
      if (enumNames.includes(each.name)) {
        console.log(
          `Enum *${each.name}* already defined before i will accept first definition only recheck your schema`
        );
        return '';
      }
      enumNames.push(each.name);
      return deserializeEnum(each);
    })
    .join('\n');
}

// Adapted from https://github.com/IBM/prisma-schema-transformer/blob/53a173185b/src/deserializer.ts

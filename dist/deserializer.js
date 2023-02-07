"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deserializeEnums = exports.deserializeGenerators = exports.deserializeDatasources = exports.deserializeModels = void 0;
const utils_1 = require("./utils");
const renderAttribute = (field) => {
    const { kind, type } = field;
    return {
        default: (value) => {
            if (value == null || value == undefined)
                return '';
            if (kind === 'scalar' && type !== 'BigInt' && typeof value == 'string')
                value = `"${value}"`;
            if (utils_1.valueIs(value, [Number, String, Boolean]) || kind === 'enum')
                return `@default(${value})`;
            if (typeof value === 'object') {
                if (value.name === 'dbgenerated')
                    return `@default(${value.name}("${value.args}"))`;
                return `@default(${value.name}(${value.args}))`;
            }
            throw new Error(`Prismix: Unsupported field attribute ${value}`);
        },
        isId: (value) => (value ? '@id' : ''),
        isUnique: (value) => (value ? '@unique' : ''),
        isUpdatedAt: (value) => (value ? '@updatedAt' : ''),
        columnName: (value) => (value ? `@map("${value}")` : ''),
        dbType: (value) => value !== null && value !== void 0 ? value : ''
    };
};
function renderAttributes(field) {
    const { relationFromFields, relationToFields, relationName, kind, relationOnDelete, relationOnUpdate } = field;
    if (kind == 'scalar' || kind == 'enum') {
        return `${Object.keys(field)
            .map((property) => renderAttribute(field)[property] && renderAttribute(field)[property](field[property]))
            .filter((x) => !!x)
            .join(' ')}`;
    }
    if (relationFromFields && kind === 'object') {
        return relationFromFields.length > 0
            ? `@relation(name: "${relationName}", fields: [${relationFromFields}], references: [${relationToFields}]${relationOnDelete ? `, onDelete: ${relationOnDelete}` : ''}${relationOnUpdate ? `, onUpdate: ${relationOnUpdate}` : ''})`
            : `@relation(name: "${relationName}")`;
    }
    return '';
}
function renderDocumentation(documentation, tab) {
    if (!documentation)
        return '';
    const documentationLines = documentation.split('\n');
    return documentationLines.length == 1
        ? `/// ${documentationLines[0]}\n${tab ? '\t' : ''}`
        : documentationLines
            .map((text, idx) => (idx == 0 ? `/// ${text}` : `\t/// ${text}`))
            .join('\n') + (tab ? '\n\t' : '\n');
}
function renderModelFields(fields) {
    return fields.map((field) => {
        const { name, kind, type, documentation, isRequired, isList } = field;
        if (kind == 'scalar')
            return `${renderDocumentation(documentation, true)}${name} ${type}${isList ? '[]' : isRequired ? '' : '?'} ${renderAttributes(field)}`;
        if (kind == 'object' || kind == 'enum')
            return `${renderDocumentation(documentation, true)}${name} ${type}${isList ? '[]' : isRequired ? '' : '?'} ${renderAttributes(field)}`;
        throw new Error(`Prismix: Unsupported field kind "${kind}"`);
    });
}
function renderIdFieldsOrPrimaryKey(idFields) {
    if (!idFields)
        return '';
    return idFields.length > 0 ? `@@id([${idFields.join(', ')}])` : '';
}
function renderUniqueIndexes(uniqueIndexes) {
    return uniqueIndexes.length > 0
        ? uniqueIndexes.map(({ name, fields }) => `@@unique([${fields.join(', ')}]${name ? `, name: "${name}"` : ''})`)
        : [];
}
function renderDbName(dbName) {
    return dbName ? `@@map("${dbName}")` : '';
}
function renderUrl(envValue) {
    const value = envValue.fromEnvVar ? `env("${envValue.fromEnvVar}")` : `"${envValue.value}"`;
    return `url = ${value}`;
}
function renderProvider(provider) {
    return `provider = "${provider}"`;
}
function renderOutput(path) {
    return path ? `output = "${path}"` : '';
}
function renderBinaryTargets(binaryTargets) {
    return (binaryTargets === null || binaryTargets === void 0 ? void 0 : binaryTargets.length) ? `binaryTargets = ${JSON.stringify(binaryTargets)}` : '';
}
function renderPreviewFeatures(previewFeatures) {
    return previewFeatures.length ? `previewFeatures = ${JSON.stringify(previewFeatures)}` : '';
}
function renderBlock(type, name, things, documentation) {
    return `${renderDocumentation(documentation)}${type} ${name} {\n${things
        .filter((thing) => thing.length > 1)
        .map((thing) => `\t${thing}`)
        .join('\n')}\n}`;
}
function deserializeModel(model) {
    const { name, fields, dbName, idFields, primaryKey, doubleAtIndexes, uniqueIndexes, documentation } = model;
    return renderBlock('model', name, [
        ...renderModelFields(fields),
        ...renderUniqueIndexes(uniqueIndexes),
        ...(doubleAtIndexes !== null && doubleAtIndexes !== void 0 ? doubleAtIndexes : []),
        renderDbName(dbName),
        renderIdFieldsOrPrimaryKey(idFields || (primaryKey === null || primaryKey === void 0 ? void 0 : primaryKey.fields))
    ], documentation);
}
function deserializeDatasource(datasource) {
    const { activeProvider: provider, name, url } = datasource;
    return renderBlock('datasource', name, [renderProvider(provider), renderUrl(url)]);
}
function deserializeGenerator(generator) {
    const { binaryTargets, name, output, provider, previewFeatures } = generator;
    return renderBlock('generator', name, [
        renderProvider(provider.value),
        renderOutput((output === null || output === void 0 ? void 0 : output.value) || null),
        renderBinaryTargets(binaryTargets),
        renderPreviewFeatures(previewFeatures)
    ]);
}
function deserializeEnum({ name, values, dbName, documentation }) {
    const outputValues = values.map(({ name, dbName }) => {
        let result = name;
        if (name !== dbName && dbName)
            result += `@map("${dbName}")`;
        return result;
    });
    return renderBlock('enum', name, [...outputValues, renderDbName(dbName || null)], documentation);
}
function deserializeModels(models) {
    return __awaiter(this, void 0, void 0, function* () {
        return models.map((model) => deserializeModel(model)).join('\n');
    });
}
exports.deserializeModels = deserializeModels;
function deserializeDatasources(datasources) {
    return __awaiter(this, void 0, void 0, function* () {
        return datasources.map((datasource) => deserializeDatasource(datasource)).join('\n');
    });
}
exports.deserializeDatasources = deserializeDatasources;
function deserializeGenerators(generators) {
    return __awaiter(this, void 0, void 0, function* () {
        return generators.map((generator) => deserializeGenerator(generator)).join('\n');
    });
}
exports.deserializeGenerators = deserializeGenerators;
function deserializeEnums(enums) {
    return __awaiter(this, void 0, void 0, function* () {
        return enums.map((each) => deserializeEnum(each)).join('\n');
    });
}
exports.deserializeEnums = deserializeEnums;
//# sourceMappingURL=deserializer.js.map
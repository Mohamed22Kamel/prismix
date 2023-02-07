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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prismix = void 0;
const fs_1 = __importDefault(require("fs"));
const util_1 = require("util");
const path_1 = __importDefault(require("path"));
const sdk_1 = require("@prisma/sdk");
const deserializer_1 = require("./deserializer");
const glob_1 = __importDefault(require("glob"));
const readFile = util_1.promisify(fs_1.default.readFile);
const writeFile = util_1.promisify(fs_1.default.writeFile);
function getSchema(schemaPath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const schema = yield readFile(path_1.default.join(process.cwd(), schemaPath), {
                encoding: 'utf-8'
            });
            const dmmf = yield sdk_1.getDMMF({ datamodel: schema });
            const customAttributes = getCustomAttributes(schema);
            const models = dmmf.datamodel.models.map((model) => {
                var _a;
                return (Object.assign(Object.assign({}, model), { doubleAtIndexes: (_a = customAttributes[model.name]) === null || _a === void 0 ? void 0 : _a.doubleAtIndexes, fields: model.fields.map((field) => {
                        var _a, _b;
                        const attributes = (_b = (_a = customAttributes[model.name]) === null || _a === void 0 ? void 0 : _a.fields[field.name]) !== null && _b !== void 0 ? _b : {};
                        return Object.assign(Object.assign({}, field), { columnName: attributes.columnName, dbType: attributes.dbType, relationOnUpdate: attributes.relationOnUpdate });
                    }) }));
            });
            const config = yield sdk_1.getConfig({ datamodel: schema });
            return {
                models,
                enums: dmmf.datamodel.enums,
                datasources: config.datasources,
                generators: config.generators
            };
        }
        catch (e) {
            console.error(`Prismix failed to parse schema located at "${schemaPath}". Did you attempt to reference to a model without creating an alias? Remember you must define a "blank" alias model with only the "@id" field in your extended schemas otherwise we can't parse your schema.`, e);
        }
    });
}
function mixModels(inputModels) {
    var _a, _b, _c, _d, _e;
    const models = {};
    for (const newModel of inputModels) {
        const existingModel = models[newModel.name];
        if (existingModel) {
            const existingFieldNames = existingModel.fields.map((f) => f.name);
            for (const newField of newModel.fields) {
                if (existingFieldNames.includes(newField.name)) {
                    const existingFieldIndex = existingFieldNames.indexOf(newField.name);
                    const existingField = existingModel.fields[existingFieldIndex];
                    if (!newField.columnName && existingField.columnName) {
                        newField.columnName = existingField.columnName;
                    }
                    if (!newField.hasDefaultValue && existingField.hasDefaultValue) {
                        newField.hasDefaultValue = true;
                        newField.default = existingField.default;
                    }
                    existingModel.fields[existingFieldIndex] = newField;
                }
                else {
                    existingModel.fields.push(newField);
                }
            }
            if (!existingModel.dbName && newModel.dbName) {
                existingModel.dbName = newModel.dbName;
            }
            if ((_a = newModel.doubleAtIndexes) === null || _a === void 0 ? void 0 : _a.length) {
                existingModel.doubleAtIndexes = [
                    ...((_b = existingModel.doubleAtIndexes) !== null && _b !== void 0 ? _b : []),
                    ...newModel.doubleAtIndexes
                ];
            }
            if ((_c = newModel.uniqueIndexes) === null || _c === void 0 ? void 0 : _c.length) {
                existingModel.uniqueIndexes = [
                    ...((_d = existingModel.uniqueIndexes) !== null && _d !== void 0 ? _d : []),
                    ...newModel.uniqueIndexes
                ];
                existingModel.uniqueFields = [
                    ...((_e = existingModel.uniqueFields) !== null && _e !== void 0 ? _e : []),
                    ...newModel.uniqueFields
                ];
            }
        }
        else {
            models[newModel.name] = newModel;
        }
    }
    return Object.values(models);
}
function getCustomAttributes(datamodel) {
    const modelChunks = datamodel.split('\n}');
    return modelChunks.reduce((modelDefinitions, modelChunk) => {
        var _a;
        let pieces = modelChunk.split('\n').filter((chunk) => chunk.trim().length);
        const modelName = (_a = pieces.find((name) => name.match(/model (.*) {/))) === null || _a === void 0 ? void 0 : _a.split(' ')[1];
        if (!modelName)
            return modelDefinitions;
        const mapRegex = new RegExp(/[^@]@map\("(?<name>.*)"\)/);
        const dbRegex = new RegExp(/(?<type>@db\.(.[^\s@]*))/);
        const relationOnUpdateRegex = new RegExp(/onUpdate: (?<op>Cascade|NoAction|Restrict|SetDefault|SetNull)/);
        const doubleAtIndexRegex = new RegExp(/(?<index>@@index\(.*\))/);
        const doubleAtIndexes = pieces
            .reduce((ac, field) => {
            var _a, _b;
            const item = (_b = (_a = field.match(doubleAtIndexRegex)) === null || _a === void 0 ? void 0 : _a.groups) === null || _b === void 0 ? void 0 : _b.index;
            return item ? [...ac, item] : ac;
        }, [])
            .filter((f) => f);
        const fieldsWithCustomAttributes = pieces
            .map((field) => {
            var _a, _b, _c, _d, _e, _f;
            const columnName = (_b = (_a = field.match(mapRegex)) === null || _a === void 0 ? void 0 : _a.groups) === null || _b === void 0 ? void 0 : _b.name;
            const dbType = (_d = (_c = field.match(dbRegex)) === null || _c === void 0 ? void 0 : _c.groups) === null || _d === void 0 ? void 0 : _d.type;
            const relationOnUpdate = (_f = (_e = field.match(relationOnUpdateRegex)) === null || _e === void 0 ? void 0 : _e.groups) === null || _f === void 0 ? void 0 : _f.op;
            return [field.trim().split(' ')[0], { columnName, dbType, relationOnUpdate }];
        })
            .filter((f) => { var _a, _b, _c; return ((_a = f[1]) === null || _a === void 0 ? void 0 : _a.columnName) || ((_b = f[1]) === null || _b === void 0 ? void 0 : _b.dbType) || ((_c = f[1]) === null || _c === void 0 ? void 0 : _c.relationOnUpdate); });
        return Object.assign(Object.assign({}, modelDefinitions), { [modelName]: { fields: Object.fromEntries(fieldsWithCustomAttributes), doubleAtIndexes } });
    }, {});
}
function prismix(options) {
    return __awaiter(this, void 0, void 0, function* () {
        for (const mixer of options.mixers) {
            const schemasToMix = [];
            for (const input of mixer.input) {
                for (const file of glob_1.default.sync(input)) {
                    const parsedSchema = yield getSchema(file);
                    if (parsedSchema)
                        schemasToMix.push(parsedSchema);
                }
            }
            let models = [];
            for (const schema of schemasToMix)
                models = [...models, ...schema.models];
            models = mixModels(models);
            let enums = [];
            schemasToMix.forEach((schema) => !!schema.enums && (enums = [...enums, ...schema.enums]));
            let datasources = [];
            schemasToMix.forEach((schema) => schema.datasources.length > 0 &&
                schema.datasources.filter((d) => d.url.value).length > 0 &&
                (datasources = schema.datasources));
            let generators = [];
            schemasToMix.forEach((schema) => schema.generators.length > 0 && (generators = schema.generators));
            let outputSchema = [
                '// *** GENERATED BY PRISMIX :: DO NOT EDIT ***',
                yield deserializer_1.deserializeDatasources(datasources),
                yield deserializer_1.deserializeGenerators(generators),
                yield deserializer_1.deserializeModels(models),
                yield deserializer_1.deserializeEnums(enums)
            ]
                .filter((e) => e)
                .join('\n');
            yield writeFile(path_1.default.join(process.cwd(), mixer.output), outputSchema);
        }
    });
}
exports.prismix = prismix;
//# sourceMappingURL=prismix.js.map
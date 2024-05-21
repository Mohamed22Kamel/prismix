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
exports.generateConfig = exports.containsObject = exports.valueIs = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const PRISMA_EXTENSION = '.prisma';
const EXCLUDED_PRISMA_FILE = 'schema.prisma';
const IGNORED_PRISMA_SUFFIX = '.i.prisma';
function valueIs(value, types) {
    return types.map((type) => type.name.toLowerCase() == typeof value).includes(true);
}
exports.valueIs = valueIs;
function containsObject(obj, list) {
    const keysToCheck = Object.keys(obj);
    const isObjectInArray = list.some((item) => keysToCheck.every((key) => item[key] === obj[key]));
    return isObjectInArray;
}
exports.containsObject = containsObject;
function generateConfig() {
    return __awaiter(this, arguments, void 0, function* (dir = process.cwd()) {
        const filesFound = new Set();
        const projectDir = process.cwd();
        filesFound.add('prisma/base.prisma');
        filesFound.add('prisma/enums/enums.prisma');
        function scanDirectory(currentDir) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    const files = yield fs_1.promises.readdir(currentDir, { withFileTypes: true });
                    const tasks = files.map((file) => __awaiter(this, void 0, void 0, function* () {
                        const absoluteFilePath = path_1.default.join(currentDir, file.name);
                        const relativeFilePath = path_1.default
                            .relative(projectDir, absoluteFilePath)
                            .replaceAll(path_1.default.sep, '/');
                        if (file.isDirectory()) {
                            yield scanDirectory(absoluteFilePath);
                        }
                        else if (file.isFile() && isValidPrismaFile(file.name)) {
                            filesFound.add(relativeFilePath);
                        }
                    }));
                    yield Promise.all(tasks);
                }
                catch (err) {
                    console.error(`Error reading directory ${currentDir}: ${err}`);
                }
            });
        }
        function isValidPrismaFile(fileName) {
            return (fileName.endsWith(PRISMA_EXTENSION) &&
                fileName !== EXCLUDED_PRISMA_FILE &&
                !fileName.endsWith(IGNORED_PRISMA_SUFFIX));
        }
        yield scanDirectory(dir);
        return Array.from(filesFound);
    });
}
exports.generateConfig = generateConfig;
//# sourceMappingURL=utils.js.map
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
const command_1 = require("@oclif/command");
const prismix_1 = require("./prismix");
const util_1 = require("util");
const jsonfile_1 = __importDefault(require("jsonfile"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const readJsonFile = util_1.promisify(jsonfile_1.default.readFile);
const args = process.argv.slice(2);
class Prismix extends command_1.Command {
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            this.log(`Prismix: mixing your schemas... 🍹`);
            const options = (yield readJsonFile(path_1.default.join(process.cwd(), args[0] || 'prismix.config.json')));
            for (const mixer of options.mixers) {
                if (!mixer.output)
                    mixer.output = 'prisma/schema.prisma';
            }
            yield prismix_1.prismix(options);
        });
    }
}
Prismix.description = 'Allows you to have multiple Prisma schema files with shared model relations.';
Prismix.flags = {
    version: command_1.flags.version({ char: 'v' }),
    help: command_1.flags.help({ char: 'h' })
};
module.exports = Prismix;
//# sourceMappingURL=index.js.map
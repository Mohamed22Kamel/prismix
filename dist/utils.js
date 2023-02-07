"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.valueIs = void 0;
function valueIs(value, types) {
    return types.map((type) => type.name.toLowerCase() == typeof value).includes(true);
}
exports.valueIs = valueIs;
//# sourceMappingURL=utils.js.map
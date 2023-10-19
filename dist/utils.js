"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.containsObject = exports.valueIs = void 0;
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
//# sourceMappingURL=utils.js.map
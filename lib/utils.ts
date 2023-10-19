// given an array of type constructors, is the value one of them?
export function valueIs(value: any, types: any[]) {
  return types.map((type) => type.name.toLowerCase() == typeof value).includes(true);
}
export function containsObject(obj: Object, list: Object[]) {
  const keysToCheck = Object.keys(obj);
  const isObjectInArray = list.some((item) => keysToCheck.every((key) => item[key] === obj[key]));

  return isObjectInArray;
}

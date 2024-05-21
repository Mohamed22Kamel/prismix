import { promises as fs } from 'fs';
import path from 'path';

const PRISMA_EXTENSION = '.prisma';
const EXCLUDED_PRISMA_FILE = 'schema.prisma';
const IGNORED_PRISMA_SUFFIX = '.i.prisma';

// given an array of type constructors, is the value one of them?
export function valueIs(value: any, types: any[]) {
  return types.map((type) => type.name.toLowerCase() == typeof value).includes(true);
}

export function containsObject(obj: Object, list: Object[]) {
  const keysToCheck = Object.keys(obj);
  const isObjectInArray = list.some((item) => keysToCheck.every((key) => item[key] === obj[key]));

  return isObjectInArray;
}

export async function generateConfig(dir: string = process.cwd()): Promise<string[]> {
  const filesFound = new Set<string>();
  const projectDir = process.cwd();

  filesFound.add('prisma/base.prisma');
  filesFound.add('prisma/enums/enums.prisma');

  async function scanDirectory(currentDir: string) {
    try {
      const files = await fs.readdir(currentDir, { withFileTypes: true });
      const tasks = files.map(async (file) => {
        const absoluteFilePath = path.join(currentDir, file.name);
        const relativeFilePath = path
          .relative(projectDir, absoluteFilePath)
          .replaceAll(path.sep, '/');

        if (file.isDirectory()) {
          await scanDirectory(absoluteFilePath);
        } else if (file.isFile() && isValidPrismaFile(file.name)) {
          filesFound.add(relativeFilePath);
        }
      });
      await Promise.all(tasks);
    } catch (err) {
      console.error(`Error reading directory ${currentDir}: ${err}`);
    }
  }

  function isValidPrismaFile(fileName: string): boolean {
    return (
      fileName.endsWith(PRISMA_EXTENSION) &&
      fileName !== EXCLUDED_PRISMA_FILE &&
      !fileName.endsWith(IGNORED_PRISMA_SUFFIX)
    );
  }

  await scanDirectory(dir);
  return Array.from(filesFound);
}

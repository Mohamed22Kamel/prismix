import { Command } from '@oclif/core';
declare class Prismix extends Command {
    static description: string;
    static flags: {
        version: import("@oclif/core/lib/interfaces").BooleanFlag<void>;
        help: import("@oclif/core/lib/interfaces").BooleanFlag<void>;
    };
    run(): Promise<void>;
}
export = Prismix;

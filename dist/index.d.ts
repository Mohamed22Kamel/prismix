import { Command } from '@oclif/command';
declare class Prismix extends Command {
    static description: string;
    static flags: {
        version: import("@oclif/parser/lib/flags").IBooleanFlag<void>;
        help: import("@oclif/parser/lib/flags").IBooleanFlag<void>;
    };
    run(): Promise<void>;
}
export = Prismix;

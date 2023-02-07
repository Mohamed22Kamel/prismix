export interface MixerOptions {
    input: string[];
    output: string;
}
export interface PrismixOptions {
    mixers: MixerOptions[];
}
export declare function prismix(options: PrismixOptions): Promise<void>;

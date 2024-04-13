type Mutable<T> = {
    -readonly [K in keyof T]: T[K];
};
type DeepMutable<T> = {
    -readonly [K in keyof T]: T[K] extends ReadonlyArray<infer U> ? Array<DeepMutable<U>> : T[K] extends object ? DeepMutable<T[K]> : T[K];
};

type Fn<T> = () => T;
interface Routine<T> {
    name: string;
    fn: Fn<T>;
    result: T;
}

export default class Test {
    private routines: Routine<unknown>[] = [];

    constructor(public readonly name: string) {}
    add<T> (name: string, fn: Fn<T>, result: T): void {
        this.routines.push({
            name, fn, result
        });
    }
    get size (): number {
        return this.routines.length;
    }
    run (): number {
        if (this.size === 0) {
            console.warn(`Test suite ${this.name} is empty`);
            return 0;
        }

        let success = 0;
        console.info(`Running ${this.size} tests for ${this.name}...`);
        for (const routine of this.routines) {
            try {
                const result = routine.fn();
                if (result === routine.result) {
                    console.info(`[SUCCESS] ${this.name}::${routine.name}`);
                    ++success;
                } else {
                    console.error(`[FAILED] ${this.name}::${routine.name}\n` +
                        '\tgot: ' + result + '\n' +
                        '\texpected: ' + routine.result
                    );
                }
            } catch (e) {
                console.error(`[ERROR] ${this.name}::${routine.name}`, e);
            }
        }
        console.info(`Success: ${success}/${this.size}\n`);

        return success;
    }

    static runAllTests (allSuits: Test[]): boolean {
        let success = 0;
        let total = 0;
        const begin = process.hrtime();
        for (const suite of allSuits) {
            total += suite.size;
            success += suite.run();
        }

        const end = process.hrtime(begin);
        const milliseconds = (end[0] * 1000) + (end[1] / 1000000);
        console.info(`Testing is done in ${milliseconds} ms, ${success} of ${total} were successful`);

        return success === total;
    }
}
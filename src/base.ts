let counter = 0;

export default class Base {
    public readonly id: number;
    private _destroyed = false;

    constructor () {
        this.id = ++counter;
    }
    destructor (): void {
        for (const key in this)
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete this[key];

        this._destroyed = true;
    }
    get className (): string {
        return this.constructor.name;
    }
    get destroyed (): boolean {
        return this._destroyed;
    }
}
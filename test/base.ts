import Test from './test';
import Base from '../src/base';

class Heir extends Base {}

const test: Test = new Test("Base");
test.add('id', () => {
    const base = new Base();
    return base.id === 0;
}, false);

test.add('destructor', () => {
    const base = new Base();
    base.destructor();

    return base.id === undefined && base.destroyed;
}, true);

test.add('className', () => {
    const base = new Base();
    const heir = new Heir();

    return base.className === "Base" && heir.className === "Heir";
}, true);

export default test;
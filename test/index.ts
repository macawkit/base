import Test from "./test";
import base from "./base";

const result = Test.runAllTests([
    base
]);

if (!result)
    process.exitCode = 1;
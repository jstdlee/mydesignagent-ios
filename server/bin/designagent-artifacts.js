#!/usr/bin/env node
import { main } from "../src/cli.js";

main(process.argv.slice(2)).then(
  (code) => {
    if (typeof code === "number") process.exitCode = code;
  },
  (error) => {
    process.stderr.write(`error: ${error?.message ?? error}\n`);
    process.exitCode = 1;
  },
);

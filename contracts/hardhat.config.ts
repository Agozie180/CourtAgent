import { createRequire } from "node:module";
import { defineConfig } from "hardhat/config";
import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";

// Compile with the pinned `solc` npm package (solc-js) instead of downloading a native compiler.
// Builds are identical on every machine and work offline or behind a firewall.
const require = createRequire(import.meta.url);

export default defineConfig({
  plugins: [hardhatToolboxViem],
  paths: { sources: "./src", tests: { nodejs: "./test" } },
  solidity: {
    version: "0.8.37",
    path: require.resolve("solc/soljson.js"),
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun" },
  },
});

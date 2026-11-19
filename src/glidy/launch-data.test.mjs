import test from "node:test";
import assert from "node:assert/strict";
import { filterAndSortLaunches, formatTaxPips, shortAddress } from "./launch-data.mjs";

const launches = [
  { token_address: "0x0000000000000000000000000000000000000001", token_name: "Zebra", token_symbol: "ZEB", launch_block_timestamp: "100" },
  { token_address: "0x0000000000000000000000000000000000000002", token_name: "Alpha", token_symbol: "ALP", launch_block_timestamp: "300" },
  { token_address: "0x0000000000000000000000000000000000000003", token_name: "Beta", token_symbol: "BET", launch_block_timestamp: "200" },
];

test("tax pips use the documented 10,000-pips-per-percent scale", () => {
  assert.equal(formatTaxPips(30_000), "3%");
  assert.equal(formatTaxPips(1_250), "0.13%");
  assert.equal(formatTaxPips("bad"), "—");
  assert.equal(formatTaxPips(null), "—");
});

test("shortAddress abbreviates long EVM addresses and handles missing values", () => {
  assert.equal(shortAddress(launches[0].token_address), "0x0000…0001");
  assert.equal(shortAddress("0x1234"), "0x1234");
  assert.equal(shortAddress(undefined), "—");
});

test("launch search matches name, symbol and address without case sensitivity", () => {
  assert.deepEqual(filterAndSortLaunches(launches, { query: "alp" }).map((launch) => launch.token_name), ["Alpha"]);
  assert.deepEqual(filterAndSortLaunches(launches, { query: "0003" }).map((launch) => launch.token_name), ["Beta"]);
});

test("launch browser defaults to newest-first and can sort by name", () => {
  const shuffled = [
    { ...launches[0], launch_block_timestamp: "200" },
    { ...launches[1], launch_block_timestamp: "100" },
    { ...launches[2], launch_block_timestamp: "300" },
  ];
  assert.deepEqual(filterAndSortLaunches(shuffled).map((launch) => launch.token_name), ["Beta", "Zebra", "Alpha"]);
  assert.deepEqual(filterAndSortLaunches(shuffled, { sort: "name" }).map((launch) => launch.token_name), ["Alpha", "Beta", "Zebra"]);
});

test("saved launch filtering is address-case insensitive", () => {
  assert.deepEqual(filterAndSortLaunches(launches, {
    watchlist: true,
    saved: [launches[2].token_address.toUpperCase()],
  }).map((launch) => launch.token_name), ["Beta"]);
});

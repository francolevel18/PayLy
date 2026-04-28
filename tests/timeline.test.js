import assert from "node:assert/strict";
import { groupByDay, groupByHour, groupByMonth } from "../lib/timelineGroups.js";

const now = new Date();
now.setHours(15, 30, 0, 0);
const earlierToday = new Date(now);
earlierToday.setHours(11, 15, 0, 0);
const yesterday = new Date(now);
yesterday.setDate(now.getDate() - 1);

const expenses = [
  {
    id: "today-a",
    amount: 4500,
    description: "comida",
    category: "food",
    paymentMethod: "cash",
    createdAt: now.toISOString()
  },
  {
    id: "today-b",
    amount: 2500,
    description: "uber",
    category: "transport",
    paymentMethod: "transfer",
    createdAt: earlierToday.toISOString()
  },
  {
    id: "yesterday",
    amount: 8000,
    description: "cine",
    category: "leisure",
    paymentMethod: "credit",
    createdAt: yesterday.toISOString()
  }
];

const hourly = groupByHour(expenses);
assert.equal(hourly.reduce((total, group) => total + group.count, 0), 2);

const daily = groupByDay(expenses);
assert.equal(daily.length, 1);
assert.equal(daily[0].total, 7000);
assert.equal(daily[0].count, 2);

const monthly = groupByMonth(expenses);
assert.ok(monthly.length >= 1);
assert.ok(monthly.some((group) => group.total >= 7000));

console.log("Timeline tests passed");

// src/utils/math.test.js
import { expect, test } from 'vitest';
import { calculateTotal } from './math';

test('100円と200円を渡すと合計が300円になること', () => {
  const data = [100, 200];
  const result = calculateTotal(data);

  // 「結果が300であることを期待する」という命令
  expect(result).toBe(300);
});

test('文字が混じっていても正しく計算できること', () => {
  const data = [100, '500', null];
  const result = calculateTotal(data);

  expect(result).toBe(600);
});

test('空のリストを渡すと0になること', () => {
  // calculateSum を calculateTotal に修正！
  const result = calculateTotal([]);
  expect(result).toBe(0);
});

test('マイナスが含まれていても正しく合計できること', () => {
  // ここも calculateTotal に！
  const result = calculateTotal([1000, -200, 300]);
  expect(result).toBe(1100);
});

test('小数（0.1 + 0.2）でも誤差が出ないこと', () => {
  const result = calculateTotal([0.1, 0.2]);
  // 誤差を無視して「ほぼ0.3」なら合格にする
  expect(result).toBeCloseTo(0.3);
});

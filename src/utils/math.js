// src/utils/math.js

// テストしたい関数：支出の合計を計算する
export function calculateTotal(values) {
  return values.reduce((sum, val) => sum + (Number(val) || 0), 0);
}

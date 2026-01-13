<script setup>
import { ref, reactive, watch } from 'vue';
import MonthRow from './components/MonthRow.vue';
import EditModal from './components/EditModal.vue';

// --- カテゴリ管理 ---
const savedCategories = JSON.parse(localStorage.getItem('kakeibo_categories'));
const categories = ref(
  savedCategories || [
    { id: 'income', label: '収入' },
    { id: 'investment', label: '投資' },
    { id: 'food', label: '食費' },
    { id: 'misc', label: '雑費/趣味/サブスク' },
    { id: 'play', label: '遊び' },
    { id: 'rent', label: '家賃' },
  ]
);

// --- 編集・削除ロジック ---
const editingCategory = ref(null);
const openEdit = (cat) => {
  editingCategory.value = { ...cat };
};

const saveEdit = () => {
  if (editingCategory.value.id === 'new') {
    const newId = 'cat_' + Date.now();
    categories.value.push({ id: newId, label: editingCategory.value.label });
    data[newId] = {};
  } else {
    const index = categories.value.findIndex((c) => c.id === editingCategory.value.id);
    if (index !== -1) categories.value[index].label = editingCategory.value.label;
  }
  localStorage.setItem('kakeibo_categories', JSON.stringify(categories.value));
  editingCategory.value = null;
};

const deleteCategory = (id, label) => {
  if (confirm(`「${label}」を削除してもいい？データも消えちゃうよ。`)) {
    categories.value = categories.value.filter((c) => c.id !== id);
    delete data[id];
    localStorage.setItem('kakeibo_categories', JSON.stringify(categories.value));
    return true;
  }
  return false;
};
const deleteFromEdit = () => {
  deleteCategory(editingCategory.value.id, editingCategory.value.label);
  editingCategory.value = null;
};

// --- データ管理 ---
const initialState = categories.value.reduce((acc, cat) => {
  acc[cat.id] = {};
  return acc;
}, {});
const savedData = JSON.parse(localStorage.getItem('kakeibo_vue_data'));
const data = reactive(savedData || initialState);

categories.value.forEach((cat) => {
  if (!data[cat.id]) data[cat.id] = {};
});

watch(
  data,
  (newData) => {
    localStorage.setItem('kakeibo_vue_data', JSON.stringify(newData));
  },
  { deep: true }
);

// --- 計算ロジック ---
const getMonthTotal = (m) => {
  return categories.value
    .filter((c) => c.id !== 'income')
    .reduce((sum, cat) => sum + (Number(data[cat.id]?.[m]) || 0), 0);
};
const getMonthBalance = (m) => {
  const income = Number(data['income']?.[m]) || 0;
  return income - getMonthTotal(m);
};
const getCategoryTotal = (id) => {
  const months = data[id] || {};
  return Object.values(months).reduce((sum, val) => sum + (Number(val) || 0), 0);
};
const totalIncome = () => getCategoryTotal('income');
const totalInvestment = () => getCategoryTotal('investment');
const totalOut = () => {
  return categories.value.filter((c) => c.id !== 'income').reduce((sum, c) => sum + getCategoryTotal(c.id), 0);
};
const openAdd = () => {
  editingCategory.value = { id: 'new', label: '' };
};
// カテゴリの順番を入れ替える魔法
const moveCategory = (index, direction) => {
  const newIndex = index + direction;

  // 範囲外（一番上より上、一番下より下）には動かせないようにする
  if (newIndex < 0 || newIndex >= categories.value.length) return;

  // 配列の中身を入れ替える
  const temp = categories.value[index];
  categories.value[index] = categories.value[newIndex];
  categories.value[newIndex] = temp;

  // 並び替えた順番を保存する
  localStorage.setItem('kakeibo_categories', JSON.stringify(categories.value));
};
</script>
<template>
  <div class="app-wrapper">
    <main class="main-content">
      <div class="card">
        <h1>年間収支シミュレーター</h1>

        <div class="scroll-container">
          <div class="table-inner">
            <div class="month-header">
              <!-- <div class="header-spacer" style="width: 220px"></div> -->
              <div class="header-spacer">
                <div class="header-sort-placeholder"></div>
              </div>
              <div v-for="m in 12" :key="m" class="month-header-label">{{ m }}月</div>
            </div>

            <div v-for="(cat, index) in categories" :key="cat.id" class="category-row-wrapper">
              <div class="sort-buttons">
                <button @click="moveCategory(index, -1)" :disabled="index === 0">▲</button>
                <button @click="moveCategory(index, 1)" :disabled="index === categories.length - 1">▼</button>
              </div>

              <div class="row-content">
                <MonthRow :label="cat.label" :month-data="data[cat.id]" @click-label="openEdit(cat)" />
                <hr v-if="cat.id === 'investment'" />
              </div>
            </div>

            <div class="row total-row">
              <label class="month-label sticky-label">支出合計</label>
              <div class="months">
                <div v-for="m in 12" :key="m" class="month-total-cell">
                  {{ getMonthTotal(m).toLocaleString() }}
                  <span class="total-unit">円</span>
                </div>
              </div>
            </div>

            <div class="row balance-row">
              <label class="month-label sticky-label">手残り（収支）</label>
              <div class="months">
                <div v-for="m in 12" :key="m" class="month-total-cell" :class="{ minus: getMonthBalance(m) < 0 }">
                  {{ getMonthBalance(m).toLocaleString() }}
                  <span class="total-unit">円</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button @click="openAdd" class="add-btn">＋ カテゴリを追加</button>
        <div class="result">
          <p>
            年間収入合計: <span>{{ totalIncome().toLocaleString() }}</span> 円
          </p>
          <p>
            年間投資合計:
            <span>{{ totalInvestment().toLocaleString() }}</span> 円
          </p>
          <p>
            年間支出合計: <span>{{ totalOut().toLocaleString() }}</span> 円
          </p>
          <p>
            年間手残り(収支):
            <span :class="{ minus: totalIncome() - totalOut() < 0 }">
              {{ (totalIncome() - totalOut()).toLocaleString() }} 円
            </span>
          </p>
        </div>
      </div>
    </main>

    <EditModal v-model="editingCategory" @save="saveEdit" @delete="deleteFromEdit" @close="editingCategory = null" />
  </div>
</template>

<style scoped>
.app-wrapper {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

input,
button,
select,
textarea {
  font-family: inherit;
}
h1 {
  margin-top: 0px;
}
.main-content {
  flex: 1;
}

.card {
  max-width: 98%;
  margin: 10px auto;
  padding: 20px;
  background-color: white;
  color: #333;
}

.scroll-container {
  overflow-x: auto;
  overflow-y: visible;
}

.month-header {
  display: flex;
  gap: 5px;
  margin-bottom: 10px;
  min-width: max-content;
}

.header-spacer {
  width: 220px;
  flex-shrink: 0;
  position: sticky;
  left: 0;
  background-color: white;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 10px;
}

.month-header-label {
  width: 120px;
  font-size: 16px;
  font-weight: bold;
  text-align: center;
  flex-shrink: 0;
  color: #555;
}

hr {
  margin: 15px 0;
  border: 0;
  border-top: 1px solid #ddd;
}

.total-row,
.balance-row {
  display: flex;
  align-items: center;
  min-width: max-content;
}

.total-row {
  margin-top: 10px;
  padding: 10px 0;
  border-top: 2px solid #4caf50;
  font-weight: bold;
  background-color: white;
}

.balance-row {
  background-color: #f0f9f0;
  padding: 10px 0;
  font-weight: bold;
}

.months {
  display: flex;
  gap: 5px;
  flex-wrap: nowrap;
}

.month-total-cell {
  width: 120px;
  text-align: right;
  font-weight: bold;
  flex-shrink: 0;
}

.month-label {
  width: 180px;
  flex-shrink: 0;
  padding-left: 10px;
}

.sticky-label {
  position: sticky;
  left: 0;
  background-color: inherit;
  z-index: 10;
}

.minus {
  color: #ff4d4d !important;
}
.total-unit {
  font-size: 14px;
  color: #999;
  margin-left: 5px;
  font-weight: normal;
}

.result {
  padding: 20px;
  background-color: #f9f9f9;
  padding-bottom: calc(1rem + env(safe-area-inset-bottom));
}

.result p {
  margin: 10px 0;
  font-weight: bold;
  font-size: 20px;
}

.table-inner {
  display: inline-block;
  min-width: 100%;
}

.add-btn {
  margin: 30px 0;
  padding: 10px 20px;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.header-sort-placeholder {
  width: 30px; /* 🚀 MonthRowの .sort-buttons の幅に合わせる */
  flex-shrink: 0;
}

.category-row-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sort-buttons {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: max-content; /* 横に突き抜けても崩れないように */
  width: 30px; /* ボタンエリアの幅を固定 */
  flex-shrink: 0; /* 潰れないように固定 */
}

.sort-buttons button {
  padding: 2px 5px;
  font-size: 10px;
  cursor: pointer;
  background: #eee;
  border: 1px solid #ccc;
  border-radius: 3px;
}

.row-content {
  flex-grow: 1; /* 残りの幅を全部使う */
}

.sort-buttons button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .card {
    margin: 0;
    padding: 10px;
    max-width: 100%;
    border-radius: 0;
  }
  .sticky-label,
  .header-spacer {
    position: static;
    width: 160px;
    background-color: transparent;
  }

  h1 {
    font-size: 24px;
    margin-top: 10px;
  }
  .result {
    margin: 0;
    padding: 10px 20px;
  }

  .result p {
    font-size: 16px;
  }
}
</style>

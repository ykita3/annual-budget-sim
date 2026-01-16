<script setup>
import { ref, reactive, watch, onMounted, onUnmounted } from 'vue';
import MonthRow from './components/MonthRow.vue';
import EditModal from './components/EditModal.vue';
// Firebaseのインポート
import { auth, googleProvider, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

// --- ユーザー管理 ---
const user = ref(null);

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

// --- データ管理 ---
const initialState = categories.value.reduce((acc, cat) => {
  acc[cat.id] = {};
  for (let m = 1; m <= 12; m++) {
    acc[cat.id][m] = 0;
  }
  return acc;
}, {});
const savedData = JSON.parse(localStorage.getItem('kakeibo_vue_data'));
const data = reactive(savedData || initialState);

// データの初期化チェック
categories.value.forEach((cat) => {
  if (!data[cat.id]) data[cat.id] = {};
  for (let m = 1; m <= 12; m++) {
    if (data[cat.id][m] === undefined || data[cat.id][m] === null || data[cat.id][m] === '') {
      data[cat.id][m] = 0;
    }
  }
});

// --- App.vue の watch 部分を少し賢くする ---
watch(
  data,
  async (newData) => {
    // 🌟 user.value がいて、かつ「今まさに読み込み中」じゃない時だけ保存する
    // （今回はシンプルに user.value のチェックだけでも動くから、まずはこのままでもOK！）
    if (user.value) {
      try {
        await setDoc(doc(db, 'users', user.value.uid), {
          kakeibo_data: newData,
          categories: categories.value,
        });
      } catch (e) {
        console.error('保存失敗:', e);
      }
    } else {
      localStorage.setItem('kakeibo_vue_data', JSON.stringify(newData));
    }
  },
  { deep: true }
);

// --- 認証ロジック ---
const login = async () => {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    console.error('ログインエラー:', err);
  }
};

const logout = async () => {
  if (confirm('ログアウトする？')) {
    await signOut(auth);
  }
};

// --- 編集・削除ロジック ---
const editingCategory = ref(null);
const openEdit = (cat) => {
  editingCategory.value = { ...cat };
};
const openAdd = () => {
  editingCategory.value = { id: 'new', label: '' };
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
  if (confirm(`「${label}」を削除してもいい？`)) {
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

// --- 計算ロジック ---
const getMonthTotal = (m) =>
  categories.value.filter((c) => c.id !== 'income').reduce((sum, cat) => sum + (Number(data[cat.id]?.[m]) || 0), 0);
const getMonthBalance = (m) => (Number(data['income']?.[m]) || 0) - getMonthTotal(m);
const totalIncome = () =>
  categories.value
    .filter((c) => c.id === 'income')
    .reduce((sum, c) => sum + Object.values(data[c.id] || {}).reduce((s, v) => s + (Number(v) || 0), 0), 0);
const totalInvestment = () =>
  categories.value
    .filter((c) => c.id === 'investment')
    .reduce((sum, c) => sum + Object.values(data[c.id] || {}).reduce((s, v) => s + (Number(v) || 0), 0), 0);
const totalOut = () =>
  categories.value
    .filter((c) => c.id !== 'income')
    .reduce((sum, c) => sum + Object.values(data[c.id] || {}).reduce((s, v) => s + (Number(v) || 0), 0), 0);

const moveCategory = (index, direction) => {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= categories.value.length) return;
  const temp = categories.value[index];
  categories.value[index] = categories.value[newIndex];
  categories.value[newIndex] = temp;
  localStorage.setItem('kakeibo_categories', JSON.stringify(categories.value));
};

// --- 選択・ドラッグロジック ---
const selectedCells = ref([]);
const isDragging = ref(false);
const startCell = ref(null);

const startSelect = (catId, month, event) => {
  isDragging.value = true;
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  window.getSelection()?.removeAllRanges();
  if (!(event.ctrlKey || event.metaKey)) selectedCells.value = [];
  startCell.value = { catId, month };
  updateSelectionRange(catId, month);
};
const handleMouseEnter = (catId, month) => {
  if (isDragging.value && startCell.value) updateSelectionRange(catId, month);
};
const updateSelectionRange = (currentCatId, currentMonth) => {
  const startCatIdx = categories.value.findIndex((c) => c.id === startCell.value.catId);
  const endCatIdx = categories.value.findIndex((c) => c.id === currentCatId);
  const minCat = Math.min(startCatIdx, endCatIdx);
  const maxCat = Math.max(startCatIdx, endCatIdx);
  const minMonth = Math.min(startCell.value.month, currentMonth);
  const maxMonth = Math.max(startCell.value.month, currentMonth);
  const newSelection = [];
  for (let i = minCat; i <= maxCat; i++) {
    const cid = categories.value[i].id;
    for (let m = minMonth; m <= maxMonth; m++) {
      newSelection.push({ key: `${cid}-${m}`, catId: cid, month: m });
    }
  }
  selectedCells.value = newSelection;
};
const stopDragging = () => {
  isDragging.value = false;
  startCell.value = null;
};

// --- コピー＆ペースト ---
const isCopying = ref(false);
const copyToClipboard = async () => {
  if (selectedCells.value.length === 0) return;
  const textToCopy = selectedCells.value.map((cell) => data[cell.catId][cell.month] || 0).join('\n');
  await navigator.clipboard.writeText(textToCopy);
  isCopying.value = true;
  setTimeout(() => {
    isCopying.value = false;
  }, 1000);
};

const pasteFromClipboard = async () => {
  if (selectedCells.value.length === 0) return;
  try {
    const text = await navigator.clipboard.readText();
    const values = text
      .split(/[\n\r\t, 　]+/)
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
    if (values.length === 0) return;
    const sortedSelection = [...selectedCells.value].sort((a, b) => {
      const aCatIdx = categories.value.findIndex((c) => c.id === a.catId);
      const bCatIdx = categories.value.findIndex((c) => c.id === b.catId);
      if (aCatIdx !== bCatIdx) return aCatIdx - bCatIdx;
      return a.month - b.month;
    });
    const isSingleValue = values.length === 1;
    sortedSelection.forEach((cell, index) => {
      const valToPaste = isSingleValue ? values[0] : values[index];
      if (valToPaste !== undefined) {
        const num = Number(valToPaste.replace(/[^\d.-]/g, ''));
        if (!isNaN(num)) data[cell.catId][cell.month] = num;
      }
    });
  } catch (err) {
    console.error('貼り付けエラー:', err);
  }
};

// --- ライフサイクル (ここを1つに統合！) ---
// --- ライフサイクル ---
onMounted(() => {
  // Firebase監視
  onAuthStateChanged(auth, async (currentUser) => {
    console.log('Auth State Changed:', currentUser);
    user.value = currentUser;

    if (currentUser) {
      // 🌟 ログイン成功時、Firestore からデータを取得
      try {
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const cloudData = docSnap.data();
          // データを reactive な data にコピー
          if (cloudData.kakeibo_data) {
            Object.assign(data, cloudData.kakeibo_data);
          }
          if (cloudData.categories) {
            categories.value = cloudData.categories;
          }
          console.log('クラウドからデータを読み込んだよ！');
        }
      } catch (err) {
        console.error('データ取得エラー:', err);
      }
    }
  });

  window.addEventListener('mouseup', stopDragging);

  const handleKey = (e) => {
    if (selectedCells.value.length === 0) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      e.preventDefault();
      copyToClipboard();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      e.preventDefault();
      pasteFromClipboard();
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (e.target.tagName !== 'INPUT') {
        e.preventDefault();
        selectedCells.value.forEach((cell) => {
          data[cell.catId][cell.month] = 0;
        });
      }
    }
  };
  window.addEventListener('keydown', handleKey);

  onUnmounted(() => {
    window.removeEventListener('mouseup', stopDragging);
    window.removeEventListener('keydown', handleKey);
  });
});
</script>
<template>
  <div class="app-wrapper">
    <main class="main-content">
      <div class="card">
        <h1>年間収支シミュレーター</h1>

        <div v-if="!user" class="login-container">
          <div class="login-box">
            <p>データを保存・同期するにはログインが必要です。</p>
            <button @click="login" class="action-btn login-btn">🔑 Googleでログイン</button>
          </div>
        </div>

        <div v-else>
          <div class="auth-section">
            <div class="user-info">
              <img :src="user.photoURL" class="user-icon" referrerpolicy="no-referrer" />
              <span class="user-name">{{ user.displayName }} さん</span>
              <button @click="logout" class="action-btn logout-btn">ログアウト</button>
            </div>
          </div>

          <div class="action-bar">
            <button @click="copyToClipboard" class="action-btn copy" :disabled="selectedCells.length === 0">
              📋 コピー
            </button>
            <button @click="pasteFromClipboard" class="action-btn paste" :disabled="selectedCells.length === 0">
              📥 貼り付け
            </button>
            <button @click="selectedCells = []" class="action-btn clear" :disabled="selectedCells.length === 0">
              🧹 選択解除
            </button>
            <span v-if="selectedCells.length > 0" class="selection-info no-mobile">
              {{ selectedCells.length }} 個のセルを選択中
            </span>
          </div>

          <div class="scroll-container">
            <div class="table-inner">
              <div class="month-header">
                <div class="header-spacer">
                  <div class="header-sort-placeholder"></div>
                </div>
                <div v-for="m in 12" :key="m" class="month-header-label">{{ m }}月</div>
              </div>

              <div v-for="(cat, index) in categories" :key="cat.id" class="category-row-wrapper">
                <div class="sticky-side-area">
                  <div class="sort-buttons">
                    <button @click="moveCategory(index, -1)" :disabled="index === 0">▲</button>
                    <button @click="moveCategory(index, 1)" :disabled="index === categories.length - 1">▼</button>
                  </div>
                  <label class="month-label" @click="openEdit(cat)">{{ cat.label }}</label>
                </div>

                <MonthRow
                  :class="{ 'is-dragging': isDragging }"
                  :month-data="data[cat.id]"
                  :selected-month-keys="selectedCells.filter((c) => c.catId === cat.id).map((c) => c.month)"
                  @mousedown-cell="(m, event) => startSelect(cat.id, m, event)"
                  @mouse-enter-cell="(m) => handleMouseEnter(cat.id, m)"
                />
                <hr v-if="cat.id === 'investment'" class="row-divider" />
              </div>

              <div class="row total-row">
                <label class="month-label sticky-label">支出合計</label>
                <div class="months">
                  <div v-for="m in 12" :key="m" class="month-total-cell">
                    {{ getMonthTotal(m).toLocaleString() }}<span class="total-unit">円</span>
                  </div>
                </div>
              </div>

              <div class="row balance-row">
                <label class="month-label sticky-label bg-primary">手残り（収支）</label>
                <div class="months">
                  <div v-for="m in 12" :key="m" class="month-total-cell" :class="{ minus: getMonthBalance(m) < 0 }">
                    {{ getMonthBalance(m).toLocaleString() }}<span class="total-unit">円</span>
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
              年間投資合計: <span>{{ totalInvestment().toLocaleString() }}</span> 円
            </p>
            <p>
              年間支出合計: <span>{{ totalOut().toLocaleString() }}</span> 円
            </p>
            <p>
              年間手残り:
              <span :class="{ minus: totalIncome() - totalOut() < 0 }">
                {{ (totalIncome() - totalOut()).toLocaleString() }} 円
              </span>
            </p>
          </div>
        </div>
      </div>
    </main>

    <EditModal v-model="editingCategory" @save="saveEdit" @delete="deleteFromEdit" @close="editingCategory = null" />
  </div>
</template>

<style scoped>
/* style は以前のままで大丈夫だよ */
</style>

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
  position: relative; /* 子の sticky の基準になる */
}

.scroll-container.is-dragging {
  user-select: none; /* ドラッグ中に周りの文字が青く光るのを防ぐ */
  pointer-events: all;
}

.month-header {
  display: flex;
  /* gap: 20px; */
  margin-bottom: 10px;
  min-width: max-content;
}

.header-spacer {
  width: 243px;
  flex-shrink: 0;
  position: sticky;
  left: 0;
  background-color: white;
  z-index: 30;
  display: flex;
  align-items: center;
}

.month-header-label {
  width: 115px;
  font-size: 16px;
  font-weight: bold;
  text-align: center;
  flex-shrink: 0;
  color: #555;
  margin-right: 20px;
}

hr {
  margin: 15px 0;
  border: 0;
  border-top: 1px solid #ddd;
}

.is-dragging input {
  pointer-events: none !important;
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
  background-color: #f0f9f0 !important;
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
  font-size: 18px;
  flex-shrink: 0;
  padding: 0 10px;
  background-color: transparent; /* 親の背景色(白)を活かす */
  z-index: auto; /* 親の z-index に任せる */
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
  margin-bottom: 20px;
}

.add-btn {
  margin: 10px 0 30px;
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
}

.sort-buttons {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: max-content; /* 横に突き抜けても崩れないように */
  width: 30px; /* ボタンエリアの幅を固定 */
  flex-shrink: 0; /* 潰れないように固定 */
}

.sort-buttons button {
  padding: 2px 0;
  font-size: 12px;
  cursor: pointer;
  background: #eee;
  border: none;
  border-radius: 15px;
}

.row-content {
  flex-grow: 1; /* 残りの幅を全部使う */
}

.sort-buttons button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
/* App.vue の style scoped 内に追加 */

.action-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
  padding: 10px;
  background-color: #f8f9fa;
  border-radius: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn.copy {
  background-color: #e3f2fd;
  color: #1976d2;
}

.action-btn.copy:hover:not(:disabled) {
  background-color: #bbdefb;
}

.action-btn.paste {
  background-color: #f1f8e9;
  color: #388e3c;
}

.action-btn.paste:hover:not(:disabled) {
  background-color: #dcedc8;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: grayscale(1);
}

.selection-info {
  font-size: 14px;
  color: #666;
}

/* App.vue の style scoped 内 */

/* 1. カテゴリとボタンをひとまとめにして固定 */
.sticky-side-area {
  position: sticky;
  left: 0;
  z-index: 20;
  background-color: white;
  display: flex;
  align-items: center;
  gap: 10px;
  /* padding-right: 15px;  */
  flex-shrink: 0;

  padding: 8px 0px;
}

/* 2. ヘッダー（○月）の左側の余白を、下の固定エリアの幅に合わせる */

/* 3. 合計行も同じように固定されるようにクラスを追加（もし必要なら） */
.total-row,
.balance-row {
  display: flex;
  align-items: center;
  background-color: white; /* 透け防止 */
}

/* 合計行のラベルも左側に固定 */
.total-row .month-label,
.balance-row .month-label {
  position: sticky;
  left: 0;
  z-index: 25;
  background-color: white;
  width: 230px; /* sticky-side-areaと同じ幅にする */
  padding-left: 40px; /* 並び替えボタンがない分、少し右に寄せる */
  box-sizing: border-box;
  flex-shrink: 0;
}

.bg-primary {
  --row-bg: #f0f9f0;
}

/* クラスがついた要素自体と、その中の固定エリアに色を適用 */
.bg-primary,
.bg-primary .sticky-side-area,
.bg-primary .month-label {
  background-color: var(--row-bg) !important; /* ★こっちに important をつける！ */
}
.auth-section {
  display: flex;
  justify-content: flex-end;
  padding: 10px;
  background: #fdfdfd;
  border-bottom: 1px solid #eee;
  margin-bottom: 20px;
}
.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}
.user-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid #4caf50;
}
.user-name {
  font-weight: bold;
  font-size: 14px;
}

.logout-btn {
  background-color: #f5f5f5;
  color: #666;
  font-size: 12px;
}
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 60px 20px;
  background-color: #f9f9f9;
  border-radius: 12px;
  margin-top: 20px;
}
.login-box {
  text-align: center;
}
.login-box p {
  margin-bottom: 20px;
  color: #666;
}
.login-btn {
  margin: 0 auto;
  padding: 12px 24px;
  font-size: 16px;
  background-color: #4285f4;
  color: white;
}
@media (max-width: 768px) {
  .sticky-side-area,
  .header-spacer,
  .total-row .month-label,
  .balance-row .month-label {
    position: static;
    width: 140px;
    box-shadow: none;
  }
  .no-mobile {
    display: none !important;
  }
  .card {
    margin: 0;
    padding: 10px;
    max-width: 100%;
    border-radius: 0;
  }
  .sticky-label,
  .header-spacer {
    position: static;
    width: 115px;
    background-color: transparent;
    padding-right: 21px;
  }

  .month-label {
    width: 100px;
    padding: 0 5px;
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

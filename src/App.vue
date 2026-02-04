<script setup>
import { ref, reactive, watch, onMounted, onUnmounted, computed } from 'vue'; // 🌟 computedを追加
import MonthRow from './components/MonthRow.vue';
import EditModal from './components/EditModal.vue';
import { auth, googleProvider, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

// --- ユーザー管理 ---
const user = ref(null);
const showUserMenu = ref(false);

const toggleUserMenu = () => {
  showUserMenu.value = !showUserMenu.value;
};

const logout = async () => {
  if (confirm('ログアウトする？')) {
    showUserMenu.value = false;
    await signOut(auth);
  }
};

const closeMenu = (e) => {
  if (showUserMenu.value && !e.target.closest('.user-info')) {
    showUserMenu.value = false;
  }
};

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
  ],
);

const createEmptyData = () => {
  return categories.value.reduce((acc, cat) => {
    acc[cat.id] = {};
    for (let m = 1; m <= 12; m++) acc[cat.id][m] = 0;
    return acc;
  }, {});
};

// --- タブ・データ管理 ---
const tabList = ref(['無題']);
const currentTab = ref('無題');
const allTabs = reactive({ 無題: createEmptyData() });

// ローカル復元
const savedData = JSON.parse(localStorage.getItem('kakeibo_vue_all_tabs'));
const savedList = JSON.parse(localStorage.getItem('kakeibo_tab_list'));
if (savedData && savedList) {
  Object.keys(allTabs).forEach((key) => delete allTabs[key]);
  Object.assign(allTabs, savedData);
  tabList.value = savedList;
  currentTab.value = tabList.value[0];
}

// 保存
watch(
  [allTabs, tabList, categories],
  async () => {
    if (user.value) {
      try {
        await setDoc(doc(db, 'users', user.value.uid), {
          all_tabs_data: allTabs,
          tab_list: tabList.value,
          categories: categories.value,
        });
      } catch (e) {
        console.error('保存失敗:', e);
      }
    } else {
      localStorage.setItem('kakeibo_vue_all_tabs', JSON.stringify(allTabs));
      localStorage.setItem('kakeibo_tab_list', JSON.stringify(tabList.value));
      localStorage.setItem('kakeibo_categories', JSON.stringify(categories.value));
    }
  },
  { deep: true },
);

// --- 認証 ---
const login = async () => {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    console.error(err);
  }
};

// --- タブ操作 ---
const addNewTab = () => {
  let name = prompt('シミュレーション名を入力してね');
  if (name === null) return;
  if (name.trim() === '') name = '無題';

  let finalName = name;
  let counter = 1;
  while (tabList.value.includes(finalName)) {
    finalName = `${name} (${counter++})`;
  }
  tabList.value.push(finalName);
  allTabs[finalName] = createEmptyData();
  currentTab.value = finalName;
};

const renameTab = (index) => {
  const oldName = tabList.value[index];
  let newName = prompt('名前を変更', oldName);
  if (newName === null) return;
  if (newName.trim() === '') newName = '無題';

  if (newName !== oldName) {
    if (tabList.value.includes(newName)) {
      alert('その名前はもう使われているよ！');
      return;
    }
    allTabs[newName] = JSON.parse(JSON.stringify(allTabs[oldName]));
    delete allTabs[oldName];
    tabList.value[index] = newName;
    if (currentTab.value === oldName) currentTab.value = newName;
  }
};

const removeTab = (index) => {
  const name = tabList.value[index];
  if (tabList.length <= 1) return;
  if (confirm(`「${name}」を消してもいい？`)) {
    tabList.value.splice(index, 1);
    delete allTabs[name];
    currentTab.value = tabList.value[0];
  }
};

// --- 計算ロジック ---
const getMonthTotal = (m) => {
  const cur = allTabs[currentTab.value];
  if (!cur) return 0;
  return categories.value
    .filter((c) => c.id !== 'income')
    .reduce((sum, cat) => sum + (Number(cur[cat.id]?.[m]) || 0), 0);
};

const getMonthBalance = (m) => {
  const cur = allTabs[currentTab.value];
  if (!cur) return 0;
  return (Number(cur['income']?.[m]) || 0) - getMonthTotal(m);
};

const totalIncome = () => {
  const cur = allTabs[currentTab.value];
  return cur ? Object.values(cur['income'] || {}).reduce((s, v) => s + (Number(v) || 0), 0) : 0;
};

const totalInvestment = () => {
  const cur = allTabs[currentTab.value];
  return cur ? Object.values(cur['investment'] || {}).reduce((s, v) => s + (Number(v) || 0), 0) : 0;
};

const totalOut = () => {
  const cur = allTabs[currentTab.value];
  if (!cur) return 0;
  return categories.value
    .filter((c) => c.id !== 'income')
    .reduce((sum, c) => sum + Object.values(cur[c.id] || {}).reduce((s, v) => s + (Number(v) || 0), 0), 0);
};

// 🌟 グラフ用に整形されたデータを返す (知的好奇心用)
const chartDataSummary = computed(() => {
  return categories.value.map((cat) => ({
    label: cat.label,
    total: Object.values(allTabs[currentTab.value][cat.id] || {}).reduce((s, v) => s + Number(v), 0),
  }));
});

// --- カテゴリ編集 ---
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
    Object.keys(allTabs).forEach((t) => {
      allTabs[t][newId] = {};
      for (let m = 1; m <= 12; m++) allTabs[t][newId][m] = 0;
    });
  } else {
    const index = categories.value.findIndex((c) => c.id === editingCategory.value.id);
    if (index !== -1) categories.value[index].label = editingCategory.value.label;
  }
  editingCategory.value = null;
};
const deleteCategory = (id, label) => {
  if (confirm(`「${label}」を削除してもいい？`)) {
    categories.value = categories.value.filter((c) => c.id !== id);
    Object.keys(allTabs).forEach((t) => delete allTabs[t][id]);
    return true;
  }
  return false;
};
const deleteFromEdit = () => {
  if (deleteCategory(editingCategory.value.id, editingCategory.value.label)) editingCategory.value = null;
};
const moveCategory = (index, direction) => {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= categories.value.length) return;
  const temp = categories.value[index];
  categories.value[index] = categories.value[newIndex];
  categories.value[newIndex] = temp;
};

// --- セル選択・コピペ (省略なしで維持) ---
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
    for (let m = minMonth; m <= maxMonth; m++) newSelection.push({ key: `${cid}-${m}`, catId: cid, month: m });
  }
  selectedCells.value = newSelection;
};

const stopDragging = () => {
  isDragging.value = false;
  startCell.value = null;
};

const copyToClipboard = async () => {
  if (selectedCells.value.length === 0) return;
  const cur = allTabs[currentTab.value];
  const textToCopy = selectedCells.value.map((cell) => cur[cell.catId][cell.month] || 0).join('\n');
  await navigator.clipboard.writeText(textToCopy);
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
    const cur = allTabs[currentTab.value];
    const sortedSelection = [...selectedCells.value].sort((a, b) => {
      const aCatIdx = categories.value.findIndex((c) => c.id === a.catId);
      const bCatIdx = categories.value.findIndex((c) => c.id === b.catId);
      return aCatIdx !== bCatIdx ? aCatIdx - bCatIdx : a.month - b.month;
    });
    sortedSelection.forEach((cell, index) => {
      const valToPaste = values.length === 1 ? values[0] : values[index];
      if (valToPaste !== undefined) {
        const num = Number(valToPaste.replace(/[^\d.-]/g, ''));
        if (!isNaN(num)) cur[cell.catId][cell.month] = num;
      }
    });
  } catch (err) {
    console.error(err);
  }
};

// --- ライフサイクル ---
onMounted(() => {
  onAuthStateChanged(auth, async (currentUser) => {
    user.value = currentUser;
    if (currentUser) {
      const docSnap = await getDoc(doc(db, 'users', currentUser.uid));
      if (docSnap.exists()) {
        const cloudData = docSnap.data();
        if (cloudData.all_tabs_data) Object.assign(allTabs, cloudData.all_tabs_data);
        if (cloudData.tab_list) {
          tabList.value = cloudData.tab_list;
          currentTab.value = tabList.value[0];
        }
        if (cloudData.categories) categories.value = cloudData.categories;
      }
    }
  });

  window.addEventListener('click', closeMenu);
  window.addEventListener('mouseup', stopDragging);
  window.addEventListener('keydown', (e) => {
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
        selectedCells.value.forEach((cell) => (allTabs[currentTab.value][cell.catId][cell.month] = 0));
      }
    }
  });
});

onUnmounted(() => {
  window.removeEventListener('click', closeMenu);
  window.removeEventListener('mouseup', stopDragging);
});

const truncateName = (n) => (n && n.length > 8 ? n.substring(0, 8) + '..' : n);
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
            <div class="tabs-bar">
              <div class="tabs-scroll">
                <div
                  v-for="(tabName, index) in tabList"
                  :key="index"
                  class="tab-item"
                  :class="{ 'is-active': currentTab === tabName }"
                  @click="currentTab = tabName"
                >
                  <span @dblclick="renameTab(index)">{{ tabName }}</span>
                  <button v-if="tabList.length > 1" class="tab-close-btn" @click.stop="removeTab(index)">×</button>
                </div>
                <button class="add-tab-btn" @click="addNewTab">＋</button>
              </div>
            </div>

            <div class="user-info">
              <div class="user-menu-wrapper">
                <img
                  :src="user.photoURL"
                  class="user-icon clickable"
                  @click.stop="toggleUserMenu"
                  referrerpolicy="no-referrer"
                />
                <div v-if="showUserMenu" class="user-dropdown shadow">
                  <div class="user-info-display">
                    <div class="user-name-display">{{ user.displayName }}</div>
                    <div class="user-email-display">{{ user.email }}</div>
                  </div>

                  <div class="dropdown-footer">
                    <button @click="logout" class="action-btn logout-btn-styled">ログアウト</button>
                  </div>
                </div>
              </div>
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
                  :month-data="allTabs[currentTab][cat.id]"
                  :selected-month-keys="selectedCells.filter((c) => c.catId === cat.id).map((c) => c.month)"
                  @mousedown-cell="(m, event) => startSelect(cat.id, m, event)"
                  @mouse-enter-cell="(m) => handleMouseEnter(cat.id, m)"
                  @update:monthData="allTabs[currentTab][cat.id] = $event"
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

              <div class="row balance-row bg-primary">
                <label class="month-label sticky-label">手残り（収支）</label>
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
.month-header-label {
  width: 116px;
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
  padding-left: 20px; /* 並び替えボタンがない分、少し右に寄せる */
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
  justify-content: space-between;
  padding: 10px;
  background: #fdfdfd;
  border-bottom: 1px solid #eee;
  margin-bottom: 20px;
  gap: 15px;
}
.tabs-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  overflow: hidden; /* はみ出た分を隠す */
}
.tabs-scroll::-webkit-scrollbar {
  display: none; /* Chrome/Safari用：スクロールバー隠し */
}
.tabs-scroll {
  display: flex; /* 👈 これで横並びになる */
  align-items: center;
  flex-direction: row; /* 👈 明示的に横方向を指定 */
  gap: 4px;
  overflow-x: auto; /* 👈 横に溢れたらスクロールできるようにする */
  white-space: nowrap; /* 👈 文字が折り返されないようにする */
  padding-bottom: 4px; /* スクロールバーとの隙間 */
  flex: 1;
}

.tab-item {
  padding: 6px 12px;
  background: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 6px; /* 少し丸みを抑えてスッキリ */
  cursor: pointer;
  white-space: nowrap;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #666;
  border-bottom: none; /* 下線を消してカードっぽく */
  border-radius: 8px 8px 0 0; /* 上だけ丸くする */
}

.tab-item.is-active {
  background: #4caf50;
  color: white;
  border-color: #4caf50;
  font-weight: bold;
}

.tab-close-btn {
  border: none;
  background: transparent;
  color: inherit;
  font-size: 18px;
  margin-left: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    opacity 0.2s,
    transform 0.2s;
  width: 20px;
  height: 20px;
  position: relative;
  top: -1px;
  line-height: 1;
}

.tab-close-btn:hover {
  opacity: 1;
  background: rgba(0, 0, 0, 0.08);
  border-radius: 50%;
}
.add-tab-btn {
  background: #f0f0f0;
  border: 1px solid #ccc;
  border-radius: 4px;
  width: 28px;
  height: 28px;
  cursor: pointer;
  flex-shrink: 0; /* 👈 潰れないように固定 */
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #666;
  margin-left: 4px; /* タブとの距離 */
  transition: all 0.2s;
  border-radius: 50%;
}

.add-tab-btn:hover {
  background: #eee;
  color: #333;
  border-color: #999;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0; /* 名前部分が潰れないように */
  gap: 12px;
}

.user-name {
  font-weight: bold;
  font-size: 13px;
  white-space: nowrap;
}

.user-info-display {
  padding: 8px 12px 12px 12px;
  cursor: default;
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
.user-menu-wrapper {
  position: relative;
}

.user-dropdown {
  position: absolute;
  top: 40px;
  right: 0;
  background: white;
  border: 1px solid #ddd;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 250px;
  overflow: hidden;
  padding: 12px;
}

.user-icon.clickable {
  cursor: pointer;
  transition: opacity 0.2s;
}

.user-icon.clickable:hover {
  opacity: 0.8;
}

.dropdown-item {
  padding: 10px 15px;
  font-size: 14px;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  cursor: pointer;
}

.dropdown-item:hover {
  background-color: #f5f5f5;
}

.user-name-display {
  cursor: default;
  font-weight: bold;
  color: #333;
  word-break: break-all; /* 長い名前でも強制的に折り返す */
  width: auto;
  background: none !important;
}
.user-email-display {
  font-size: 12px;
  color: #777;
  word-break: break-all;
}
.dropdown-footer {
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: center; /* ボタンを中央に */
}
.logout-btn-styled {
  width: 100%;
  justify-content: center;
  background-color: #f1f8e9; /* ほんのり赤背景 */
  color: #388e3c; /* 赤文字 */
  border: 1px solid #c5e1a5; /* 赤枠 */
  padding: 8px 0;
  font-size: 13px;
  transition: all 0.2s;
}

.logout-btn-styled:hover {
  background-color: #dcedc8;
  border-color: #aed581;
  color: #2e7d32;
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
    width: 116px;
    background-color: transparent;
    padding-right: 21px;
  }

  .month-label {
    width: 100px;
    padding: 0;
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
  .auth-section {
    flex-direction: column; /* スマホでは上下に並べるか検討、一旦横並び維持 */
    align-items: flex-end;
    gap: 10px;
  }
  .tabs-bar {
    width: 100%;
  }
  .auth-section {
    flex-direction: row !important;
    align-items: center;
    justify-content: space-between;
    padding: 8px;
    gap: 8px;
  }

  /* 2. タブエリアを柔軟に広げる */
  .tabs-bar {
    flex: 1; /* アイコン以外のスペースを全部使う */
    min-width: 0; /* flex内の子要素が溢れないようにするおまじない */
  }

  /* 3. 横スクロールをスムーズに */
  .tabs-scroll {
    display: flex;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch; /* iOSでスルスル動くように */
    gap: 4px;
  }

  /* 4. タブ自体のサイズをスマホ用に少しコンパクトに */
  .tab-item {
    padding: 10px;
    font-size: 12px;
  }

  /* 5. ユーザーアイコン周りの余白を調整 */
  .user-info {
    flex-shrink: 0; /* アイコンが潰れないように固定 */
  }

  .user-icon {
    width: 28px; /* 少し小さくしてスペース確保 */
    height: 28px;
  }

  /* 6. その他スマホ用の調整（既存の分） */
  .no-mobile {
    display: none !important;
  }
  .card {
    margin: 0;
    padding: 10px;
    max-width: 100%;
  }
}
</style>

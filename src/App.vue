<script setup>
  import { ref, reactive, watch } from 'vue' // refを追加
// ここで新しい部品を読み込む
import MonthRow from './components/MonthRow.vue'
import EditModal from './components/EditModal.vue'

const savedCategories = JSON.parse(localStorage.getItem('kakeibo_categories'))
const categories = ref(savedCategories || [
  { id: 'income', label: '収入' },
  { id: 'investment', label: '投資' },
  { id: 'food', label: '食費' },
  { id: 'misc', label: '雑費/趣味/サブスク' },
  { id: 'play', label: '遊び' },
  { id: 'rent', label: '家賃' },
])

const editingCategory = ref(null) // 今編集しているカテゴリを保存する

// 編集ボタン（ラベル）を押したとき
const openEdit = (cat) => {
  // 元のデータをコピーして編集用に持つ（キャンセルできるように）
  editingCategory.value = { ...cat }
}

// 保存ボタンを押したとき
const saveEdit = () => {
  if (editingCategory.value.id === 'new') {
    // 【新規追加の場合】
    const newId = 'cat_' + Date.now()
    categories.value.push({ id: newId, label: editingCategory.value.label })
    data[newId] = {} // データの箱も作る
  } else {
    // 【既存編集の場合】
    const index = categories.value.findIndex(c => c.id === editingCategory.value.id)
    if (index !== -1) {
      categories.value[index].label = editingCategory.value.label
    }
  }
  
  // 共通の保存・終了処理
  localStorage.setItem('kakeibo_categories', JSON.stringify(categories.value))
  editingCategory.value = null 
}

const deleteCategory = (id, label) => {
  if (confirm(`「${label}」を削除してもいい？データも消えちゃうよ。`)) {
    categories.value = categories.value.filter(c => c.id !== id)
    delete data[id]
    localStorage.setItem('kakeibo_categories', JSON.stringify(categories.value))
    return true // 削除に成功したよ、という合図
  }
  return false // キャンセルしたよ、という合図
}
// ダイアログ内の削除ボタンを押したとき
const deleteFromEdit = () => {
  
  deleteCategory(editingCategory.value.id, editingCategory.value.label)
  editingCategory.value = null // 閉じる
}

// データ管理（初期化）
const initialState = categories.value.reduce((acc, cat) => {
  acc[cat.id] = {}
  return acc
}, {})
const savedData = JSON.parse(localStorage.getItem('kakeibo_vue_data'))
const data = reactive(savedData || initialState)

// 特定の月の「支出合計」を計算する関数
const getMonthTotal = (m) => {
  return categories.value
    .filter(c => c.id !== 'income') // 収入以外を合計
    .reduce((sum, cat) => {
      const val = data[cat.id]?.[m] || 0
      return sum + (Number(val) || 0)
    }, 0)
}

// 特定の月の「収支（手残り）」を計算する関数
const getMonthBalance = (m) => {
  const income = Number(data['income']?.[m]) || 0
  return income - getMonthTotal(m)
}

// カテゴリが欠けている場合の補完
categories.value.forEach(cat => {
  if (!data[cat.id]) data[cat.id] = {}
})

// 変更があるたびに保存
watch(data, (newData) => {
  localStorage.setItem('kakeibo_vue_data', JSON.stringify(newData))
}, { deep: true })


// App.vue
const openAdd = () => {
  // 「新規作成モード」として、中身が空のオブジェクトを渡す
  editingCategory.value = { id: 'new', label: '' }
}

// 計算ロジック
const getCategoryTotal = (id) => {
  const months = data[id] || {}
  return Object.values(months).reduce((sum, val) => sum + (Number(val) || 0), 0)
}
const totalIncome = () => getCategoryTotal('income')
const totalInvestment = () => getCategoryTotal('investment')
const totalOut = () => {
  return categories.value // .value を追加
    .filter(c => c.id !== 'income')
    .reduce((sum, c) => sum + getCategoryTotal(c.id), 0)
}
// モーダルが開いたときに入力欄に自動でカーソルを当てる魔法
const vFocus = {
  mounted: (el) => el.focus()
}
</script>

<template>
  <div class="card">
    <h3>年間収支シミュレーター</h3>
    
    <div class="scroll-container">
      <div class="table-inner">
      <div class="month-header">
        <div class="header-spacer" style="width: 180px"></div>
        <div v-for="m in 12" :key="m" class="month-header-label">{{ m }}月</div>
      </div>

      <div v-for="cat in categories" :key="cat.id">
        <MonthRow 
          :label="cat.label"
          :month-data="data[cat.id]"
          @click-label="openEdit(cat)"
        />
        <hr v-if="cat.id === 'investment'">
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
    <div v-for="m in 12" :key="m" class="month-total-cell" :class="{ 'minus': getMonthBalance(m) < 0 }">
      {{ getMonthBalance(m).toLocaleString() }}
      <span class="total-unit">円</span> 
    </div>
  </div>
</div>

            </div> <button @click="openAdd" class="add-btn">＋ カテゴリを追加</button>

    <div class="result">
      <p>年間投資合計: <span>{{ totalInvestment().toLocaleString() }}</span> 円</p>
      <p>年間支出合計: <span>{{ totalOut().toLocaleString() }}</span> 円</p>
      <p>年間手残り（収支）: <span :class="{ 'minus': (totalIncome() - totalOut()) < 0 }">{{ (totalIncome() - totalOut()).toLocaleString() }} 円</span></p>
    </div>
<EditModal 
  v-model="editingCategory"
  @save="saveEdit"
  @delete="deleteFromEdit"
  @close="editingCategory = null"
/>
</div>
  </div>
</template>

<style scoped>
.card { 
  max-width: 98%; 
  margin: 20px auto; 
  padding: 20px; 
  background-color: white; 
  color: #333; 
}

/* 横に長くなってもスクロールできるようにする枠 */
.scroll-container { 
  overflow-x: auto; 
  overflow-y: visible; 
  padding-bottom: 20px; /* スクロールバーで見えなくならないように */
}

/* 1月〜12月の見出しを横に並べる */
.month-header { 
  display: flex; 
  gap: 5px; 
  margin-bottom: 10px; 
  min-width: max-content; 
}
.header-spacer {
  width: 180px;      /* カテゴリ名のラベルと同じ幅にする */
  flex-shrink: 0;
  position: sticky;  /* 左側に固定 */
  left: 0;
  background-color: white; /* これで後ろの「月」の文字を隠す壁になる */
  z-index: 30;       /* 月の見出し(20)よりもさらに上に置く */
}

/* 見出し1つ1つの見た目（ここを大きくしたよ！） */
.month-header-label { 
  width: 120px; 
  font-size: 16px; /* 大きくした！ */
  font-weight: bold;
  text-align: center; 
  flex-shrink: 0; 
  color: #555;
}

hr { margin: 15px 0; border: 0; border-top: 1px solid #ddd; }

/* App.vue の style scoped に追加 */

.total-row {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 2px solid #4caf50; /* 緑の線で区切る */
  font-weight: bold;
  position: relative;
  background-color: white;
  padding-bottom: 10px;
  
}
.months {
  display: flex;       /* 横並びにする */
  gap: 5px;            /* 少し隙間をあける */
  flex-wrap: nowrap;   /* 勝手に改行させない */
}
.total-row, .balance-row {
  display: flex;         /* 横並びにする */
  align-items: center;   /* 上下中央揃え */
  min-width: max-content; 
}

.month-total-cell {
width: 120px;          /* 1月、2月のラベル幅（120px）に合わせる */
  text-align: center;    /* 数字を中央に */
  font-weight: bold;
  flex-shrink: 0;
  text-align: right;
  align-items: baseline;
}

.month-label {
  width: 180px;
  flex-shrink: 0;
  padding-left: 10px;
}

.balance-row {
  background-color: #f0f9f0; /* 収支行は少し色をつけると見やすい */
  padding: 10px 0;
  position: relative;
  font-weight:bold;
}

/* 「minus」クラスがついた要素そのものと、その中にある「円(total-unit)」を赤くする */
.minus {
  color: #ff4d4d !important; /* 数字を赤くする */
}

.minus .total-unit {
  color: #ff4d4d !important; /* 中にある「円」も同じ赤にする */
  opacity: 0.8;             /* 少しだけ透明度を入れるとおしゃれ */
}
.total-unit {
  font-size: 14px;    /* 数字より一回り小さく */
  color: #999;       /* 少し薄いグレーに */
  margin-left: 5px;
  font-weight: normal; /* 単位は太字にしないのがプロのコツ */
}

/* ラベルを左に固定する設定を共通化 */
.sticky-label {
  position: sticky;
  left: 0;
  background-color: inherit;
  z-index: 10;
}

.result { 
  margin-top: 20px; 
  padding: 20px; 
  background-color: #f9f9f9; 
  border-radius: 8px;
}
.result p { 
  margin: 10px 0; 
  font-weight: bold; 
  font-size: 20px; /* ここも大きくした！ */
}

/* 画面幅が768px以下（スマホ・タブレット）の時の設定 */
@media (max-width: 768px) {
  .card {
    margin: 0 auto;    /* 上下の余白をなくして画面いっぱいに */
    padding: 10px;     /* 中の余白も少し詰めると、入力欄が広く使えるよ */
    max-width: 100%;   /* 98%から100%に広げて、スマホの端まで使う */
    border-radius: 0;  /* スマホの時は角の丸みをなくすと、アプリっぽさが増すよ */
  }
  .sticky-label, 
  .header-spacer {
    /* sticky（固定）を解除して、普通の配置に戻す */
    position: static !important; 
    /* 横幅も少し狭くして、入力欄を広く見せる */
    width: 120px !important; 
    min-width: 120px !important;
  }

  /* 横並びの崩れを防ぐための調整 */
  .month-header, 
  .row {
    display: flex;
    flex-wrap: nowrap; /* 勝手に改行させない */
  }

  /* ラベルが固定されない分、文字が隠れないように背景色を透明に */
  .sticky-label {
    background-color: transparent !important;
  }
  
}

/* App.vue の style の中に追加 */
.table-inner {
  display: inline-block; /* 12ヶ月分の幅に合わせて自動で横に広がる */
  min-width: 100%;       /* 最低でも画面の端までは届く */
  padding-bottom: 20px;
}

/* 既存の hr の設定をシンプルに上書き */
hr {
  width: 100%;           /* table-inner の端から端まで！ */
  border: 0;
  border-top: 1px solid #ddd;
  margin: 15px 0;
  display: block;        /* 確実に表示させる */
}

/* 合計欄の緑の線もこれで解決 */
.total-row {
  border-top: 2px solid #4caf50;
  width: 100%;           /* table-inner の端から端まで！ */
}
</style>
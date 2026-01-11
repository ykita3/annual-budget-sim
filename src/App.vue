<script setup>
  import { ref, reactive, watch } from 'vue'
  import MonthRow from './components/MonthRow.vue'
  import EditModal from './components/EditModal.vue'

  // --- カテゴリ管理 ---
  const savedCategories = JSON.parse(localStorage.getItem('kakeibo_categories'))
  const categories = ref(savedCategories || [
    { id: 'income', label: '収入' },
    { id: 'investment', label: '投資' },
    { id: 'food', label: '食費' },
    { id: 'misc', label: '雑費/趣味/サブスク' },
    { id: 'play', label: '遊び' },
    { id: 'rent', label: '家賃' },
  ])

  // --- 編集・削除ロジック ---
  const editingCategory = ref(null)
  const openEdit = (cat) => { editingCategory.value = { ...cat } }
  
  const saveEdit = () => {
    if (editingCategory.value.id === 'new') {
      const newId = 'cat_' + Date.now()
      categories.value.push({ id: newId, label: editingCategory.value.label })
      data[newId] = {}
    } else {
      const index = categories.value.findIndex(c => c.id === editingCategory.value.id)
      if (index !== -1) categories.value[index].label = editingCategory.value.label
    }
    localStorage.setItem('kakeibo_categories', JSON.stringify(categories.value))
    editingCategory.value = null 
  }

  const deleteCategory = (id, label) => {
    if (confirm(`「${label}」を削除してもいい？データも消えちゃうよ。`)) {
      categories.value = categories.value.filter(c => c.id !== id)
      delete data[id]
      localStorage.setItem('kakeibo_categories', JSON.stringify(categories.value))
      return true
    }
    return false
  }
  const deleteFromEdit = () => {
    deleteCategory(editingCategory.value.id, editingCategory.value.label)
    editingCategory.value = null
  }

  // --- データ管理 ---
  const initialState = categories.value.reduce((acc, cat) => {
    acc[cat.id] = {}
    return acc
  }, {})
  const savedData = JSON.parse(localStorage.getItem('kakeibo_vue_data'))
  const data = reactive(savedData || initialState)

  categories.value.forEach(cat => {
    if (!data[cat.id]) data[cat.id] = {}
  })

  watch(data, (newData) => {
    localStorage.setItem('kakeibo_vue_data', JSON.stringify(newData))
  }, { deep: true })

  // --- 計算ロジック ---
  const getMonthTotal = (m) => {
    return categories.value
      .filter(c => c.id !== 'income')
      .reduce((sum, cat) => sum + (Number(data[cat.id]?.[m]) || 0), 0)
  }
  const getMonthBalance = (m) => {
    const income = Number(data['income']?.[m]) || 0
    return income - getMonthTotal(m)
  }
  const getCategoryTotal = (id) => {
    const months = data[id] || {}
    return Object.values(months).reduce((sum, val) => sum + (Number(val) || 0), 0)
  }
  const totalIncome = () => getCategoryTotal('income')
  const totalInvestment = () => getCategoryTotal('investment')
  const totalOut = () => {
    return categories.value
      .filter(c => c.id !== 'income')
      .reduce((sum, c) => sum + getCategoryTotal(c.id), 0)
  }
  const openAdd = () => { editingCategory.value = { id: 'new', label: '' } }
</script>

<template>
  <div class="app-wrapper">
    <main class="main-content">
      <div class="card">
        <h1>年間収支シミュレーター</h1>
        
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
          </div>
        </div>
        
        <button @click="openAdd" class="add-btn">＋ カテゴリを追加</button>
      </div>
    </main>

    <div class="result">
      <p>年間投資合計: <span>{{ totalInvestment().toLocaleString() }}</span> 円</p>
      <p>年間支出合計: <span>{{ totalOut().toLocaleString() }}</span> 円</p>
      <p>年間手残り(収支): 
        <span :class="{ 'minus': (totalIncome() - totalOut()) < 0 }">
          {{ (totalIncome() - totalOut()).toLocaleString() }} 円
        </span>
      </p>
    </div>

    <EditModal 
      v-model="editingCategory"
      @save="saveEdit"
      @delete="deleteFromEdit"
      @close="editingCategory = null"
    />
  </div>
</template>

<style scoped>
.app-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 10vh;
}

.main-content {
  flex: 1;
}

.card { 
  max-width: 98%; 
  margin: 20px auto; 
  padding: 20px; 
  background-color: white; 
  color: #333; 
}

.scroll-container { 
  overflow-x: auto; 
  overflow-y: visible; 
  padding-bottom: 20px;
}

.month-header { 
  display: flex; 
  gap: 5px; 
  margin-bottom: 10px; 
  min-width: max-content; 
}

.header-spacer {
  width: 180px;
  flex-shrink: 0;
  position: sticky;
  left: 0;
  background-color: white;
  z-index: 30;
}

.month-header-label { 
  width: 120px; 
  font-size: 16px;
  font-weight: bold;
  text-align: center; 
  flex-shrink: 0; 
  color: #555;
}

hr { margin: 15px 0; border: 0; border-top: 1px solid #ddd; }

.total-row, .balance-row {
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

.minus { color: #ff4d4d !important; }
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
  margin: 0 20px;
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
  margin-top: 20px;
  padding: 10px 20px;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

@media (max-width: 768px) {
  .card { margin: 0; padding: 10px; max-width: 100%; border-radius: 0; }
  .sticky-label, .header-spacer {
    position: static !important;
    width: 120px !important;
    min-width: 120px !important;
    background-color: transparent !important;
  }
  h1{
    font-size: 24px;
  }
.result {
    margin: 0;
    padding: 10px 20px;
  }

.result p {
    font-size: 16px;  /* スマホでは14pxまで下げると、1行にスッキリ収まるよ */
    /* margin: 4px 0; */
  }
}
</style>
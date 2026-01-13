<script setup>
// 親からデータを受け取る
const props = defineProps({
  label: String,
  monthData: Object
})

const emit = defineEmits(['click-label'])

// 【追加】3桁カンマを付ける表示用の関数
const format = (val) => {
  if (val === undefined || val === null || val === '') return ''
  // カンマを付けて返す
  return Number(val).toLocaleString()
}

// 【追加】入力された時にカンマを取り除いて数字だけを保存する関数
const handleInput = (m, e) => {
  const rawValue = e.target.value
  // 数字以外（カンマなど）を全部消す
  const numValue = rawValue.replace(/[^\d]/g, '')
  
  // 親のデータを更新（App.vueのdataと連動）
  // 空文字なら空、数字があるなら数値型にして保存
  props.monthData[m] = numValue === '' ? '' : Number(numValue)
}
</script>

<template>
<div class="row">
  <label class="month-label" @click="emit('click-label')">
    {{ label }}
  </label>
  
  <div class="months">
    <div v-for="m in 12" :key="m" class="month-input">
      <input 
        type="text" 
        inputmode="numeric" 
        pattern="\d*"
        :value="format(monthData[m])"
        @input="handleInput(m, $event)"
      >
      <span class="unit">円</span>
    </div>
  </div>
</div>
</template>

<style scoped>
/* --- スタイルは君の元のコードを完全キープ！ --- */
.row { 
  display: flex; 
  align-items: center; 
  margin-bottom: 10px; 
  min-width: max-content; 
  background-color: white; 
}

.month-label {
  width: 180px; 
  font-size: 18px; 
  position: sticky; 
  left: 0;
  background-color: white; 
  z-index: 10; 
  margin-right: 5px; 
  flex-shrink: 0;
  height: 40px; 
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 0 10px;
  transition: all 0.2s;
  border-radius: 4px;
}

.month-label:hover {
  background-color: #f5f5f5;
  color: #4caf50;
}

.months { display: flex; gap: 5px; flex-wrap: nowrap; }
.month-input { width: 120px; flex-shrink: 0;}
.month-input input { 
  width: 70px; 
  font-size: 16px; 
  padding: 5px; 
  border: 1px solid #ddd; 
  border-radius: 4px;
  outline: none;
  text-align: right; /* 【追加】金額なので右寄せにするとお母さんも見やすい！ */
  font-family: sans-serif;
}
.month-input input:focus {
  border-color: #4caf50;
}

.unit{color: #999;
font-size: 12px;
margin-left: 8px;}

@media (max-width: 768px) {
  .month-label {
    position: static !important; 
    width: 120px !important; 
    min-width: 120px !important;
    background-color: transparent !important;
  }
  .row {
    min-width: max-content;
  }
}
</style>
<script setup>
// 親からデータを受け取る
const props = defineProps({
  label: String,
  monthData: Object
})

// 親に「クリックされたよ」と伝えるための設定
const emit = defineEmits(['click-label'])
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
  v-model="monthData[m]"
>
      <span class="unit">円</span>
    </div>
  </div>
</div>
</template>

<style scoped>
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
  cursor: pointer; /* 「押せる」という安心感 */
  padding: 0 10px;
  transition: all 0.2s;
  border-radius: 4px;
}

/* ホバーした時に「あ、ここだ」とわかるように優しく色付け */
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
}
.month-input input:focus {
  border-color: #4caf50; /* 入力中も癒やしのグリーンに */
}

.unit{color: #999;
font-size: 12px;
margin-left: 8px;}

/* MonthRow.vue の style の一番下に追加 */

@media (max-width: 768px) {
  .month-label {
    /* スマホの時は固定を解除！ */
    position: static !important; 
    /* 幅も少し詰めると入力欄が見やすくなるよ */
    width: 120px !important; 
    min-width: 120px !important;
    background-color: transparent !important;
  }
  
  .row {
    /* ラベルが固定されないので、横に長く並ぶようにする */
    min-width: max-content;
  }
}
</style>
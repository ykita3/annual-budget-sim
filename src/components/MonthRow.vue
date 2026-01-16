<script setup>
const props = defineProps({
  label: String,
  monthData: Object,
  selectedMonthKeys: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['click-label', 'mousedown-cell', 'mouse-enter-cell']);

const format = (val) => {
  if (val === undefined || val === null || val === '') return '';
  return Number(val).toLocaleString();
};
const handleInput = (m, e) => {
  const rawValue = e.target.value;
  // 数字以外を除去
  const numValue = rawValue.replace(/[^\d]/g, '');
  const finalVal = numValue === '' ? 0 : Number(numValue);
  // 空っぽなら 0、そうでなければ数値に変換して代入
  emit('update:monthData', { ...props.monthData, [m]: finalVal });
};

const isSelected = (m) => props.selectedMonthKeys.includes(m);
</script>

<template>
  <div class="row-inner">
    <div class="months">
      <div
        v-for="m in 12"
        :key="m"
        class="month-input-container"
        :class="{ 'is-selected': isSelected(m) }"
        @mousedown="emit('mousedown-cell', m, $event)"
        @mouseenter="emit('mouse-enter-cell', m)"
      >
        <input
          type="text"
          inputmode="numeric"
          pattern="\d*"
          :value="format(monthData[m])"
          @input="handleInput(m, $event)"
        />
        <span class="unit">円</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.row-inner {
  display: flex;
  align-items: center;
}

.month-label {
  width: 180px;
  font-size: 18px;
  margin-right: 5px;
  flex-shrink: 0;
  height: 40px;
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 3px 10px;
  transition: all 0.2s;
  border-radius: 4px;
  flex-shrink: 0;
  z-index: auto;
}

.month-label:hover {
  background-color: #f5f5f5;
  color: #4caf50;
}

.months {
  display: flex;
  gap: 20px;
  flex-wrap: nowrap;
}

.month-input-container {
  width: 100px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  user-select: none;
  border: 3px solid #ddd;
  border-radius: 8px;
  padding: 5px;
  transition: all 0.2s;
  cursor: cell;
  position: relative;
  /* justify-content: center;  */
  /* padding: 4px 8px;  */
}

.month-input-container input {
  width: 70px;
  font-size: 16px;
  border: none;
  outline: none;
  text-align: right;
  background: transparent;
  position: relative;
  z-index: 2;
  cursor: text;
}

.is-selected {
  border-color: #4caf50 !important;
  background-color: #e8f5e9 !important;
  box-shadow: 0 0 5px rgba(76, 175, 80, 0.5);
}

.unit {
  color: #999;
  font-size: 12px;
  margin-left: 8px;
}
.is-dragging input {
  pointer-events: none !important;
  user-select: none !important;
}
.month-input-container:has(~ .is-dragging) input,
:host-context(.is-dragging) input,
.is-dragging input {
  pointer-events: none !important;
  user-select: none !important;
}
</style>

<script setup>
// 親（App.vue）から受け取るデータ
const props = defineProps({
  modelValue: Object // 編集中のカテゴリデータ
})

// 親にイベントを伝えるための合図
const emit = defineEmits(['update:modelValue', 'save', 'delete', 'close'])

// モーダルが開いたときに入力欄に自動でカーソルを当てる魔法
const vFocus = {
  mounted: (el) => el.focus()
}
</script>

<template>
  <div v-if="modelValue" class="modal-overlay" @click.self="emit('close')">
    <div class="modal-content">
      <h4>カテゴリの編集</h4>
      
      <input 
        v-model="modelValue.label" 
        v-focus 
        class="edit-input" 
        placeholder="カテゴリ名を入力"
      />
      
      <div class="modal-actions">
        <button @click="emit('save')" class="save-btn">
          {{ modelValue.id === 'new' ? '追加' : '保存' }}
        </button>
        
        <button v-if="modelValue.id !== 'new'" @click="emit('delete')" class="modal-delete-btn">
          削除
        </button>
        
        <button @click="emit('close')" class="cancel-btn">キャンセル</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* App.vueからモーダル関係のCSSをここに引っ越してくる */
.modal-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center;
  z-index: 100;
}
.modal-content {
  background: white; padding: 20px; border-radius: 8px; width: 300px; text-align: center;
  color: #333;
}
.edit-input {
  width: calc(100% - 20px); padding: 8px; margin-bottom: 20px; font-size: 16px;
  border: 1px solid #ddd; border-radius: 4px;
}
.modal-actions { display: flex; flex-direction: column; gap: 10px; }
.save-btn { background: #4caf50; color: white; border: none; padding: 10px; border-radius: 4px; cursor: pointer; }
.modal-delete-btn { background: #ff4d4d; color: white; border: none; padding: 10px; border-radius: 4px; cursor: pointer; }
.cancel-btn { background: #eee; border: none; padding: 10px; border-radius: 4px; cursor: pointer; color: #333; }
</style>
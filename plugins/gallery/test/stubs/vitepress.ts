import { ref } from 'vue'
export const useData = () => ({ site: ref({ base: '/vuemo/' }), isDark: ref(false) })

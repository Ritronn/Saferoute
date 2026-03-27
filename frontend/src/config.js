// API base URL — uses Vite proxy in dev, Render backend in production
const API_BASE = import.meta.env.VITE_API_URL || ''

export default API_BASE

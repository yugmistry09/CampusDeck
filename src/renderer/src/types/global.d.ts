/// <reference types="vite/client" />
import type { CampusDeckAPI } from '../../../preload/index'

declare global {
  interface Window {
    campusDeckAPI: CampusDeckAPI
  }
}

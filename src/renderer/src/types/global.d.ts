/// <reference types="vite/client" />
import type { CampusDeskAPI } from '../../../preload/index'

declare global {
  interface Window {
    campusDeskAPI: CampusDeskAPI
  }
}

import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import AppWrapper from './AppWrapper.vue'
import App from './App.vue'
import './style.css'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: App
    },
    {
      path: '/map/:mapId',
      name: 'map',
      component: App
    },
    {
      path: '/map/:mapId/poi/:poiId',
      name: 'poi',
      component: App
    },
    {
      path: '/search/:searchText',
      name: 'search',
      component: App
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
  ]
})

const app = createApp(AppWrapper)
app.use(router)
app.mount('#app')
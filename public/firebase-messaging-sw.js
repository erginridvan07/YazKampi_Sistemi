/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/12.14.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/12.14.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyDTxK32x60JPbYUD-Q2rNy4HowN0k13P9I',
  authDomain: 'yurtyonetimsistemi.firebaseapp.com',
  projectId: 'yurtyonetimsistemi',
  storageBucket: 'yurtyonetimsistemi.firebasestorage.app',
  messagingSenderId: '728429977816',
  appId: '1:728429977816:web:577c33b819945236cf77ad',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Gaye Vakfı Portal'
  const options = {
    body: payload.notification?.body || '',
    icon: '/favicon.svg',
    data: payload.data,
  }
  self.registration.showNotification(title, options)
})

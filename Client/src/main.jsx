import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Iris registration on page load
const initIris = () => {
  // Get or create a visitor ID for non-authenticated users
  let visitorId = localStorage.getItem('iris_visitor_id');
  if (!visitorId) {
    visitorId = 'visitor_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    localStorage.setItem('iris_visitor_id', visitorId);
  }
  
  if (window.Iris) {
    window.Iris.register(
      visitorId,
      '693cef61be96745c4607e233',
      'sk_7fc63c5f8fce797545c878843309f716ca34ab25e721a37ae26efcda73fcd281'
    )
      .then(result => console.log('Iris Init Success:', result))
      .catch(error => console.error('Iris Init Error:', error));
  }
};

// Run Iris initialization
initIris();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

